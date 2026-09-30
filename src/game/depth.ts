import type {
  DraftPick, GameState, LiveGame, NewsArticle, Player, Pos, Potw, ProClass, Recruit, Transfer, WatchName,
} from "./types";
import { TEAM_BY_ID, TEAMS } from "./teams";
import { clamp, pick, type Rng, randInt } from "./rng";
import { brief } from "./wire";
import { settingsOf, prestigeGravity } from "./league";
import { draftScore } from "./college";
import { rememberSigns } from "./recruit-depth";

export const PRO_TEAMS = [
  { id: "bay", name: "Bay Reign", abbr: "BAY", city: "San Francisco" },
  { id: "harbor", name: "Harbor Steel", abbr: "HAR", city: "Seattle" },
  { id: "metro", name: "Metro Crowns", abbr: "MTR", city: "New York" },
  { id: "lake", name: "Lakefront", abbr: "LKE", city: "Chicago" },
  { id: "canyon", name: "Canyon Run", abbr: "CAN", city: "Phoenix" },
  { id: "delta", name: "Delta Kings", abbr: "DEL", city: "Memphis" },
  { id: "ridge", name: "Ridge Line", abbr: "RDG", city: "Denver" },
  { id: "sound", name: "Sound City", abbr: "SND", city: "Boston" },
  { id: "grove", name: "Grove Foxes", abbr: "GRV", city: "Atlanta" },
  { id: "iron", name: "Iron Works", abbr: "IRN", city: "Pittsburgh" },
  { id: "mesa", name: "Mesa Suns", abbr: "MES", city: "Las Vegas" },
  { id: "port", name: "Portside", abbr: "PRT", city: "Portland" },
  { id: "capitol", name: "Capitol", abbr: "CAP", city: "Washington" },
  { id: "gulf", name: "Gulf Stream", abbr: "GLF", city: "Miami" },
  { id: "plains", name: "Plains Fire", abbr: "PLN", city: "Oklahoma City" },
  { id: "twin", name: "Twin Cities", abbr: "TWN", city: "Minneapolis" },
  { id: "river", name: "River North", abbr: "RVR", city: "St. Louis" },
  { id: "park", name: "Park Slope", abbr: "PRK", city: "Brooklyn" },
  { id: "mission", name: "Mission", abbr: "MSN", city: "San Antonio" },
  { id: "orbit", name: "Orbit", abbr: "ORB", city: "Houston" },
  { id: "mill", name: "Mill City", abbr: "MLL", city: "Detroit" },
  { id: "coral", name: "Coral", abbr: "CRL", city: "Orlando" },
  { id: "pine", name: "Pine Belt", abbr: "PNE", city: "Charlotte" },
  { id: "salt", name: "Salt Flats", abbr: "SLT", city: "Salt Lake" },
  { id: "oak", name: "Oakland Rail", abbr: "OAK", city: "Oakland" },
  { id: "civic", name: "Civic", abbr: "CIV", city: "Philadelphia" },
  { id: "frontier", name: "Frontier", abbr: "FRN", city: "Dallas" },
  { id: "lumen", name: "Lumen", abbr: "LMN", city: "Los Angeles" },
  { id: "arc", name: "Arc Light", abbr: "ARC", city: "Sacramento" },
  { id: "north", name: "North Gate", abbr: "NTH", city: "Toronto" },
] as const;

export function proForPick(n: number) {
  return PRO_TEAMS[(Math.max(1, n) - 1) % PRO_TEAMS.length]!;
}

export function stampPro(p: DraftPick): DraftPick {
  const f = proForPick(p.pick);
  return { ...p, proId: f.id, proName: f.name };
}

export function mockBoard(state: GameState): DraftPick[] {
  const ranked = state.players
    .filter((p) => !p.redshirt && (p.year < 4 || p.ovr >= 82))
    .slice()
    .sort((a, b) => draftScore(b) - draftScore(a) || b.ovr - a.ovr)
    .slice(0, 60);
  return ranked.map((p, i) => stampPro({
    playerId: p.id,
    name: `${p.first} ${p.last}`,
    pos: p.pos,
    ovr: p.ovr,
    teamId: p.teamId,
    round: i < 30 ? 1 : 2,
    pick: i + 1,
    yours: p.teamId === state.playerTeamId,
  }));
}

export function closeProClass(state: GameState): GameState {
  const d = state.draft;
  if (!d) return state;
  const picks = d.league.slice().sort((a, b) => a.pick - b.pick).map(stampPro);
  const row: ProClass = { season: state.season, picks };
  const proHistory = [row, ...(state.proHistory ?? [])].slice(0, 40);
  return { ...state, draft: { ...d, league: picks }, proHistory };
}

export const FreakKinds = [
  { tag: "Point forward", pos: "PG" as Pos, height: "6-8", line: "6-8 point guard. Can post smaller guards and pass out of it.", bump: { finish: 8, iq: 4, shoot: -2, defense: 0 } },
  { tag: "Stretch five", pos: "C" as Pos, height: "6-11", line: "Center who can shoot. Not a rim runner.", bump: { shoot: 10, finish: -2, iq: 2, defense: -2 } },
  { tag: "Wing freak", pos: "SF" as Pos, height: "6-8", line: "6-8 wing. Scores and defends.", bump: { shoot: 4, finish: 4, defense: 4, iq: 2 } },
  { tag: "Rim prowler", pos: "PF" as Pos, height: "6-10", line: "Finishes at the rim. No jumper. Sets screens and fouls.", bump: { finish: 8, defense: 6, shoot: -6, iq: 0 } },
  { tag: "Lockdown two", pos: "SG" as Pos, height: "6-6", line: "Shooting guard who defends first. Can take the other team's best wing.", bump: { defense: 9, iq: 3, shoot: 1, finish: -2 } },
];

export function freakLine(tag?: string | null) {
  if (!tag) return "Rare body or skill that doesn't match the position.";
  return FreakKinds.find((k) => k.tag === tag)?.line ?? tag;
}

export const INTL = [
  { country: "AU", label: "Australia" },
  { country: "ES", label: "Spain" },
  { country: "FR", label: "France" },
  { country: "CA", label: "Canada" },
  { country: "NG", label: "Nigeria" },
  { country: "SN", label: "Senegal" },
  { country: "LT", label: "Lithuania" },
  { country: "GR", label: "Greece" },
  { country: "DE", label: "Germany" },
  { country: "HR", label: "Croatia" },
  { country: "RS", label: "Serbia" },
  { country: "BR", label: "Brazil" },
];

export function intlLabel(code?: string) {
  if (!code || code === "US") return null;
  return INTL.find((x) => x.country === code)?.label ?? code;
}

export function heightFor(pos: Pos, rng: Rng, freak?: boolean) {
  const base: Record<Pos, [number, number]> = {
    PG: [70, 75],
    SG: [73, 78],
    SF: [76, 81],
    PF: [79, 83],
    C: [81, 87],
  };
  let [lo, hi] = base[pos];
  if (freak && pos === "PG") hi = 80;
  const inCh = lo + Math.floor(rng() * (hi - lo + 1));
  return `${Math.floor(inCh / 12)}-${inCh % 12}`;
}

export function pipelineBonus(r: Recruit | Transfer, teamId: string): number {
  const school = TEAM_BY_ID[teamId];
  if (!school) return 0;
  const rec = r as Recruit;
  if (rec.state && rec.state === school.state) return 8;
  if (rec.country && rec.country !== "US") return 2;
  return 0;
}

export function winProb(live: LiveGame, youHome: boolean): number {
  const you = youHome ? live.homeScore : live.awayScore;
  const them = youHome ? live.awayScore : live.homeScore;
  const diff = you - them;
  // Clock is seconds (1200 = 20:00). The first half still has a full second half after it.
  const timeLeft = Math.max(0, live.clock) + (live.half === 1 ? 1200 : 0);
  const possLeft = Math.max(0.35, timeLeft / 18);
  const youBall = (live.poss === "home") === youHome;
  // Possession is about a point, and only inside the last ~40 seconds.
  const swing = (youBall ? 1 : -1) * Math.max(0, 1.15 * (1 - Math.min(1, timeLeft / 40)));
  const z = ((diff + swing) / Math.sqrt(possLeft)) * 0.85;
  const p = 1 / (1 + Math.exp(-z));
  return clamp(Math.round(p * 100), 1, 99);
}

/** Fixed score/clock checks. Empty array means the bands in ARCHITECTURE.md still hold. */
export function winProbBandFails(): string[] {
  const fails: string[] = [];
  const sample = (
    half: number,
    clock: number,
    you: number,
    them: number,
    poss: "home" | "away",
    lo: number,
    hi: number,
    name: string,
  ) => {
    const live = {
      slotId: "t",
      homeId: "home",
      awayId: "away",
      homeScore: you,
      awayScore: them,
      half,
      clock,
      poss,
      offCall: "motion",
      defCall: "man",
      log: [],
      done: false,
    } as LiveGame;
    const p = winProb(live, true);
    if (p < lo || p > hi) fails.push(`${name}: ${p}% not ${lo}–${hi}`);
  };
  sample(2, 1200, 40, 70, "away", 1, 12, "down 30 at half");
  sample(2, 9, 72, 70, "home", 88, 99, "up 2 with the ball at 0:09");
  sample(2, 4, 74, 70, "home", 95, 99, "up 4 with the ball at 0:04");
  sample(1, 1200, 0, 0, "home", 45, 55, "opening tip");
  return fails;
}

export function gameOfDay(state: GameState) {
  const week = state.week;
  const you = state.playerTeamId;
  const open = state.schedule.filter((g) => g.week === week && !g.resultId && !g.declined && g.homeId !== you && g.awayId !== you);
  if (!open.length) {
    const played = state.schedule.filter((g) => g.week === week && g.homeId !== you && g.awayId !== you);
    return played.sort(byPrestige)[0] ?? null;
  }
  return open.sort(byPrestige)[0] ?? null;
}

function byPrestige(a: { homeId: string; awayId: string }, b: { homeId: string; awayId: string }) {
  const pa = (TEAM_BY_ID[a.homeId]?.prestige ?? 50) + (TEAM_BY_ID[a.awayId]?.prestige ?? 50);
  const pb = (TEAM_BY_ID[b.homeId]?.prestige ?? 50) + (TEAM_BY_ID[b.awayId]?.prestige ?? 50);
  return pb - pa;
}

export function rollPotw(state: GameState): GameState {
  const week = state.week;
  const games = state.results.filter((r) => r.week === week);
  let best: { val: number; rec: { id: string; name: string; pts: number; reb: number; ast: number }; teamId: string } | null = null;
  for (const g of games) {
    const sides: Array<{ teamId: string; rows: NonNullable<typeof g.recap>["homeLeaders"] }> = [
      { teamId: g.homeId, rows: g.recap?.homeLeaders ?? [] },
      { teamId: g.awayId, rows: g.recap?.awayLeaders ?? [] },
    ];
    for (const side of sides) {
      for (const p of side.rows) {
        const val = p.pts + p.reb * 1.1 + p.ast * 1.5;
        if (!best || val > best.val) best = { val, rec: p, teamId: side.teamId };
      }
    }
  }
  if (!best) return state;
  const row: Potw = {
    week,
    season: state.season,
    playerId: best.rec.id,
    name: best.rec.name,
    teamId: best.teamId,
    line: `${best.rec.pts} / ${best.rec.reb} / ${best.rec.ast}`,
    yours: best.teamId === state.playerTeamId,
  };
  const news: NewsArticle = brief(
    week,
    `${row.name} is the national player of the week`,
    [`${row.line} against whoever was in front of him. The national writers put him on the list.`, row.yours ? "That's your guy." : `${TEAM_BY_ID[row.teamId]?.name ?? "A mid-major"} gets the clip.`],
    row.yours ? "good" : "even",
    "Awards",
  );
  return { ...state, potw: [row, ...(state.potw ?? [])].slice(0, 48), news: [news, ...state.news].slice(0, 60) };
}

export function preseasonWatch(state: Pick<GameState, "players" | "playerTeamId">, n = 12): WatchName[] {
  return state.players
    .filter((p) => !p.redshirt)
    .sort((a, b) => b.ovr - a.ovr || b.potential - a.potential)
    .slice(0, n)
    .map((p) => ({
      name: `${p.first} ${p.last}`,
      teamId: p.teamId,
      yours: p.teamId === state.playerTeamId,
      pos: p.pos,
      ovr: p.ovr,
    }));
}

export function awardRace(state: GameState, n = 8): { name: string; teamId: string; yours: boolean; score: number; ppg: number; games: number }[] {
  const pool = state.players.filter((p) => (p.seasonGames ?? 0) >= 1 && !p.redshirt);
  return pool
    .map((p) => {
      const games = Math.max(1, p.stats?.g || p.seasonGames || 1);
      const ppg = (p.stats?.pts ?? 0) / games;
      const rpg = (p.stats?.reb ?? 0) / games;
      const apg = (p.stats?.ast ?? 0) / games;
      const impact = ppg * 1.15 + rpg * 0.7 + apg * 0.9;
      const sample = Math.min(1, games / 8);
      return {
        name: `${p.first} ${p.last}`,
        teamId: p.teamId,
        yours: p.teamId === state.playerTeamId,
        score: impact * (0.45 + 0.55 * sample),
        ppg,
        games,
      };
    })
    .filter((r) => r.games < 8 || r.ppg >= 5 || r.score >= 8)
    .sort((a, b) => b.score - a.score || b.ppg - a.ppg)
    .slice(0, n);
}

export function weeklyTake(state: GameState, rng: Rng): GameState {
  const weekGames = state.results.filter((r) => r.week === state.week);
  const blow = weekGames.filter((r) => Math.abs(r.homeScore - r.awayScore) >= 18).sort((a, b) => Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore))[0];
  const nail = weekGames.filter((r) => Math.abs(r.homeScore - r.awayScore) <= 2)[0];
  const g = blow ?? nail ?? weekGames[Math.floor(rng() * weekGames.length)];
  if (!g) return state;
  const home = TEAM_BY_ID[g.homeId]?.name ?? "Home";
  const away = TEAM_BY_ID[g.awayId]?.name ?? "Away";
  const names = takeNames(state, g);
  const star = names[0];
  const take = blow
    ? `${home} blows out ${away} ${g.homeScore}-${g.awayScore}.${star ? ` ${star.name} led the way.` : ""}`
    : nail
      ? `${home} edges ${away} ${g.homeScore}-${g.awayScore}.${star ? ` ${star.name} had the last shot.` : ""}`
      : `${home} ${g.homeScore}, ${away} ${g.awayScore}.${star ? ` ${star.name} led all scorers.` : ""}`;
  return {
    ...state,
    news: [{ ...brief(state.week, "Around the country", [take], "even", "Takes"), names, resultId: g.id }, ...state.news].slice(0, 60),
  };
}

function takeNames(state: GameState, g: { homeId: string; awayId: string; recap?: { homeLeaders?: { name: string; id: string; pts: number }[]; awayLeaders?: { name: string; id: string; pts: number }[] } }): { name: string; id: string; kind: "player" }[] {
  const rec = g.recap;
  const leads = [...(rec?.homeLeaders ?? []), ...(rec?.awayLeaders ?? [])].sort((a, b) => b.pts - a.pts).slice(0, 3);
  if (leads.length) return leads.map((p) => ({ name: p.name, id: p.id, kind: "player" as const }));
  return state.players
    .filter((p) => p.teamId === g.homeId || p.teamId === g.awayId)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 2)
    .map((p) => ({ name: `${p.first} ${p.last}`, id: p.id, kind: "player" as const }));
}

export function tickFlips(state: GameState, rng: Rng): GameState {
  if (!settingsOf(state).flipsOn) return state;
  const you = state.playerTeamId;
  let flash = state.flash ?? null;
  let news = state.news;
  const g = prestigeGravity(state);
  const recruits = state.recruits.map((r) => {
    if (!r.committedTo) return r;
    const school = r.committedTo;
    const heat = r.interest[school] ?? 70;
    const rival = Object.entries(r.interest)
      .filter(([id]) => id !== school)
      .sort((a, b) => b[1] - a[1])[0];
    if (!rival) return r;
    const gap = rival[1] - heat;
    const brand = (TEAM_BY_ID[rival[0]]?.prestige ?? 60) - (TEAM_BY_ID[school]?.prestige ?? 60);
    const pFlip = clamp(0.02 + Math.max(0, gap) / 220 + Math.max(0, brand) / 400 * g, 0, 0.16);
    if (rng() < pFlip) {
      const from = TEAM_BY_ID[school]?.name ?? "campus";
      const to = TEAM_BY_ID[rival[0]]?.name ?? "a brand";
      if (school === you) {
        flash = { kind: "flip", name: `${r.first} ${r.last}`, stars: r.stars, pos: r.pos, detail: `Flipped from you to ${to}.` };
        news = [brief(state.week, `${r.first} ${r.last} flipped`, [`He was headed to you. Now it's ${to}.`], "bad", "Recruiting"), ...news].slice(0, 60);
      } else if (rival[0] === you) {
        flash = { kind: "flip", name: `${r.first} ${r.last}`, stars: r.stars, pos: r.pos, detail: `He left ${from} for you.` };
        news = [brief(state.week, `${r.first} ${r.last} is in`, [`He flipped from ${from}.`], "good", "Recruiting"), ...news].slice(0, 60);
      }
      return { ...r, committedTo: rival[0], flipped: true };
    }
    if (school === you && rng() < 0.012 * g) {
      flash = { kind: "decommit", name: `${r.first} ${r.last}`, stars: r.stars, pos: r.pos, detail: "He's back on the market. No new school yet." };
      news = [brief(state.week, `${r.first} ${r.last} decommitted`, ["He's back on the market. No new school yet."], "bad", "Recruiting"), ...news].slice(0, 60);
      return { ...r, committedTo: null };
    }
    return r;
  });
  return { ...state, recruits, news, flash: flash ?? state.flash ?? null };
}

export function tickDonors(state: GameState, rng: Rng): GameState {
  if (!settingsOf(state).nilOn) return { ...state, nilAsks: [] };
  const you = state.playerTeamId;
  const t = state.teams[you];
  const record = (t?.wins ?? 0) - (t?.losses ?? 0);
  const mood = clamp((state.donorMood ?? 58) + (record >= 6 ? 6 : record <= -4 ? -7 : 1), 20, 99);
  const gift = Math.round(8 + mood / 8 + Math.max(0, record));
  const donors = [...(state.donors ?? [])];
  donors.unshift({
    id: `don-${state.season}`,
    name: pick(rng, ["The collective", "A campus group", "An old letterman", "A downtown table"]),
    gift,
    season: state.season,
  });
  const alumni = (state.offseasonReport?.graduated ?? [])
    .filter((g) => g.ovr >= 82)
    .slice(0, 2)
    .map((g) => ({
      id: `al-${g.name}-${state.season}`,
      name: g.name,
      gift: Math.round(6 + (g.ovr - 80)),
      fromPlayerId: g.name,
      season: state.season,
    }));
  const nilCap = clamp(Math.round((state.nilCap || 100) * (0.92 + mood / 400) + gift * 0.4 + alumni.reduce((n, a) => n + a.gift, 0) * 0.3), 40, 180);
  const roster = state.players.filter((p) => p.teamId === you && !p.redshirt).sort((a, b) => b.ovr - a.ovr);
  const asks: { playerId: string; name: string; ask: number }[] = [];
  const hungry = roster.filter((p) => (p.morale ?? 70) < 62 || p.ovr >= 84);
  if (hungry[0] && rng() < 0.55) {
    const p = hungry[0];
    asks.push({ playerId: p.id, name: `${p.first} ${p.last}`, ask: randInt(rng, 8, 18) });
  }
  const news = brief(
    state.week,
    "The donors sat down",
    [
      `They're moving the pool ${gift >= 12 ? "up" : gift <= 6 ? "down" : "sideways"}. Cap sits at ${nilCap}.`,
      alumni[0] ? `${alumni[0].name} is writing checks now. That's the job — they leave and they still pay for the next one.` : "No old stars writing checks this year.",
    ],
    gift >= 12 ? "good" : gift <= 6 ? "bad" : "even",
    "NIL",
  );
  return {
    ...state,
    donorMood: mood,
    nilCap,
    donors: [...alumni, ...donors].slice(0, 24),
    nilAsks: asks,
    news: [news, ...state.news].slice(0, 60),
  };
}

export function answerNilAsk(state: GameState, playerId: string, yes: boolean): GameState {
  const ask = (state.nilAsks ?? []).find((a) => a.playerId === playerId);
  if (!ask || ask.resolved) return state;
  const nilAsks = (state.nilAsks ?? []).map((a) => (a.playerId === playerId ? { ...a, resolved: yes ? "yes" as const : "no" as const } : a));
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    return { ...p, morale: clamp(p.morale + (yes ? 8 : -10), 20, 99) };
  });
  const nilCap = yes ? Math.max(20, state.nilCap - ask.ask) : state.nilCap;
  return { ...state, nilAsks, players, nilCap };
}

export function searchPeople(state: GameState, q: string): { kind: "player" | "recruit" | "portal" | "team"; id: string; name: string; line: string }[] {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  const out: { kind: "player" | "recruit" | "portal" | "team"; id: string; name: string; line: string }[] = [];
  for (const t of TEAMS) {
    if (!(`${t.name} ${t.mascot} ${t.abbr} ${t.city}`).toLowerCase().includes(s) && t.id !== s) continue;
    const rt = state.teams[t.id];
    out.push({ kind: "team", id: t.id, name: t.name, line: `${t.abbr} · ${rt ? `${rt.wins}-${rt.losses}` : t.conference}` });
    if (out.length >= 8) break;
  }
  for (const p of state.players) {
    const name = `${p.first} ${p.last}`;
    if (!name.toLowerCase().includes(s) && p.pos.toLowerCase() !== s) continue;
    const school = TEAM_BY_ID[p.teamId]?.abbr ?? p.teamId;
    out.push({ kind: "player", id: p.id, name, line: `${p.pos} · ${school} · ${p.ovr} ovr` });
    if (out.length >= 24) return out;
  }
  for (const r of state.recruits) {
    const name = `${r.first} ${r.last}`;
    if (!name.toLowerCase().includes(s)) continue;
    out.push({ kind: "recruit", id: r.id, name, line: `${r.stars}★ ${r.pos} ${r.country && r.country !== "US" ? r.country : r.state}` });
    if (out.length >= 24) return out;
  }
  for (const t of state.portal?.transfers ?? []) {
    const name = `${t.first} ${t.last}`;
    if (!name.toLowerCase().includes(s)) continue;
    out.push({ kind: "portal", id: t.id, name, line: `${t.pos} · portal · ${t.ovr} ovr` });
    if (out.length >= 24) return out;
  }
  return out;
}

export function forceCommit(state: GameState, id: string): { state: GameState; ok: boolean; detail: string } {
  if (!settingsOf(state).godMode) return { state, ok: false, detail: "God Mode is off." };
  const r = state.recruits.find((x) => x.id === id);
  if (!r) return { state, ok: false, detail: "Gone." };
  const recruits = state.recruits.map((x) => (x.id === id ? { ...x, committedTo: state.playerTeamId, offers: x.offers.includes(state.playerTeamId) ? x.offers : [...x.offers, state.playerTeamId] } : x));
  return {
    ok: true,
    detail: `${r.first} ${r.last} is on the class.`,
    state: rememberSigns(state, {
      ...state,
      recruits,
      flash: { kind: "commit", name: `${r.first} ${r.last}`, stars: r.stars, pos: r.pos, detail: "God Mode. The pledge is in." },
    }),
  };
}

export function markCommit(state: GameState, r: Recruit, detail: string): GameState {
  return {
    ...state,
    flash: { kind: "commit", name: `${r.first} ${r.last}`, stars: r.stars, pos: r.pos, detail },
  };
}

export function playerAwardsOf(p: Player, state: GameState): string[] {
  const fromLists = (state.awards ?? []).filter((a) => a.playerId === p.id).map((a) => `${a.season} ${a.kind === "poy" ? "POY" : a.kind === "dpoy" ? "DPOY" : a.kind}`);
  return [...(p.awards ?? []), ...fromLists];
}

export function traitOf(p: { skills?: Player["skills"]; freak?: boolean; freakTag?: string; pos?: Pos }): string | null {
  if (p.freakTag) return p.freakTag;
  const s = p.skills;
  if (!s) return null;
  const rows: [string, number][] = [
    ["Sniper", s.shoot],
    ["Finisher", s.finish],
    ["Lock", s.defense],
    ["Maestro", s.iq],
  ];
  rows.sort((a, b) => b[1] - a[1]);
  const top = rows[0]!;
  const next = rows[1]!;
  if (top[1] >= 78 && top[1] >= next[1] + 4) return top[0];
  if (p.pos === "C" && s.shoot >= 72) return "Stretch";
  if (p.pos === "PG" && s.defense >= 74) return "Lead dog";
  return null;
}

export function fogTape(r: { stars: number; ovr: number; potential: number; scouted?: boolean; committedTo?: string | null }): string {
  if (r.scouted || r.committedTo) return `ovr ${r.ovr} · pot ${r.potential}`;
  if (r.stars >= 5) return "Blue-chip";
  if (r.stars >= 4) return "High-major";
  if (r.stars >= 3) return "Solid prospect";
  if (r.stars >= 2) return "Needs a look";
  return "Sleeper";
}
