import type { ConferenceId, GameSlot, GameState, NcaaBid, NcaaRegion, NewsArticle, SelectionBoard } from "./types";
import { WEEK_HOURS } from "./types";
import { CONFERENCES, TEAM_BY_ID } from "./teams";
import { conferencePlaysLeague, activeLeagueIds, leagueName } from "./align";
import { NCAA, NIT, CBI, SELECTION_SUNDAY, FIRST_FOUR, gameKindShort } from "./brand";
import { clamp, gaussian, mulberry32, type Rng } from "./rng";
import { enterOffseason } from "./develop";
import { simContest } from "./sim";
import { withRecap } from "./recap";
import { ncaaEligible } from "./compliance";
import { brief } from "./wire";
import { ensureSelectionArchive } from "./archives";

const REGIONS: NcaaRegion[] = ["East", "West", "South", "Midwest"];
export const NCAA_REGIONS = REGIONS;
export const PAIR_64 = [[1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]] as const;

type NewsTone = "good" | "bad" | "even";

function item(week: number, text: string, tone: NewsTone = "even"): NewsArticle {
  const headline = text.replace(/\.$/, "");
  return brief(week, headline, [text], tone, "National");
}

function withNews(state: GameState, ...lines: NewsArticle[]): GameState {
  return { ...state, news: [...lines, ...state.news].slice(0, 60) };
}

function nextPow2(n: number) {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

function ovr(state: GameState, id: string) {
  const r = state.players.filter((p) => p.teamId === id).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  if (!r.length) return 70;
  return r.reduce((s, p) => s + p.ovr, 0) / r.length;
}

export function committeeScore(state: GameState, id: string) {
  const t = state.teams[id]!;
  const conf = CONFERENCES.find((c) => c.id === t.conference);
  const games = state.results.filter((r) => r.homeId === id || r.awayId === id);
  let sos = 0;
  let qw = 0;
  let bad = 0;
  for (const r of games) {
    const oid = r.homeId === id ? r.awayId : r.homeId;
    const o = state.teams[oid];
    if (!o) continue;
    sos += o.prestige + o.wins * 0.35;
    const won = (r.homeId === id && r.homeScore > r.awayScore) || (r.awayId === id && r.awayScore > r.homeScore);
    if (won && (o.prestige >= 74 || o.wins >= 20)) qw++;
    if (!won && o.prestige < 56) bad++;
  }
  const sosAvg = games.length ? sos / games.length : t.prestige;
  return t.wins * 3.1 - t.losses * 2.5 + t.confW * 0.9 + t.prestige * 0.32 + (conf?.prestige ?? 50) * 0.22 + sosAvg * 0.5 + qw * 3.8 - bad * 4.5;
}

function rankTeams(state: GameState, score?: (id: string) => number) {
  const sc = score ?? ((id: string) => committeeScore(state, id));
  return Object.values(state.teams).filter((t) => !t.guest).sort((a, b) => sc(b.id) - sc(a.id) || b.wins - a.wins);
}

function confOrder(state: GameState, conf: ConferenceId) {
  return Object.values(state.teams)
    .filter((t) => t.conference === conf && !t.guest)
    .sort((a, b) => b.confW - a.confW || b.wins - a.wins || committeeScore(state, b.id) - committeeScore(state, a.id));
}

function playNeutral(state: GameState, homeId: string, awayId: string, week: number, kind: GameSlot["kind"], id: string, rng: Rng): GameState {
  const sim = simContest(state, homeId, awayId, rng, { site: "neutral" });
  const hs = sim.homeScore;
  const as = sim.awayScore;
  const homeWin = hs > as;
  const result = withRecap(state, {
    id: `res-${id}`,
    slotId: id,
    homeId,
    awayId,
    homeScore: hs,
    awayScore: as,
    week,
    minutes: sim.minutes,
    homeBox: sim.homeBox,
    awayBox: sim.awayBox,
  }, undefined, { home: sim.homeLines, away: sim.awayLines });
  const teams = { ...state.teams };
  const bump = (tid: string, won: boolean) => {
    const t = { ...teams[tid]! };
    if (won) t.wins++;
    else t.losses++;
    teams[tid] = t;
  };
  bump(homeId, homeWin);
  bump(awayId, !homeWin);
  const winner = TEAM_BY_ID[homeWin ? homeId : awayId]!;
  const loser = TEAM_BY_ID[homeWin ? awayId : homeId]!;
  const label = gameKindShort(kind);
  return withNews(
    { ...state, teams, results: [...state.results, result] },
    item(week, `${winner.name} ${homeWin ? hs : as}, ${loser.name} ${homeWin ? as : hs} (${label}).`),
  );
}

function knockout(state: GameState, ids: string[], rng: Rng): { state: GameState; winner: string } {
  let field = [...ids];
  let s = state;
  let n = 0;
  while (field.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < field.length; i += 2) {
      const a = field[i]!;
      const b = field[i + 1];
      if (!b) {
        next.push(a);
        continue;
      }
      n++;
      s = playNeutral(s, a, b, s.week, "conf-tourney", `cpu-ct-${a}-${b}-${n}`, rng);
      const last = s.results[s.results.length - 1]!;
      next.push(last.homeScore > last.awayScore ? a : b);
    }
    field = next;
  }
  return { state: s, winner: field[0]! };
}

function emptyBoard(): SelectionBoard {
  return { autos: {}, ncaa: [], nit: [], crown: [] };
}

export function projectedField(state: GameState, score?: (id: string) => number): NcaaBid[] {
  const autos: Record<string, string> = {};
  for (const id of activeLeagueIds(state.teams)) {
    const lead = confOrder(state, id)[0];
    if (lead) autos[id] = lead.id;
  }
  return seedField(state, autos, score);
}

function seedField(state: GameState, autos: Record<string, string>, score?: (id: string) => number): NcaaBid[] {
  const sc = score ?? ((id: string) => committeeScore(state, id));
  const fixed: Record<string, string> = { ...autos };
  for (const [conf, id] of Object.entries(fixed)) {
    if (ncaaEligible(state, id)) continue;
    const next = confOrder(state, conf as ConferenceId).find((t) => ncaaEligible(state, t.id));
    if (next) fixed[conf] = next.id;
    else delete fixed[conf];
  }
  const autoIds = [...new Set(Object.values(fixed))].filter((id) => ncaaEligible(state, id));
  const ranked = rankTeams(state, sc).filter((t) => ncaaEligible(state, t.id));
  const atLarge = ranked.filter((t) => !autoIds.includes(t.id)).slice(0, Math.max(0, 68 - autoIds.length));
  const autoTeams = ranked.filter((t) => autoIds.includes(t.id));
  const fieldIds = new Set([...autoIds, ...atLarge.map((t) => t.id)]);
  const ordered = ranked.filter((t) => fieldIds.has(t.id));

  const worstAutos = [...autoTeams].sort((a, b) => sc(a.id) - sc(b.id)).slice(0, 4);
  const worstAl = [...atLarge].sort((a, b) => sc(a.id) - sc(b.id)).slice(0, 4);
  const playInSet = new Set([...worstAutos, ...worstAl].map((t) => t.id));
  const locked = ordered.filter((t) => !playInSet.has(t.id));
  const pathOf = (id: string): NcaaBid["path"] => (autoIds.includes(id) ? "auto" : "at-large");

  const pair4 = (teams: { id: string }[]): string[][] => {
    const ids = teams.map((t) => t.id);
    if (ids.length >= 4) return [[ids[0]!, ids[3]!], [ids[1]!, ids[2]!]];
    if (ids.length >= 2) return [[ids[0]!, ids[1]!]];
    return [];
  };
  const ff16 = pair4(worstAutos);
  const ff11 = pair4(worstAl);

  const slots: { ids: string[]; playIn: boolean }[] = [];
  let li = 0;
  let n11 = 0;
  let n16 = 0;
  for (let i = 0; i < 64; i++) {
    const seed = Math.floor(i / 4) + 1;
    if (seed === 11 && n11 < ff11.length) {
      slots.push({ ids: ff11[n11++]!, playIn: true });
    } else if (seed === 16 && n16 < ff16.length) {
      slots.push({ ids: ff16[n16++]!, playIn: true });
    } else {
      const t = locked[li++];
      if (!t) continue;
      slots.push({ ids: [t.id], playIn: false });
    }
  }

  const bids: NcaaBid[] = [];
  slots.forEach((slot, i) => {
    const wave = Math.floor(i / 4);
    const pos = i % 4;
    const region = REGIONS[wave % 2 === 0 ? pos : 3 - pos]!;
    const seed = wave + 1;
    for (const id of slot.ids) {
      bids.push({ teamId: id, seed, region, path: pathOf(id), playIn: slot.playIn });
    }
  });
  const seen = new Set(bids.map((b) => b.teamId));
  for (const id of fieldIds) {
    if (seen.has(id)) continue;
    const region = REGIONS[bids.length % REGIONS.length]!;
    bids.push({ teamId: id, seed: 16, region, path: pathOf(id), playIn: false });
    seen.add(id);
  }
  return bids;
}

function addSlot(week: number, homeId: string, awayId: string, kind: GameSlot["kind"], id: string): GameSlot {
  return { id, week, homeId, awayId, site: "neutral", kind };
}

function ctPrefix(conf: ConferenceId) {
  return `ct-${conf}-`;
}

function startUserTourney(state: GameState, rng: Rng): GameState {
  const conf = state.teams[state.playerTeamId]!.conference;
  if (!conferencePlaysLeague(conf)) {
    return { ...state, selection: { ...emptyBoard(), ...state.selection } };
  }
  if (state.schedule.some((g) => g.kind === "conf-tourney" && g.id.startsWith(ctPrefix(conf)))) {
    return advanceUserTourney(state);
  }
  let field = confOrder(state, conf).map((t) => t.id);
  if (field.length > 8) field = field.slice(0, 8);
  if (field.length < 2) {
    const board = { ...emptyBoard(), ...state.selection, autos: { ...state.selection?.autos, [conf]: field[0] ?? state.playerTeamId } };
    return { ...state, selection: board };
  }
  const size = nextPow2(field.length);
  const week = Math.max(state.week + 1, 19);
  const slots: GameSlot[] = [];
  for (let i = 0; i < size / 2; i++) {
    const a = field[i];
    const b = field[size - 1 - i];
    if (!a || !b) continue;
    slots.push(addSlot(week, a, b, "conf-tourney", `${ctPrefix(conf)}${week}-${i}`));
  }
  if (!slots.length) {
    const { state: s, winner } = knockout(state, field, rng);
    const board = { ...emptyBoard(), ...s.selection, autos: { ...s.selection?.autos, [conf]: winner }, confTourney: winner, confField: field };
    return { ...s, selection: board };
  }
  const league = leagueName(conf, state.season);
  return withNews(
    {
      ...state,
      phase: "conference",
      week,
      schedule: [...state.schedule, ...slots],
      recruitingHours: WEEK_HOURS,
      selection: { ...emptyBoard(), ...state.selection, confField: field },
    },
    item(week, `${league} tournament tips this week.`),
  );
}

function tourneySlotMap(state: GameState, conf: ConferenceId, stopBeforeId?: string) {
  const frozen = state.selection?.confField?.filter(Boolean);
  let field = frozen?.length ? frozen.slice() : confOrder(state, conf).map((t) => t.id);
  if (field.length > 8) field = field.slice(0, 8);
  const map = new Map<number, string>();
  field.forEach((id, i) => map.set(i, id));
  const played = state.schedule
    .filter((g) => g.kind === "conf-tourney" && g.id.startsWith(ctPrefix(conf)) && g.resultId)
    .sort((a, b) => a.week - b.week);
  for (const g of played) {
    if (stopBeforeId && g.id === stopBeforeId) break;
    const r = state.results.find((x) => x.id === g.resultId);
    if (!r) continue;
    const winner = r.homeScore > r.awayScore ? r.homeId : r.awayId;
    let hs = -1;
    let as = -1;
    for (const [slot, id] of map) {
      if (id === g.homeId) hs = slot;
      if (id === g.awayId) as = slot;
    }
    if (hs < 0 || as < 0) continue;
    map.set(Math.min(hs, as), winner);
    map.delete(Math.max(hs, as));
  }
  return map;
}

/** Teams still alive in the user's conference tournament before this game was played. Two means the final. */
export function confAliveBefore(state: GameState, slotId: string): number | null {
  const conf = state.teams[state.playerTeamId]?.conference;
  if (!conf) return null;
  const slot = state.schedule.find((g) => g.id === slotId);
  if (!slot || slot.kind !== "conf-tourney" || !slot.id.startsWith(ctPrefix(conf))) return null;
  return tourneySlotMap(state, conf, slotId).size;
}

function advanceUserTourney(state: GameState): GameState {
  const conf = state.teams[state.playerTeamId]!.conference;
  const open = state.schedule.filter((g) => g.kind === "conf-tourney" && g.id.startsWith(ctPrefix(conf)) && !g.resultId && !g.declined);
  if (open.length) return { ...state, week: open[0]!.week, phase: "conference" };
  const map = tourneySlotMap(state, conf);
  const alive = [...map.entries()].sort((a, b) => a[0] - b[0]);
  if (alive.length <= 1) {
    const champ = alive[0]?.[1] ?? state.playerTeamId;
    const board = { ...emptyBoard(), ...state.selection, autos: { ...state.selection?.autos, [conf]: champ }, confTourney: champ };
    return { ...state, selection: board };
  }
  const played = state.schedule.filter((g) => g.kind === "conf-tourney" && g.id.startsWith(ctPrefix(conf)) && g.resultId);
  const lastWeek = played.length ? Math.max(...played.map((g) => g.week)) : state.week;
  const week = lastWeek + 1;
  const rs = nextPow2(alive.length);
  const slots: GameSlot[] = [];
  for (let i = 0; i < rs / 2; i++) {
    const a = map.get(i);
    const b = map.get(rs - 1 - i);
    if (!a || !b) continue;
    slots.push(addSlot(week, a, b, "conf-tourney", `${ctPrefix(conf)}${week}-${i}`));
  }
  if (!slots.length) {
    const champ = alive[0]![1];
    const board = { ...emptyBoard(), ...state.selection, autos: { ...state.selection?.autos, [conf]: champ }, confTourney: champ };
    return { ...state, selection: board };
  }
  return { ...state, phase: "conference", week, schedule: [...state.schedule, ...slots] };
}

function selectionSunday(state: GameState): GameState {
  const ncaa = seedField(state, state.selection?.autos ?? {});
  const inNcaa = new Set(ncaa.map((b) => b.teamId));
  const rest = rankTeams(state).filter((t) => !inNcaa.has(t.id));
  const nit = rest.slice(0, 32).map((t) => t.id);
  const crown = rest.slice(32, 48).map((t) => t.id);
  const board: SelectionBoard = {
    ...emptyBoard(),
    autos: state.selection?.autos ?? {},
    ncaa,
    nit,
    crown,
    revealed: false,
  };
  return ensureSelectionArchive(withNews(
    { ...state, selection: board, phase: "selection" },
    item(state.week, `${SELECTION_SUNDAY}. The committee has set the field of 68.`, "even"),
    item(state.week, `68 in the ${NCAA}. ${Object.keys(board.autos).length} auto bids, ${ncaa.filter((b) => b.path === "at-large").length} at-large.`),
  ));
}

export function revealSelection(state: GameState): GameState {
  const sel = state.selection;
  if (!sel?.ncaa.length) return state;
  if (sel.revealed) return { ...state, selection: { ...sel, revealed: true } };
  const you = sel.ncaa.find((b) => b.teamId === state.playerTeamId);
  const youNit = sel.nit.includes(state.playerTeamId);
  const youCrown = sel.crown.includes(state.playerTeamId);
  const path = you
    ? `${you.seed} seed, ${you.region}, ${you.path === "auto" ? "auto bid" : "at-large"}${you.playIn ? `, ${FIRST_FOUR}` : ""}`
    : youNit
      ? NIT
      : youCrown
        ? CBI
        : "outside the field";
  const tone: NewsTone = you ? "good" : youNit || youCrown ? "even" : "bad";
  return withNews(
    { ...state, selection: { ...sel, revealed: true } },
    item(state.week, `${SELECTION_SUNDAY}: ${TEAM_BY_ID[state.playerTeamId]?.name} — ${path}.`, tone),
  );
}

function startNcaa(state: GameState): GameState {
  const ncaa = state.selection?.ncaa ?? [];
  const week = Math.max(state.week + 1, 22);
  const groups = new Map<string, NcaaBid[]>();
  for (const b of ncaa.filter((x) => x.playIn)) {
    const key = `${b.region}-${b.seed}`;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  const slots: GameSlot[] = [];
  for (const [key, teams] of groups) {
    if (teams.length < 2) continue;
    slots.push(addSlot(week, teams[0]!.teamId, teams[1]!.teamId, "ncaa", `ncaa-ff-${key}`));
  }
  if (!slots.length) return buildRound64(state, ncaa, week);
  return { ...state, phase: "ncaa", week, schedule: [...state.schedule, ...slots] };
}

function buildRound64(state: GameState, ncaa: NcaaBid[], week: number): GameState {
  const ff = state.schedule.filter((g) => g.id.startsWith("ncaa-ff-") && g.resultId);
  const out = new Set<string>();
  for (const g of ff) {
    const r = state.results.find((x) => x.id === g.resultId);
    if (!r) continue;
    out.add(r.homeScore > r.awayScore ? r.awayId : r.homeId);
  }
  const alive = ncaa.filter((b) => !out.has(b.teamId));
  const slots: GameSlot[] = [];
  for (const region of REGIONS) {
    const bySeed = new Map<number, string>();
    for (const b of alive.filter((x) => x.region === region)) {
      if (!bySeed.has(b.seed)) bySeed.set(b.seed, b.teamId);
    }
    PAIR_64.forEach(([hi, lo]) => {
      const a = bySeed.get(hi);
      const b = bySeed.get(lo);
      if (!a || !b) return;
      slots.push(addSlot(week, a, b, "ncaa", `ncaa-64-${region}-${hi}`));
    });
  }
  return { ...state, phase: "ncaa", week, schedule: [...state.schedule, ...slots] };
}

function ncaaOpen(state: GameState) {
  return state.schedule.filter((g) => g.kind === "ncaa" && !g.resultId && !g.declined);
}

function winnersOfPrefix(state: GameState, prefix: string) {
  return state.schedule.filter((g) => g.id.startsWith(prefix) && g.resultId).map((g) => {
    const r = state.results.find((x) => x.id === g.resultId)!;
    return r.homeScore > r.awayScore ? r.homeId : r.awayId;
  });
}

function advanceNcaa(state: GameState): GameState {
  const open = ncaaOpen(state);
  if (open.length) return { ...state, week: open[0]!.week, phase: "ncaa" };
  if (state.schedule.some((g) => g.id.startsWith("ncaa-ff-")) && !state.schedule.some((g) => g.id.startsWith("ncaa-64-"))) {
    return buildRound64(state, state.selection?.ncaa ?? [], state.week + 1);
  }
  const rounds: { prefix: string; next: string; need: number }[] = [
    { prefix: "ncaa-64-", next: "ncaa-32-", need: 32 },
    { prefix: "ncaa-32-", next: "ncaa-16-", need: 16 },
    { prefix: "ncaa-16-", next: "ncaa-8-", need: 8 },
    { prefix: "ncaa-8-", next: "ncaa-f4-", need: 4 },
    { prefix: "ncaa-f4-", next: "ncaa-title-", need: 2 },
  ];
  for (const r of rounds) {
    const played = state.schedule.filter((g) => g.id.startsWith(r.prefix) && g.resultId);
    if (!played.length || played.length < r.need || state.schedule.some((g) => g.id.startsWith(r.next))) continue;
    const winners = winnersOfPrefix(state, r.prefix);
    const week = state.week + 1;
    const slots: GameSlot[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      const a = winners[i];
      const b = winners[i + 1];
      if (!a || !b) continue;
      slots.push(addSlot(week, a, b, "ncaa", `${r.next}${i}`));
    }
    if (!slots.length) continue;
    return { ...state, phase: "ncaa", week, schedule: [...state.schedule, ...slots] };
  }
  const title = state.schedule.find((g) => g.id.startsWith("ncaa-title-") && g.resultId);
  if (title) {
    const r = state.results.find((x) => x.id === title.resultId)!;
    const champ = r.homeScore > r.awayScore ? r.homeId : r.awayId;
    const board = { ...emptyBoard(), ...state.selection, champ };
    const tone: NewsTone = champ === state.playerTeamId ? "good" : "even";
    return startNit(withNews({ ...state, selection: board }, item(state.week, `${TEAM_BY_ID[champ]?.name} wins the ${NCAA}.`, tone)));
  }
  return startNit(state);
}

function startNit(state: GameState): GameState {
  const nit = state.selection?.nit ?? [];
  if (!nit.length) return startCrown(state);
  if (state.schedule.some((g) => g.kind === "nit")) return advanceKo(state, "nit", ["nit-32-", "nit-16-", "nit-8-", "nit-4-", "nit-title-"]);
  const week = state.week + 1;
  const slots: GameSlot[] = [];
  for (let i = 0; i + 1 < nit.length; i += 2) {
    slots.push(addSlot(week, nit[i]!, nit[i + 1]!, "nit", `nit-32-${i}`));
  }
  return withNews(
    { ...state, phase: "nit", week, schedule: [...state.schedule, ...slots] },
    item(week, `The ${NIT} field is set.`),
  );
}

function advanceKo(state: GameState, kind: "nit" | "crown", prefixes: string[]): GameState {
  if (!state.schedule.some((g) => g.kind === kind)) {
    return kind === "nit" ? startNit(state) : startCrown(state);
  }
  const open = state.schedule.filter((g) => g.kind === kind && !g.resultId && !g.declined);
  if (open.length) return { ...state, week: open[0]!.week, phase: kind };
  for (let i = 0; i < prefixes.length - 1; i++) {
    const cur = prefixes[i]!;
    const next = prefixes[i + 1]!;
    const played = state.schedule.filter((g) => g.id.startsWith(cur) && g.resultId);
    if (!played.length || state.schedule.some((g) => g.id.startsWith(next))) continue;
    const winners = winnersOfPrefix(state, cur);
    if (winners.length < 2) continue;
    const week = state.week + 1;
    const slots: GameSlot[] = [];
    for (let j = 0; j < winners.length; j += 2) {
      if (!winners[j + 1]) continue;
      slots.push(addSlot(week, winners[j]!, winners[j + 1]!, kind, `${next}${j}`));
    }
    if (slots.length) return { ...state, phase: kind, week, schedule: [...state.schedule, ...slots] };
  }
  const last = prefixes[prefixes.length - 1]!;
  const final = state.schedule.find((g) => g.id.startsWith(last) && g.resultId);
  if (final) {
    const r = state.results.find((x) => x.id === final.resultId)!;
    const champ = r.homeScore > r.awayScore ? r.homeId : r.awayId;
    const board = { ...emptyBoard(), ...state.selection };
    if (kind === "nit") board.nitChamp = champ;
    else board.crownChamp = champ;
    const label = kind === "nit" ? NIT : CBI;
    const tone: NewsTone = champ === state.playerTeamId ? "good" : "even";
    const next = withNews({ ...state, selection: board }, item(state.week, `${TEAM_BY_ID[champ]?.name} wins the ${label}.`, tone));
    return kind === "nit" ? startCrown(next) : enterOffseason(next);
  }
  return kind === "nit" ? startCrown(state) : enterOffseason(state);
}

function startCrown(state: GameState): GameState {
  const crown = state.selection?.crown ?? [];
  if (!crown.length) return enterOffseason(state);
  if (state.schedule.some((g) => g.kind === "crown")) return advanceKo(state, "crown", ["crown-16-", "crown-8-", "crown-4-", "crown-title-"]);
  const week = state.week + 1;
  const slots: GameSlot[] = [];
  for (let i = 0; i + 1 < Math.min(16, crown.length); i += 2) {
    slots.push(addSlot(week, crown[i]!, crown[i + 1]!, "crown", `crown-16-${i}`));
  }
  return withNews(
    { ...state, phase: "crown", week, schedule: [...state.schedule, ...slots] },
    item(week, `The ${CBI} field is set.`),
  );
}

export function continuePostseason(state: GameState): GameState {
  const leftover = state.schedule.filter((g) => !g.resultId && !g.declined);
  if (leftover.length) {
    const next = leftover.sort((a, b) => a.week - b.week)[0]!;
    const phase =
      next.kind === "conf-tourney" ? "conference" as const :
      next.kind === "ncaa" ? "ncaa" as const :
      next.kind === "nit" ? "nit" as const :
      next.kind === "crown" ? "crown" as const :
      state.phase;
    return { ...state, week: next.week, phase };
  }

  const rng = mulberry32(state.seed ^ (state.season * 9091) ^ state.results.length);
  const userConf = state.teams[state.playerTeamId]!.conference;
  let s = state;
  let board = { ...emptyBoard(), ...s.selection };

  for (const c of CONFERENCES) {
    if (!conferencePlaysLeague(c.id)) continue;
    if (c.id === userConf || board.autos[c.id]) continue;
    const field = confOrder(s, c.id).map((t) => t.id);
    if (field.length < 2) continue;
    const cut = field.length > 8 ? field.slice(0, 8) : field;
    const k = knockout(s, cut, rng);
    s = k.state;
    board = { ...emptyBoard(), ...s.selection, autos: { ...board.autos, ...s.selection?.autos, [c.id]: k.winner } };
    s = { ...s, selection: board };
  }

  if (!conferencePlaysLeague(userConf)) {
    /* independents go at-large */
  } else if (!board.autos[userConf]) {
    const started = s.schedule.some((g) => g.kind === "conf-tourney" && g.id.startsWith(ctPrefix(userConf)));
    s = started ? advanceUserTourney(s) : startUserTourney(s, rng);
    board = { ...emptyBoard(), ...s.selection };
    if (!board.autos[userConf]) return s;
  }

  if (!board.ncaa.length) return selectionSunday(s);
  if (s.phase === "selection") return startNcaa(revealSelection(s));
  if (!s.selection?.champ) return advanceNcaa(s);
  if (!s.selection?.nitChamp && (s.selection?.nit.length ?? 0) > 0) {
    return advanceKo(s, "nit", ["nit-32-", "nit-16-", "nit-8-", "nit-4-", "nit-title-"]);
  }
  if (!s.selection?.crownChamp && (s.selection?.crown.length ?? 0) > 0) {
    return advanceKo(s, "crown", ["crown-16-", "crown-8-", "crown-4-", "crown-title-"]);
  }
  return enterOffseason(s);
}

export function fieldForView(state: GameState): NcaaBid[] {
  if (state.selection?.ncaa.length) return state.selection.ncaa;
  return projectedField(state);
}
