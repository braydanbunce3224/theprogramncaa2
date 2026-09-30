import type { GameState, Player, RecruitWants } from "./types";
import { SAVE_VERSION } from "./types";
import { TEAM_BY_ID, teamOf } from "./teams";
import { settingsOf } from "./league";
import { pipelineMemoryLine } from "./recruit-depth";
import { recentErrors } from "./diag";

export const CHANGELOG = [
  "Box scores spread the shots. One player cannot take the whole team's offense.",
  "2-for-1 shows when you have the ball, ahead or tied, with 31–40 seconds left. God Mode can force that look.",
  "Practice (film, scrimmage, hard) bumps one player this week. The roster shows the +1.",
  "Archives keep prior champions, awards, conference tables, box scores, and retired numbers.",
  "Add a school on Pick a school. It stays on the board, the schedule, and the standings.",
  "Forced late-game finishes keep a real score. No more 6–1 finals.",
  "Resume from the gym. Commissioner room code for a local league file.",
  "100% free. No ads, no energy, no loot boxes. Optional tip in Settings.",
  "Exhibition cups: D2, D3, and NAIA boards you can schedule in the preseason. They are not Division I.",
  "Recruiting board shows the other schools, a leaning meter, and who in the circle is loudest.",
].join("\n");

export function rivalRows(interest: Record<string, number> | undefined, committed: string | null) {
  const rows = Object.entries(interest ?? {})
    .filter(([, n]) => Number.isFinite(n))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ id, name: teamOf(id).name, n: Math.round(n) }));
  const lean = committed ? teamOf(committed).name : rows[0]?.name ?? "";
  return { rows, lean };
}

export function circleLine(w: RecruitWants | undefined): string {
  if (!w) return "Scout him to see what his camp wants.";
  const rows: [string, number, string][] = [
    ["Mom", w.home ?? 0, "wants him close to home"],
    ["Dad", w.minutes ?? 0, "wants a real role"],
    ["AAU coach", w.nil ?? 0, "keeps bringing up money"],
    ["HS coach", w.academics ?? 0, "cares about class"],
  ];
  rows.sort((a, b) => b[1] - a[1]);
  const top = rows[0]!;
  return `${top[0]} ${top[2]}`;
}

export function commitWord(flipsOn: boolean, committed: boolean): string {
  if (!committed) return "";
  return flipsOn ? "Verbal" : "Signed";
}

export function signingBlurb(state: GameState): string | null {
  const late = state.phase === "offseason" || state.week >= 14;
  if (!late) return null;
  const you = state.playerTeamId;
  const yours = state.recruits.filter((r) => r.committedTo === you);
  const stars = yours.reduce((n, r) => n + r.stars, 0);
  const bySchool = new Map<string, number>();
  for (const r of state.recruits) {
    if (!r.committedTo || r.committedTo === you) continue;
    bySchool.set(r.committedTo, (bySchool.get(r.committedTo) ?? 0) + r.stars);
  }
  let rival = "";
  let rivalStars = 0;
  for (const [id, n] of bySchool) {
    if (n > rivalStars) {
      rivalStars = n;
      rival = teamOf(id).name;
    }
  }
  const rank = 1 + [...bySchool.values()].filter((n) => n > stars).length;
  const flip = Boolean(state.settings?.flipsOn);
  const lock = !flip ? "These commits are signed." : "Signing day. Earlier verbals are signed now.";
  return `Signing class: ${yours.length} commits, ${stars} stars. Ranked ${rank}${rival ? `. ${rival} has ${rivalStars} stars` : ""}. ${lock}`;
}

export function poachWatch(state: GameState): { id: string; name: string; line: string }[] {
  const you = state.playerTeamId;
  return state.players
    .filter((p) => p.teamId === you && (p.morale < 48 || (p.ovr >= 74 && p.mpg < 14)))
    .sort((a, b) => a.morale - b.morale)
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: `${p.first} ${p.last}`,
      line: p.morale < 48 ? `Morale ${p.morale}. Portal risk if the window opens.` : `${p.mpg} minutes for a ${p.ovr}. He wants a bigger role.`,
    }));
}

export function unitGrade(starters: Player[]): { off: number; def: number; note: string } | null {
  if (starters.length < 5) return null;
  const five = starters.slice(0, 5);
  const shoot = five.reduce((n, p) => n + (p.skills?.shoot ?? p.ovr), 0) / 5;
  const fin = five.reduce((n, p) => n + (p.skills?.finish ?? p.ovr), 0) / 5;
  const def = five.reduce((n, p) => n + (p.skills?.defense ?? p.ovr), 0) / 5;
  const iq = five.reduce((n, p) => n + (p.skills?.iq ?? p.ovr), 0) / 5;
  const off = Math.round(92 + (shoot - 70) * 0.35 + (fin - 70) * 0.28 + (iq - 70) * 0.22);
  const drtg = Math.round(108 - (def - 70) * 0.4 - (iq - 70) * 0.15);
  const note = iq >= 74 ? "They talk." : def >= 74 ? "They guard." : shoot >= 74 ? "They shoot it." : "Fine, not scary.";
  return { off, def: drtg, note };
}

export function clutchSplit(state: GameState): { w: number; l: number } {
  const you = state.playerTeamId;
  let w = 0;
  let l = 0;
  for (const r of state.results) {
    if (r.homeId !== you && r.awayId !== you) continue;
    const mine = r.homeId === you ? r.homeScore : r.awayScore;
    const opp = r.homeId === you ? r.awayScore : r.homeScore;
    if (Math.abs(mine - opp) > 5) continue;
    if (mine > opp) w++;
    else l++;
  }
  return { w, l };
}

export function confSplit(state: GameState): { w: number; l: number } {
  const you = state.playerTeamId;
  const t = state.teams[you];
  return { w: t?.confW ?? 0, l: t?.confL ?? 0 };
}

export function searchTape(state: GameState, q: string): { id: string; line: string }[] {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const you = state.playerTeamId;
  const out: { id: string; line: string }[] = [];
  for (const r of state.results) {
    if (r.homeId !== you && r.awayId !== you) continue;
    const opp = teamOf(r.homeId === you ? r.awayId : r.homeId).name;
    const bits = [r.recap?.headline, r.recap?.lede, r.recap?.keyPlay, ...(r.recap?.notes ?? []), ...(r.recap?.grafs ?? [])];
    const hit = bits.find((b) => b && b.toLowerCase().includes(query));
    if (!hit && !opp.toLowerCase().includes(query)) continue;
    const mine = r.homeId === you ? r.homeScore : r.awayScore;
    const theirs = r.homeId === you ? r.awayScore : r.homeScore;
    out.push({ id: r.id, line: `Wk ${r.week} ${opp} ${mine}-${theirs} · ${hit ?? r.recap?.headline ?? "Final"}` });
    if (out.length >= 12) break;
  }
  return out;
}

export function rosterCsv(state: GameState): string {
  const you = state.playerTeamId;
  const rows = [["first", "last", "pos", "year", "ovr", "pot", "mpg", "usage", "morale"]];
  for (const p of state.players.filter((x) => x.teamId === you).sort((a, b) => b.ovr - a.ovr)) {
    rows.push([
      p.first,
      p.last,
      p.pos,
      String(p.year),
      String(p.ovr),
      String(p.potential),
      String(p.mpg),
      String(p.usage ?? ""),
      String(p.morale),
    ]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function challengeCode(state: GameState): string {
  return `DRB-${state.season}-${state.seed}`;
}

export function bugReport(state: GameState): string {
  const t = state.teams[state.playerTeamId];
  const school = TEAM_BY_ID[state.playerTeamId]?.name ?? state.playerTeamId;
  const s = settingsOf(state);
  const errs = recentErrors();
  return [
    "Dribble bug report",
    `Build: ${SAVE_VERSION}`,
    `School: ${school}`,
    `Season ${state.season} week ${state.week} ${state.phase}`,
    `Record: ${t?.wins ?? 0}-${t?.losses ?? 0}`,
    `Seed: ${state.seed}`,
    `Difficulty: ${s.difficulty}`,
    `Version: ${state.version}`,
    `Last errors: ${errs.length ? errs.join(" | ") : "none"}`,
    "What happened:",
  ].join("\n");
}

export function seasonReport(state: GameState): string {
  const you = state.playerTeamId;
  const t = state.teams[you];
  const school = teamOf(you).name;
  const games = state.results.filter((r) => r.homeId === you || r.awayId === you);
  let oppW = 0;
  let oppG = 0;
  for (const r of games) {
    const opp = r.homeId === you ? r.awayId : r.homeId;
    const ot = state.teams[opp];
    if (!ot) continue;
    oppW += ot.wins;
    oppG += ot.wins + ot.losses;
  }
  const sos = oppG ? (oppW / oppG).toFixed(3) : "—";
  const top = state.players
    .filter((p) => p.teamId === you)
    .sort((a, b) => (b.stats?.pts ?? 0) - (a.stats?.pts ?? 0) || b.ovr - a.ovr)
    .slice(0, 5);
  const portal = (state.portal?.transfers ?? []).filter((x) => x.committedTo === you);
  const awards = (state.awards ?? []).filter((a) => a.season === state.season);
  const lines = [
    `# ${school} · ${state.season}`,
    `Record ${t?.wins ?? 0}-${t?.losses ?? 0} · Conf ${t?.confW ?? 0}-${t?.confL ?? 0}`,
    `SOS ${sos} (opponent win rate)`,
    "",
    "Top players",
    ...top.map((p) => `- ${p.first} ${p.last} ${p.pos} · ${p.stats?.pts ?? 0} pts · ${p.ovr} ovr`),
    "",
    `Portal wins: ${portal.length}${portal.length ? ` (${portal.map((p) => `${p.first} ${p.last}`).slice(0, 4).join(", ")})` : ""}`,
    awards.length ? `Awards: ${awards.slice(0, 6).map((a) => `${a.name} ${a.kind}`).join("; ")}` : "Awards: none posted yet",
    "",
    "100% free D-I coaching sim — no IAP required.",
  ];
  return lines.join("\n");
}

const ROOM = "dribble-room.";

export function hostRoom(codeSeed: string): string {
  const code = (codeSeed || Math.random().toString(36).slice(2, 8)).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return code || "ROOM1";
}

export function writeRoom(code: string, save: string) {
  const key = ROOM + code.toUpperCase();
  const file = JSON.stringify({ code: code.toUpperCase(), save, at: Date.now() });
  try {
    localStorage.setItem(key, file);
  } catch {
    /* ignore */
  }
  return file;
}

export function readRoom(code: string): string | null {
  try {
    const raw = localStorage.getItem(ROOM + code.trim().toUpperCase());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { save?: string };
    return typeof parsed.save === "string" ? parsed.save : null;
  } catch {
    return null;
  }
}

export function pipelineLine(state: GameState): string {
  const you = state.playerTeamId;
  const home = TEAM_BY_ID[you]?.state;
  const mine = state.recruits.filter((r) => r.state && home && r.state === home);
  const signed = mine.filter((r) => r.committedTo === you).length;
  return home
    ? `Pipeline · ${home}: ${mine.length} on the national board, ${signed} signed. ${pipelineMemoryLine(state)}`
    : "Pipeline opens once the school has a home state.";
}

const CHAL_KEY = "dribble-2026.challenge";

export function readChallengeSeed(): number {
  try {
    const raw = localStorage.getItem(CHAL_KEY) ?? "";
    if (!/^\d+$/.test(raw)) return 0;
    return Number(raw) >>> 0;
  } catch {
    return 0;
  }
}

export function writeChallengeSeed(n: number) {
  try {
    if (!n) localStorage.removeItem(CHAL_KEY);
    else localStorage.setItem(CHAL_KEY, String(n >>> 0));
  } catch {
    /* ignore */
  }
}
