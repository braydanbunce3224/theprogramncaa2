import type { GameSlot, GameState, NcaaBid } from "./types";
import { CONFERENCES, TEAM_BY_ID } from "./teams";
import { committeeScore, projectedField } from "./selection";
import { gamePossessions } from "./engine-util";
import { netReleaseWeek, weekDateLabel } from "./calendar";

export type RankKind = "ap" | "net" | "kenpom" | "league" | "places" | "bubble" | "sheet";
export type BracketOutlet = "espn" | "cbs";

type Loc = "home" | "away" | "neutral";

export interface ApRow {
  id: string;
  rank: number;
  wins: number;
  losses: number;
  points: number;
  first: number;
}

export interface KenpomRow {
  id: string;
  rank: number;
  wins: number;
  losses: number;
  conf: string;
  adjEM: number;
  adjO: number;
  adjORank: number;
  adjD: number;
  adjDRank: number;
  adjT: number;
  adjTRank: number;
  luck: number;
  luckRank: number;
  sosEM: number;
  sosRank: number;
  oppO: number;
  oppORank: number;
  oppD: number;
  oppDRank: number;
  ncsos: number;
  ncsosRank: number;
}

export interface NetRow {
  id: string;
  rank: number;
  prevRank: number;
  wins: number;
  losses: number;
  net: number;
  q1w: number;
  q1l: number;
  q2w: number;
  q2l: number;
  q3w: number;
  q3l: number;
  q4w: number;
  q4l: number;
  nonD1w: number;
  nonD1l: number;
  path: "auto" | "at-large" | null;
}

interface GameLine {
  oppId: string;
  won: boolean;
  loc: Loc;
  pf: number;
  pa: number;
  kind: string;
  week: number;
  poss: number;
  minutes: number;
}

function locOf(slot: { site?: string } | undefined, resultHomeId: string, teamId: string): Loc {
  if (slot?.site === "neutral") return "neutral";
  return resultHomeId === teamId ? "home" : "away";
}

function allLines(state: GameState, maxWeek = Infinity) {
  const m = new Map<string, GameLine[]>();
  for (const id of Object.keys(state.teams)) m.set(id, []);
  const slotById = new Map(state.schedule.map((g) => [g.id, g]));
  for (const r of state.results) {
    if (r.week > maxWeek) continue;
    const slot = slotById.get(r.slotId);
    const kind = slot?.kind ?? "noncon";
    const push = (id: string, home: boolean) => {
      m.get(id)!.push({
        oppId: home ? r.awayId : r.homeId,
        won: home ? r.homeScore > r.awayScore : r.awayScore > r.homeScore,
        loc: locOf(slot, r.homeId, id),
        pf: home ? r.homeScore : r.awayScore,
        pa: home ? r.awayScore : r.homeScore,
        kind,
        week: r.week,
        poss: gamePossessions(r.homeBox, r.awayBox, r.homeScore, r.awayScore),
        minutes: r.minutes ?? 40,
      });
    };
    push(r.homeId, true);
    push(r.awayId, false);
  }
  return m;
}

function ovr(state: GameState, id: string) {
  const r = state.players.filter((p) => p.teamId === id).sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  if (!r.length) return 70;
  return r.reduce((s, p) => s + p.ovr, 0) / r.length;
}

function avg(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((n, x) => n + x, 0) / xs.length;
}

function rankBy(ids: string[], value: (id: string) => number, higher = true) {
  const sorted = [...ids].sort((a, b) => (higher ? value(b) - value(a) : value(a) - value(b)));
  const m = new Map<string, number>();
  sorted.forEach((id, i) => m.set(id, i + 1));
  return m;
}

let memoKey = "";
let memoKp: KenpomRow[] | null = null;
let memoNet: NetRow[] | null = null;
let memoAp: ApRow[] | null = null;

function stamp(state: GameState) {
  return `${state.seed}:${state.playerTeamId}:${state.season}:${state.week}:${state.results.length}:${state.selection?.ncaa.length ?? 0}`;
}

export function kenpom(state: GameState): KenpomRow[] {
  const k = stamp(state);
  if (memoKp && memoKey === k) return memoKp;
  const lines = allLines(state);
  const ids = Object.keys(state.teams).filter((id) => !state.teams[id]?.guest);
  const MU = 100;
  const AVG_T = 67.3;
  const HCA = 1.4;
  const ITER = 18;
  const PRIOR_W = 3.5;
  const now = state.week;

  const priorO = new Map<string, number>();
  const priorD = new Map<string, number>();
  const priorT = new Map<string, number>();
  const adjO = new Map<string, number>();
  const adjD = new Map<string, number>();
  const adjT = new Map<string, number>();
  for (const id of ids) {
    const em = (ovr(state, id) - 70) * 1.35;
    const o = MU + em * 0.55;
    const d = MU - em * 0.45;
    priorO.set(id, o);
    priorD.set(id, d);
    priorT.set(id, AVG_T);
    adjO.set(id, o);
    adjD.set(id, d);
    adjT.set(id, AVG_T);
  }

  const recency = (week: number) => Math.pow(0.94, Math.max(0, now - week));

  for (let it = 0; it < ITER; it++) {
    const nextO = new Map<string, number>();
    const nextD = new Map<string, number>();
    const nextT = new Map<string, number>();
    for (const id of ids) {
      const games = lines.get(id) ?? [];
      let nO = (priorO.get(id) ?? MU) * PRIOR_W;
      let dO = PRIOR_W;
      let nD = (priorD.get(id) ?? MU) * PRIOR_W;
      let dD = PRIOR_W;
      let nT = (priorT.get(id) ?? AVG_T) * PRIOR_W;
      let dT = PRIOR_W;
      for (const g of games) {
        const w = recency(g.week);
        const poss = Math.max(40, g.poss);
        const rawO = (g.pf / poss) * 100;
        const rawD = (g.pa / poss) * 100;
        const hcaO = g.loc === "home" ? HCA : g.loc === "away" ? -HCA : 0;
        const hcaD = g.loc === "home" ? -HCA : g.loc === "away" ? HCA : 0;
        const oppD = adjD.get(g.oppId) ?? MU;
        const oppO = adjO.get(g.oppId) ?? MU;
        const oppT = adjT.get(g.oppId) ?? AVG_T;
        nO += (rawO - hcaO - (oppD - MU)) * w;
        dO += w;
        nD += (rawD - hcaD - (oppO - MU)) * w;
        dD += w;
        const rawT = (poss * 40) / Math.max(40, g.minutes);
        nT += (2 * rawT - oppT) * w;
        dT += w;
      }
      nextO.set(id, nO / dO);
      nextD.set(id, nD / dD);
      nextT.set(id, nT / dT);
    }
    let sO = 0;
    let sD = 0;
    let sT = 0;
    for (const id of ids) {
      sO += nextO.get(id)!;
      sD += nextD.get(id)!;
      sT += nextT.get(id)!;
    }
    const mO = sO / ids.length;
    const mD = sD / ids.length;
    const mT = sT / ids.length;
    for (const id of ids) {
      adjO.set(id, nextO.get(id)! - mO + MU);
      adjD.set(id, nextD.get(id)! - mD + MU);
      adjT.set(id, nextT.get(id)! - mT + AVG_T);
    }
  }

  const luckOf = (id: string) => {
    const t = state.teams[id]!;
    const games = lines.get(id) ?? [];
    const gp = games.length;
    if (!gp) return 0;
    let exp = 0;
    for (const g of games) {
      const poss = Math.max(40, g.poss);
      const o = (g.pf / poss) * 100;
      const d = (g.pa / poss) * 100;
      const pO = o ** 10.25;
      const pD = d ** 10.25;
      exp += pO / (pO + pD + 1e-9);
    }
    return t.wins / gp - exp / gp;
  };
  const sosEM = (id: string) => {
    const gs = lines.get(id) ?? [];
    if (!gs.length) return 0;
    return avg(gs.map((g) => (adjO.get(g.oppId) ?? MU) - (adjD.get(g.oppId) ?? MU)));
  };
  const oppO = (id: string) => {
    const gs = lines.get(id) ?? [];
    if (!gs.length) return MU;
    return avg(gs.map((g) => adjO.get(g.oppId) ?? MU));
  };
  const oppD = (id: string) => {
    const gs = lines.get(id) ?? [];
    if (!gs.length) return MU;
    return avg(gs.map((g) => adjD.get(g.oppId) ?? MU));
  };
  const ncsos = (id: string) => {
    const gs = (lines.get(id) ?? []).filter((g) => g.kind !== "conference" && g.kind !== "conf-tourney");
    if (!gs.length) return sosEM(id);
    return avg(gs.map((g) => (adjO.get(g.oppId) ?? MU) - (adjD.get(g.oppId) ?? MU)));
  };

  const rO = rankBy(ids, (id) => adjO.get(id)!);
  const rD = rankBy(ids, (id) => adjD.get(id)!, false);
  const rT = rankBy(ids, (id) => adjT.get(id)!);
  const rL = rankBy(ids, luckOf);
  const rS = rankBy(ids, sosEM);
  const rSO = rankBy(ids, oppO);
  const rSD = rankBy(ids, oppD, false);
  const rN = rankBy(ids, ncsos);
  const rows: KenpomRow[] = ids.map((id) => {
    const t = state.teams[id]!;
    const o = adjO.get(id)!;
    const d = adjD.get(id)!;
    return {
      id,
      rank: 0,
      wins: t.wins,
      losses: t.losses,
      conf: confName(t.conference),
      adjEM: o - d,
      adjO: o,
      adjORank: rO.get(id)!,
      adjD: d,
      adjDRank: rD.get(id)!,
      adjT: adjT.get(id)!,
      adjTRank: rT.get(id)!,
      luck: luckOf(id),
      luckRank: rL.get(id)!,
      sosEM: sosEM(id),
      sosRank: rS.get(id)!,
      oppO: oppO(id),
      oppORank: rSO.get(id)!,
      oppD: oppD(id),
      oppDRank: rSD.get(id)!,
      ncsos: ncsos(id),
      ncsosRank: rN.get(id)!,
    };
  });
  rows.sort((a, b) => b.adjEM - a.adjEM || b.wins - a.wins);
  memoKey = k;
  memoKp = rows.map((row, i) => ({ ...row, rank: i + 1 }));
  memoNet = null;
  memoAp = null;
  return memoKp;
}

function quadOf(oppRank: number, loc: Loc): 1 | 2 | 3 | 4 {
  if (loc === "home") {
    if (oppRank <= 30) return 1;
    if (oppRank <= 75) return 2;
    if (oppRank <= 160) return 3;
    return 4;
  }
  if (loc === "neutral") {
    if (oppRank <= 50) return 1;
    if (oppRank <= 100) return 2;
    if (oppRank <= 200) return 3;
    return 4;
  }
  if (oppRank <= 75) return 1;
  if (oppRank <= 135) return 2;
  if (oppRank <= 240) return 3;
  return 4;
}

function buildNet(state: GameState, maxWeek: number) {
  const kp = kenpom(state);
  const seed = new Map(kp.map((r) => [r.id, r.rank]));
  const lines = allLines(state, maxWeek);
  const field = projectedField(state);
  const pathOf = new Map(field.map((b) => [b.teamId, b.path]));
  const rows = Object.keys(state.teams).filter((id) => !state.teams[id]?.guest).map((id) => {
    const t = state.teams[id]!;
    const games = lines.get(id) ?? [];
    const q = { 1: [0, 0], 2: [0, 0], 3: [0, 0], 4: [0, 0] } as Record<1 | 2 | 3 | 4, [number, number]>;
    for (const g of games) {
      const band = quadOf(seed.get(g.oppId) ?? 200, g.loc);
      if (g.won) q[band][0]++;
      else q[band][1]++;
    }
    const gp = t.wins + t.losses;
    const wp = gp ? t.wins / gp : 0.5;
    const pf = games.reduce((n, g) => n + g.pf, 0);
    const pa = games.reduce((n, g) => n + g.pa, 0);
    const em = games.length ? (pf - pa) / games.length : (ovr(state, id) - 70) * 0.4;
    const sos = games.length ? avg(games.map((g) => state.teams[g.oppId]?.prestige ?? 60)) : t.prestige;
    const q1 = q[1][0] * 3.4 - q[1][1] * 0.6;
    const q4 = q[4][0] * 0.2 - q[4][1] * 4.2;
    const road = games.filter((g) => g.loc !== "home" && g.won).length * 1.1;
    const net = wp * 42 + em * 1.35 + (sos - 64) * 0.55 + q1 + q4 + road + (ovr(state, id) - 70) * 0.35;
    return {
      id,
      rank: 0,
      prevRank: 0,
      wins: t.wins,
      losses: t.losses,
      net,
      q1w: q[1][0],
      q1l: q[1][1],
      q2w: q[2][0],
      q2l: q[2][1],
      q3w: q[3][0],
      q3l: q[3][1],
      q4w: q[4][0],
      q4l: q[4][1],
      nonD1w: 0,
      nonD1l: 0,
      path: pathOf.get(id) ?? null,
    } satisfies NetRow;
  });
  rows.sort((a, b) => b.net - a.net || b.wins - a.wins);
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function netRanks(state: GameState): NetRow[] {
  const k = stamp(state);
  if (memoNet && memoKey === k) return memoNet;
  // Full sample. Weeks before the public release stay in the math so the first board is not a one-week snapshot.
  const current = buildNet(state, Infinity);
  const release = netReleaseWeek(state.season);
  const priorBoard = state.phase === "regular" ? state.week > release : state.week > 1;
  let out: NetRow[];
  if (!priorBoard || !state.results.length) {
    out = current.map((r) => ({ ...r, prevRank: r.rank }));
  } else {
    const prev = buildNet(state, state.week - 1);
    const prevMap = new Map(prev.map((r) => [r.id, r.rank]));
    out = current.map((r) => ({ ...r, prevRank: prevMap.get(r.id) ?? r.rank }));
  }
  memoKey = k;
  memoNet = out;
  return out;
}

/** How many results the NET is built from. `beforeRelease` is every game dated before the first board. */
export function netFeed(state: GameState): { total: number; beforeRelease: number } {
  const release = netReleaseWeek(state.season);
  let beforeRelease = 0;
  for (const r of state.results) {
    if (r.week < release) beforeRelease++;
  }
  return { total: state.results.length, beforeRelease };
}

export function netBoardLine(state: GameState): string {
  const feed = netFeed(state);
  const open = weekDateLabel(state.season, 1);
  const prior =
    feed.beforeRelease > 0
      ? `${feed.beforeRelease} result${feed.beforeRelease === 1 ? "" : "s"} from before the release`
      : "no games before the release";
  const debut = state.phase === "regular" && state.week === netReleaseWeek(state.season);
  if (debut) return `First NET. Every game since ${open} is on this board, including ${prior}.`;
  return `Through week ${state.week} · ${feed.total} games · every result since ${open}, including ${prior}.`;
}

export function apPoll(state: GameState): ApRow[] {
  const k = stamp(state);
  if (memoAp && memoKey === k) return memoAp;
  const net = netRanks(state);
  const netOf = new Map(net.map((r) => [r.id, r.rank]));
  const lines = allLines(state);
  const scored = Object.keys(state.teams).filter((id) => !state.teams[id]?.guest).map((id) => {
    const t = state.teams[id]!;
    const n = netOf.get(id) ?? 200;
    const games = lines.get(id) ?? [];
    const qw = games.filter((g) => g.won && (netOf.get(g.oppId) ?? 200) <= 25).length;
    const recW = games.slice(-5).filter((g) => g.won).length;
    const brand = t.prestige * 0.9 + ovr(state, id) * 0.25;
    const score = brand + t.wins * 4.2 - t.losses * 2.6 + qw * 6.5 + recW * 1.8 - n * 0.08;
    return { id, score, wins: t.wins, losses: t.losses };
  });
  scored.sort((a, b) => b.score - a.score || b.wins - a.wins);
  const voters = 62;
  const rows = scored.map((row, i) => {
    const rank = i + 1;
    const share = Math.max(0.02, 1 - i * 0.031);
    const first = rank <= 8 ? Math.round(voters * share * (rank === 1 ? 0.55 : 0.12 / rank)) : 0;
    const points =
      rank <= 25
        ? Math.round((26 - rank) * voters * (0.92 + (row.score % 7) * 0.004))
        : rank <= 40
          ? Math.max(1, 22 - (rank - 25) * 2)
          : 0;
    return { id: row.id, rank, wins: row.wins, losses: row.losses, points, first };
  });
  memoKey = k;
  memoAp = rows;
  return rows;
}

export function espnField(state: GameState): NcaaBid[] {
  if (state.selection?.ncaa.length) return state.selection.ncaa;
  const ap = apPoll(state);
  const apRank = new Map(ap.map((r) => [r.id, r.rank]));
  return projectedField(state, (id) => committeeScore(state, id) + (80 - Math.min(80, apRank.get(id) ?? 80)) * 0.45);
}

export function cbsField(state: GameState): NcaaBid[] {
  if (state.selection?.ncaa.length) return state.selection.ncaa;
  const net = netRanks(state);
  const kp = kenpom(state);
  const n = new Map(net.map((r) => [r.id, r.rank]));
  const e = new Map(kp.map((r) => [r.id, r.adjEM]));
  return projectedField(state, (id) => (e.get(id) ?? 0) * 2.4 - (n.get(id) ?? 200) * 0.55 + committeeScore(state, id) * 0.25);
}

export function bubbleLists(state: GameState, field: NcaaBid[], order: { id: string; rank: number }[]) {
  const inField = new Set(field.map((b) => b.teamId));
  const als = field.filter((b) => b.path === "at-large").sort((a, b) => {
    const ra = order.find((r) => r.id === a.teamId)?.rank ?? 99;
    const rb = order.find((r) => r.id === b.teamId)?.rank ?? 99;
    return rb - ra;
  });
  const lastFourIn = als.slice(0, 4).map((b) => b.teamId);
  const out = order.filter((r) => !inField.has(r.id)).map((r) => r.id);
  return {
    lastFourIn,
    firstFourOut: out.slice(0, 4),
    nextFourOut: out.slice(4, 8),
    seedList: [...field.map((b) => b.teamId), ...out],
  };
}

export function teamLabel(id: string, mascot = false) {
  const t = TEAM_BY_ID[id];
  if (!t) return id;
  return mascot ? `${t.name} ${t.mascot}` : t.name;
}

export function recOf(state: GameState, id: string) {
  const t = state.teams[id];
  return t ? `${t.wins}-${t.losses}` : "";
}

export function confName(id: string) {
  return CONFERENCES.find((c) => c.id === id)?.short ?? id;
}

export function netCutoff(rows: NetRow[]) {
  const als = rows.filter((r) => r.path === "at-large");
  if (!als.length) return 68;
  return Math.max(...als.map((r) => r.rank));
}

export function gameQuad(state: GameState, slot: GameSlot, teamId: string): 1 | 2 | 3 | 4 | null {
  if (slot.declined) return null;
  const oppId = slot.homeId === teamId ? slot.awayId : slot.homeId;
  if (oppId === teamId) return null;
  const kp = kenpom(state);
  const rank = kp.find((r) => r.id === oppId)?.rank ?? 200;
  const loc: Loc = slot.site === "neutral" || slot.kind === "mte" || slot.kind === "ncaa" || slot.kind === "nit" || slot.kind === "crown" || slot.kind === "conf-tourney"
    ? "neutral"
    : slot.homeId === teamId
      ? "home"
      : "away";
  return quadOf(rank, loc);
}

export interface ResumeCard {
  teamId: string;
  net: number;
  kenpom: number;
  ap: number;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  sosRank: number;
  sos: number;
  seed: number | null;
  path: "auto" | "at-large" | "nit" | "out" | "bubble";
  need: string;
  quadNext: 1 | 2 | 3 | 4 | null;
}

export function resumeOf(state: GameState, teamId = state.playerTeamId): ResumeCard {
  const net = netRanks(state);
  const kp = kenpom(state);
  const ap = apPoll(state);
  const n = net.find((r) => r.id === teamId);
  const k = kp.find((r) => r.id === teamId);
  const a = ap.find((r) => r.id === teamId);
  const field = espnField(state);
  const bid = field.find((b) => b.teamId === teamId);
  const bubble = bubbleLists(state, field, net);
  const locked = Boolean(state.selection?.revealed && (state.selection.ncaa?.length ?? 0) > 0);
  let path: ResumeCard["path"] = "out";
  if (bid?.path === "auto") path = "auto";
  else if (bid?.path === "at-large") path = "at-large";
  else if (!locked && (bubble.firstFourOut.includes(teamId) || bubble.nextFourOut.includes(teamId))) path = "bubble";
  else if ((state.selection?.nit ?? []).includes(teamId)) path = "nit";
  const q1w = n?.q1w ?? 0;
  const q1l = n?.q1l ?? 0;
  const gamesLeft = state.schedule.filter((g) => !g.resultId && !g.declined && (g.homeId === teamId || g.awayId === teamId) && (g.kind === "conference" || g.kind === "noncon" || g.kind === "mte"));
  const next = gamesLeft.sort((x, y) => x.week - y.week)[0];
  const quadNext = next ? gameQuad(state, next, teamId) : null;
  let need = "Play the next game.";
  if (path === "auto") need = "Win the league and the bid is yours.";
  else if (path === "at-large" && (n?.rank ?? 99) <= 40) need = "You're in good shape. Don't drop a bad loss.";
  else if (path === "at-large") need = "A Quad 1 win would lock it. A Quad 4 loss would hurt.";
  else if (path === "bubble") need = q1w === 0 ? "You need a Quad 1 win." : "Win the games in front of you. A bad loss can knock you out.";
  else if (state.phase === "preseason" || (n?.wins ?? 0) + (n?.losses ?? 0) < 4) need = "Too early. Build the résumé.";
  else need = "The NCAA Tournament is a long shot. Win the league or stack quality wins.";
  return {
    teamId,
    net: n?.rank ?? 200,
    kenpom: k?.rank ?? 200,
    ap: a?.rank ?? 0,
    q1: `${q1w}-${q1l}`,
    q2: `${n?.q2w ?? 0}-${n?.q2l ?? 0}`,
    q3: `${n?.q3w ?? 0}-${n?.q3l ?? 0}`,
    q4: `${n?.q4w ?? 0}-${n?.q4l ?? 0}`,
    sosRank: k?.sosRank ?? 200,
    sos: k?.sosEM ?? 0,
    seed: bid?.seed ?? null,
    path,
    need,
    quadNext,
  };
}

/** One line for Gym, Selection Day, and the résumé once the field is locked. */
export function marchCall(state: GameState, teamId = state.playerTeamId): string {
  const sel = state.selection;
  const bid = sel?.ncaa?.find((b) => b.teamId === teamId);
  if (bid) return `${bid.seed} seed · ${bid.region}${bid.playIn ? " · Play-in" : ""}`;
  if (sel?.nit?.includes(teamId)) return "NIT";
  if (sel?.crown?.includes(teamId)) return "CBI";
  if (sel?.revealed && (sel.ncaa?.length ?? 0) > 0) return "Outside the field";
  const card = resumeOf(state, teamId);
  if (card.path === "auto" || card.path === "at-large") return card.seed ? `In as a ${card.seed}` : "In the field";
  if (card.path === "bubble") return "On the bubble";
  if (card.path === "nit") return "NIT";
  return "Outside the field";
}

export function remainingSos(state: GameState, teamId = state.playerTeamId) {
  const you = teamId;
  const left = state.schedule.filter((g) => !g.resultId && !g.declined && (g.homeId === you || g.awayId === you) && (g.kind === "conference" || g.kind === "noncon" || g.kind === "mte"));
  if (!left.length) return { n: 0, avg: 0, q1: 0, q2: 0, q3: 0, q4: 0 };
  const kp = kenpom(state);
  const rankOf = (id: string) => kp.find((r) => r.id === id)?.rank ?? 200;
  let q1 = 0, q2 = 0, q3 = 0, q4 = 0, sum = 0;
  for (const g of left) {
    const q = gameQuad(state, g, you);
    if (q === 1) q1++;
    else if (q === 2) q2++;
    else if (q === 3) q3++;
    else q4++;
    const opp = g.homeId === you ? g.awayId : g.homeId;
    sum += rankOf(opp);
  }
  return { n: left.length, avg: Math.round(sum / left.length), q1, q2, q3, q4 };
}

export interface SheetGame {
  week: number;
  loc: "H" | "A" | "N";
  oppId: string;
  rank: number;
  mine: number;
  theirs: number;
  won: boolean;
  ooc: boolean;
  left: boolean;
}

export interface SheetQuad {
  q: 1 | 2 | 3 | 4;
  title: string;
  cuts: string;
  record: string;
  home: string;
  away: string;
  neutral: string;
  ooc: string;
  left: number;
  games: SheetGame[];
  upcoming: SheetGame[];
}

export interface TeamSheetData {
  id: string;
  net: number;
  prev: number;
  kenpom: number;
  sos: number;
  oocSos: number;
  record: string;
  home: string;
  away: string;
  neutral: string;
  oppAvg: number;
  winAvg: number;
  lossAvg: number;
  quads: SheetQuad[];
}

const QUAD_META: { q: 1 | 2 | 3 | 4; title: string; cuts: string }[] = [
  { q: 1, title: "Quad 1", cuts: "Home 1–30 · Neutral 1–50 · Away 1–75" },
  { q: 2, title: "Quad 2", cuts: "Home 31–75 · Neutral 51–100 · Away 76–135" },
  { q: 3, title: "Quad 3", cuts: "Home 76–160 · Neutral 101–200 · Away 136–240" },
  { q: 4, title: "Quad 4", cuts: "Home 161+ · Neutral 201+ · Away 241+" },
];

function wl(rows: { won: boolean }[]) {
  return `${rows.filter((g) => g.won).length}-${rows.filter((g) => !g.won).length}`;
}

/** NET team sheet. Quadrant totals match the NET board. Rebuilt from current results. */
export function teamSheet(state: GameState, teamId: string): TeamSheetData | null {
  const t = state.teams[teamId];
  if (!t || t.guest) return null;
  const netRows = netRanks(state);
  const net = netRows.find((r) => r.id === teamId);
  const kp = kenpom(state);
  const kpOf = new Map(kp.map((r) => [r.id, r.rank]));
  const mine = kp.find((r) => r.id === teamId);
  const rankOf = (id: string) => kpOf.get(id) ?? 200;
  const lines = allLines(state).get(teamId) ?? [];
  const played = lines.map((g) => {
    const loc: SheetGame["loc"] = g.loc === "home" ? "H" : g.loc === "away" ? "A" : "N";
    return {
      week: g.week,
      loc,
      oppId: g.oppId,
      rank: rankOf(g.oppId),
      mine: g.pf,
      theirs: g.pa,
      won: g.won,
      ooc: g.kind !== "conference" && g.kind !== "conf-tourney",
      left: false,
      q: quadOf(rankOf(g.oppId), g.loc),
    };
  });
  const upcoming: (SheetGame & { q: 1 | 2 | 3 | 4 })[] = [];
  for (const g of state.schedule) {
    if (g.resultId || g.declined) continue;
    if (g.homeId !== teamId && g.awayId !== teamId) continue;
    if (g.kind !== "conference" && g.kind !== "noncon" && g.kind !== "mte" && g.kind !== "conf-tourney") continue;
    const oppId = g.homeId === teamId ? g.awayId : g.homeId;
    const q = gameQuad(state, g, teamId);
    if (!q) continue;
    const loc: SheetGame["loc"] = q && (g.site === "neutral" || g.kind === "mte" || g.kind === "conf-tourney")
      ? "N"
      : g.homeId === teamId
        ? "H"
        : "A";
    upcoming.push({
      week: g.week,
      loc,
      oppId,
      rank: rankOf(oppId),
      mine: 0,
      theirs: 0,
      won: false,
      ooc: g.kind !== "conference" && g.kind !== "conf-tourney",
      left: true,
      q,
    });
  }
  const quads = QUAD_META.map((meta) => {
    const games = played.filter((g) => g.q === meta.q).sort((a, b) => b.week - a.week || b.rank - a.rank);
    const soon = upcoming.filter((g) => g.q === meta.q).sort((a, b) => a.week - b.week);
    return {
      ...meta,
      record: wl(games),
      home: wl(games.filter((g) => g.loc === "H")),
      away: wl(games.filter((g) => g.loc === "A")),
      neutral: wl(games.filter((g) => g.loc === "N")),
      ooc: wl(games.filter((g) => g.ooc)),
      left: soon.length,
      games,
      upcoming: soon,
    };
  });
  const homeG = played.filter((g) => g.loc === "H");
  const awayG = played.filter((g) => g.loc === "A");
  const neutG = played.filter((g) => g.loc === "N");
  const wins = played.filter((g) => g.won);
  const losses = played.filter((g) => !g.won);
  const mean = (rows: { rank: number }[]) => (rows.length ? Math.round(avg(rows.map((g) => g.rank))) : 0);
  return {
    id: teamId,
    net: net?.rank ?? 200,
    prev: net?.prevRank ?? net?.rank ?? 200,
    kenpom: mine?.rank ?? 200,
    sos: mine?.sosRank ?? 200,
    oocSos: mine?.ncsosRank ?? 200,
    record: `${t.wins}-${t.losses}`,
    home: wl(homeG),
    away: wl(awayG),
    neutral: wl(neutG),
    oppAvg: mean(played),
    winAvg: mean(wins),
    lossAvg: mean(losses),
    quads,
  };
}
