import type { GameState, PipelineBook, Pos, Recruit } from "./types";
import { TEAM_BY_ID } from "./teams";
import { yourRivals } from "./rivalry";
import { signFloor } from "./league";
import { clamp } from "./rng";

const TOUCH = { scout: 2, offer: 3, visit: 4 } as const;

export function emptyPipeline(): PipelineBook {
  return { states: {}, ties: {} };
}

export function pipelineBookOf(state: GameState): PipelineBook {
  const raw = state.pipelineBook;
  return {
    states: raw?.states && typeof raw.states === "object" ? { ...raw.states } : {},
    ties: raw?.ties && typeof raw.ties === "object" ? { ...raw.ties } : {},
  };
}

/** In-state pipeline plus relationship memory. Bond is only yours. */
export function memoryBump(state: GameState, teamId: string, r: Pick<Recruit, "state" | "country">): { pipe: number; bond: number } {
  const school = TEAM_BY_ID[teamId];
  if (!school) return { pipe: 0, bond: 0 };
  const yours = teamId === state.playerTeamId;
  const home = Boolean(r.state && r.state === school.state);
  const book = pipelineBookOf(state);
  const signs = yours && home && r.state ? book.states[r.state] ?? 0 : 0;
  const pipe = home ? Math.min(16, 8 + signs * 2) : r.country && r.country !== "US" ? 2 : 0;
  const ties = yours && r.state ? book.ties[r.state] ?? 0 : 0;
  const bond = Math.min(8, Math.floor(ties / 4));
  return { pipe, bond };
}

export function classPressure(state: GameState, pos: Pos): { count: number; penalty: number } {
  const you = state.playerTeamId;
  const count = state.recruits.filter((r) => r.committedTo === you && r.pos === pos).length;
  const penalty = count >= 3 ? 12 : count >= 2 ? 6 : 0;
  return { count, penalty };
}

export function classShape(state: GameState): { pos: Pos; count: number; penalty: number }[] {
  return (["PG", "SG", "SF", "PF", "C"] as Pos[]).map((pos) => ({ pos, ...classPressure(state, pos) }));
}

export function classShapeLine(state: GameState): string {
  const rows = classShape(state);
  const any = rows.some((r) => r.count > 0);
  if (!any) return "No commits yet. Two players at one position is fine. A third makes it harder to pitch that spot.";
  return `Class: ${rows
    .map((r) => `${r.pos} ${r.count}${r.penalty ? ` (crowded)` : ""}`)
    .join(", ")}.`;
}

export function rivalBattle(state: GameState, r: Recruit, yours: number): { name: string; penalty: number } | null {
  const rivals = new Set(yourRivals(state.playerTeamId).map((x) => x.oppId));
  let best: { id: string; n: number } | null = null;
  for (const [id, n] of Object.entries(r.interest ?? {})) {
    if (id === state.playerTeamId || !rivals.has(id) || !Number.isFinite(n)) continue;
    if (!best || n > best.n) best = { id, n: Math.round(n) };
  }
  if (!best || best.n < yours - 8) return null;
  const penalty = clamp(Math.round((best.n - yours + 8) / 2), 0, 10);
  if (penalty <= 0) return null;
  return { name: TEAM_BY_ID[best.id]?.name ?? "a rival", penalty };
}

export function signParts(r: Recruit, state: GameState, heat: number) {
  const you = state.playerTeamId;
  const offered = r.offers.includes(you);
  const visited = r.visits.includes(you);
  const offer = offered ? 8 : -28;
  const visit = visited ? 6 : r.stars >= 4 ? -8 : 0;
  const mem = memoryBump(state, you, r);
  const battle = rivalBattle(state, r, heat);
  const press = classPressure(state, r.pos);
  const rival = battle?.penalty ?? 0;
  const n = heat + offer + visit - rival - press.penalty;
  const floor = signFloor(state);
  const chance = clamp(Math.round(((n - (floor - 28)) / 62) * 100), offered ? 5 : 1, 96);
  return {
    chance,
    offer,
    visit,
    pipe: mem.pipe,
    bond: mem.bond,
    rival,
    rivalName: battle?.name ?? "",
    pressure: press.penalty,
    posCount: press.count,
  };
}

export function leanMathLine(r: Recruit, state: GameState, heat: number): string {
  const p = signParts(r, state, heat);
  const bits = [`Interest ${heat}`];
  if (p.pipe || p.bond) bits.push(`includes pipeline +${p.pipe}${p.bond ? ` and bond +${p.bond}` : ""}`);
  bits.push(`offer ${p.offer > 0 ? `+${p.offer}` : p.offer}`);
  if (p.visit) bits.push(`visit ${p.visit > 0 ? `+${p.visit}` : p.visit}`);
  if (p.rival) bits.push(`rival battle ${p.rivalName} −${p.rival}`);
  if (p.pressure) bits.push(`${r.pos} class pressure −${p.pressure}`);
  return `${bits.join(". ")}. Asking this week is a ${p.chance}% roll.`;
}

export function pipelineMemoryLine(state: GameState): string {
  const home = TEAM_BY_ID[state.playerTeamId]?.state;
  if (!home) return "Pipeline starts once the school has a home state.";
  const book = pipelineBookOf(state);
  const signs = book.states[home] ?? 0;
  const ties = book.ties[home] ?? 0;
  const bond = Math.min(8, Math.floor(ties / 4));
  const warm = bond ? ` Pipeline bonus +${bond}.` : "";
  return signs
    ? `${signs} previous in-state signee${signs === 1 ? "" : "s"} from ${home}.${warm}`
    : `No in-state signees yet from ${home}.${warm}`;
}

export function noteTouch(state: GameState, recruit: Pick<Recruit, "state">, kind: keyof typeof TOUCH): GameState {
  const st = recruit.state;
  if (!st) return state;
  const book = pipelineBookOf(state);
  const ties = { ...book.ties, [st]: Math.min(48, (book.ties[st] ?? 0) + TOUCH[kind]) };
  return { ...state, pipelineBook: { ...book, ties } };
}

export function rememberSigns(before: GameState, after: GameState): GameState {
  const you = after.playerTeamId;
  const wasIn = new Set(before.recruits.filter((r) => r.committedTo === you).map((r) => r.id));
  const school = TEAM_BY_ID[you];
  const book = pipelineBookOf(after);
  const states = { ...book.states };
  let changed = false;
  for (const r of after.recruits) {
    if (r.committedTo !== you || wasIn.has(r.id)) continue;
    if (!r.state || r.state !== school?.state) continue;
    states[r.state] = Math.min(8, (states[r.state] ?? 0) + 1);
    changed = true;
  }
  return changed ? { ...after, pipelineBook: { ...book, states } } : after;
}

export function absorbBoard(before: GameState, after: GameState): GameState {
  const you = after.playerTeamId;
  const prev = new Map(before.recruits.map((r) => [r.id, r]));
  let next = after;
  for (const r of after.recruits) {
    const was = prev.get(r.id);
    if (!was) continue;
    if (!was.scouted && r.scouted) next = noteTouch(next, r, "scout");
    if (!was.offers.includes(you) && r.offers.includes(you)) next = noteTouch(next, r, "offer");
    if (!was.visits.includes(you) && r.visits.includes(you)) next = noteTouch(next, r, "visit");
  }
  return rememberSigns(before, next);
}
