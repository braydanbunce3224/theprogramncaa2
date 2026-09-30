import type { GameResult, GameSlot, GameState, LiveEvent, NewsArticle, RecapPlayer } from "./types";
import { TEAM_BY_ID } from "./teams";
import { identityName, coachSaid } from "./engine-util";
import { hashString, mulberry32, pick } from "./rng";
import { recapFor } from "./recap";
import { gameKindShort, DESK } from "./brand";

const WRITERS = ["Maya Chen", "Rob Vickers", "Ellis Prado", "Janelle Ortiz", "Chris Bohm", "Priya Nair", "Sam Calder", "Nina Vos"];
const OUTLETS = [DESK, "The Daily", "Nightly", "Tip-Off", "Conference Notes"];

type Tone = NewsArticle["tone"];

function school(id: string) {
  return TEAM_BY_ID[id];
}

function rngFor(state: GameState, key: string) {
  return mulberry32(state.seed ^ hashString(key) ^ (state.week * 104729));
}

export function asArticle(raw: Partial<NewsArticle> & { week: number; text?: string; tone?: Tone }): NewsArticle {
  const text = raw.text || raw.headline || "Nothing new.";
  const headline = raw.headline || text.replace(/\.$/, "");
  return {
    id: raw.id ?? `wire-${raw.week}-${hashString(headline).toString(36)}`,
    week: raw.week,
    season: raw.season,
    tone: raw.tone ?? "even",
    kicker: raw.kicker ?? "Notebook",
    headline,
    dek: raw.dek ?? "",
    byline: raw.byline ?? "staff",
    outlet: raw.outlet ?? DESK,
    grafs: raw.grafs?.length ? raw.grafs : [text],
    resultId: raw.resultId,
    names: raw.names,
    text: headline,
  };
}

export function brief(week: number, headline: string, grafs: string[], tone: Tone = "even", kicker = "NCAA"): NewsArticle {
  return asArticle({
    week,
    tone,
    kicker,
    headline,
    dek: grafs[0] ?? "",
    byline: "staff",
    outlet: DESK,
    grafs,
    text: headline,
  });
}

function kickerFor(kind: GameSlot["kind"]) {
  return gameKindShort(kind);
}

function recordOf(state: GameState, id: string) {
  const t = state.teams[id];
  if (!t) return "";
  const conf = t.confW + t.confL > 0 ? `, ${t.confW}-${t.confL} in conference play` : "";
  return `${t.wins}-${t.losses}${conf}`;
}

function cityLine(id: string, site: GameSlot["site"], kind: GameSlot["kind"]) {
  const t = school(id);
  if (!t) return "";
  if (kind === "ncaa" || kind === "nit" || kind === "crown" || kind === "conf-tourney" || kind === "mte" || site === "neutral") {
    return t.city.toUpperCase();
  }
  return t.city.toUpperCase();
}

function shooterLine(p: RecapPlayer, team: string) {
  const three = p.tpa ? `, ${p.tpm ?? 0}-for-${p.tpa} from three` : "";
  const ft = p.fta ? `, ${p.ftm ?? 0}-for-${p.fta} at the line` : "";
  return `${p.name} led ${team} with ${p.pts} points on ${p.fgm}-for-${p.fga} shooting${three}${ft}, plus ${p.reb} rebound${p.reb === 1 ? "" : "s"} and ${p.ast} assist${p.ast === 1 ? "" : "s"} in ${p.min} minutes.`;
}

function orderedLog(log: LiveEvent[]): LiveEvent[] {
  if (log.length < 2) return log;
  const tot = (e: LiveEvent) => (e.homeScore ?? 0) + (e.awayScore ?? 0);
  const newestFirst = log[0]?.t === "Final" || tot(log[0]!) > tot(log[log.length - 1]!);
  return newestFirst ? [...log].reverse() : [...log];
}

/** Plays that actually happened. A watched game keeps the last stretch of the log. */
function tapeFromLog(log: LiveEvent[], home: string, away: string): string[] {
  const rows = orderedLog(log).filter((e) => e.text);
  const out: string[] = [];
  const half = rows.find((e) => e.text.startsWith("Halftime"));
  if (half) out.push(`${half.text.replace(/\.$/, "")}.`);
  if (rows.some((e) => /Five more minutes|Still tied/i.test(e.text))) out.push("It went to overtime.");
  const plays = rows.filter((e) => e.kind === "two" || e.kind === "three" || e.kind === "ft" || e.kind === "to");
  const scored = plays.filter((e) => (e.pts ?? 0) > 0 && e.poss);
  let best = 0;
  let bestFrom = 0;
  let bestTo = -1;
  let cur = 0;
  let side: LiveEvent["poss"] | null = null;
  let start = 0;
  scored.forEach((e, idx) => {
    if (e.poss === side) cur += e.pts ?? 0;
    else {
      cur = e.pts ?? 0;
      side = e.poss ?? null;
      start = idx;
    }
    if (cur > best) {
      best = cur;
      bestFrom = start;
      bestTo = idx;
    }
  });
  if (best >= 8 && bestTo >= bestFrom) {
    const slice = scored.slice(bestFrom, bestTo + 1);
    const who = slice[0]?.poss === "home" ? home : away;
    const bits = slice
      .slice(0, 4)
      .map((e) => (e.text.split(". ")[0] ?? e.text).trim())
      .join(". ");
    out.push(`${who} put together a ${best}–0 run. ${bits}.`);
  }
  const closing = plays.filter((e) => (e.pts ?? 0) > 0 || e.kind === "to").slice(-5);
  for (const e of closing) {
    const clock = e.t && e.t !== "Final" ? `${e.t}: ` : "";
    const score = `${home} ${e.homeScore}, ${away} ${e.awayScore}`;
    const line = e.text.replace(/\s+/g, " ").trim();
    out.push(`${clock}${line} (${score}).`);
  }
  return out.slice(0, 8);
}

export function gameStory(
  state: GameState,
  slot: GameSlot,
  result: GameResult,
  source?: { log?: LiveEvent[]; tape?: string[] },
): NewsArticle {
  const rng = rngFor(state, result.id);
  const recap = recapFor(state, result);
  const homeWin = result.homeScore > result.awayScore;
  const winnerId = homeWin ? result.homeId : result.awayId;
  const loserId = homeWin ? result.awayId : result.homeId;
  const w = school(winnerId);
  const l = school(loserId);
  const winner = w?.name ?? winnerId;
  const loser = l?.name ?? loserId;
  const homeName = school(result.homeId)?.name ?? "Home";
  const awayName = school(result.awayId)?.name ?? "Away";
  const ws = homeWin ? result.homeScore : result.awayScore;
  const ls = homeWin ? result.awayScore : result.homeScore;
  const margin = ws - ls;
  const youIn = slot.homeId === state.playerTeamId || slot.awayId === state.playerTeamId;
  const youWin = winnerId === state.playerTeamId;
  const tone: Tone = !youIn ? "even" : youWin ? "good" : "bad";
  const dateline = cityLine(slot.homeId, slot.site, slot.kind);
  const neutral =
    slot.kind === "ncaa" || slot.kind === "nit" || slot.kind === "crown" || slot.kind === "mte" || slot.kind === "conf-tourney" || slot.site === "neutral";
  const host = school(slot.homeId)?.name ?? "";
  const site = neutral ? "on a neutral floor" : host === winner ? "at home" : host === loser ? "on the road" : host ? `at ${host}` : "";
  const star = (homeWin ? recap.homeLeaders : recap.awayLeaders)[0];
  const other = (homeWin ? recap.awayLeaders : recap.homeLeaders)[0];
  const ot = (result.minutes ?? 40) > 40;
  const watched = tapeFromLog(source?.log ?? [], homeName, awayName);
  const tape = watched.length ? watched : (source?.tape ?? []).filter(Boolean);
  const how = margin <= 3 ? "edged" : margin >= 15 ? "rolled past" : margin <= 8 ? "held off" : "beat";
  const lastPlay = tape[tape.length - 1]?.replace(/\s+/g, " ").trim();

  let headline = star
    ? `${star.name.split(" ").slice(-1)[0]} ${how === "edged" ? "lifts" : "leads"} ${winner} past ${loser}`
    : `${winner} ${how} ${loser}`;
  if (ot) headline = `${winner} outlasts ${loser} in OT`;
  if (headline.length < 12) headline = `${winner} ${how} ${loser}`;

  const dekCore = `${winner} ${ws}, ${loser} ${ls}${ot ? " in OT" : ""}`;
  const dek = lastPlay ? `${dekCore}. ${lastPlay.length > 160 ? `${lastPlay.slice(0, 157)}…` : lastPlay}` : dekCore;

  const lead = `${dateline} — ${winner} ${how} ${loser} ${ws}-${ls}${ot ? " in overtime" : ""}${site ? ` ${site}` : ""}.`;
  const boxGraf = [star ? shooterLine(star, winner) : "", other && other.name !== star?.name ? shooterLine(other, loser) : ""]
    .filter(Boolean)
    .join(" ");
  const boardGraf = `${winner} moves to ${recordOf(state, winnerId) || "—"}. ${loser} falls to ${recordOf(state, loserId) || "—"}. ${homeName} had ${recap.homeTo} turnovers and ${recap.homeOrb} offensive boards. ${awayName} had ${recap.awayTo} turnovers and ${recap.awayOrb} offensive boards.`;
  const grafs = [lead, ...tape, boxGraf, boardGraf].filter((g): g is string => Boolean(g && g.trim()));

  return asArticle({
    id: `story-${result.id}`,
    week: result.week,
    season: state.season,
    tone,
    kicker: kickerFor(slot.kind),
    headline,
    dek,
    byline: pick(rng, WRITERS),
    outlet: pick(rng, OUTLETS),
    grafs,
    resultId: result.id,
    text: `${headline} (${dekCore})`,
  });
}

export function campCopy(state: GameState): NewsArticle {
  const t = school(state.playerTeamId);
  const name = t?.name ?? "The program";
  const place = [t?.city, t?.state].filter(Boolean).join(", ").toUpperCase() || "CAMPUS";
  const coach = identityName(state.identity);
  const said = coachSaid(state.identity);
  const roster = (state.players ?? [])
    .filter((p) => p.teamId === state.playerTeamId && !p.redshirt)
    .sort((a, b) => b.ovr - a.ovr || b.mpg - a.mpg);
  const vets = roster.filter((p) => p.year >= 3).length;
  const top = roster[0];
  const next = roster[1];
  const who = top && next
    ? `${top.first} ${top.last} (${top.pos}) and ${next.first} ${next.last} (${next.pos})`
    : top
      ? `${top.first} ${top.last} (${top.pos})`
      : "";
  const yearWord = ["freshman", "sophomore", "junior", "senior", "senior"][Math.min(4, Math.max(0, (top?.year ?? 1) - 1))] ?? "player";
  const quote = top
    ? pick(rngFor(state, `camp-q-${state.season}`), [
        `"${top.last} is going to play a lot," ${said} said. "I need to see who can stay on the floor with him when we get pressed. That's this week."`,
        `"We're not ranking guys on a whiteboard," ${said} said. "${top.first} has been here. The new guys have to earn the minutes next to him."`,
        `"First week is habits," ${said} said. "If ${top.last} is open, we throw it to him. Everything else we figure out in practice."`,
      ])
    : `"First week is conditioning and who can guard," ${said} said. "I'll know more once we actually scrimmage."`;
  return asArticle({
    week: 0,
    season: state.season,
    tone: "even",
    kicker: "Camp",
    headline: `${name} opens practice`,
    dek: top ? `${top.first} ${top.last} is back for his ${yearWord} year.` : "First practice is underway.",
    byline: pick(rngFor(state, `camp-${state.season}`), WRITERS),
    outlet: pick(rngFor(state, `camp-out-${state.season}`), OUTLETS),
    grafs: [
      `${place} — ${name} practiced for the first time this season. ${coach} has ${roster.length || "the"} guys on the floor${who ? `, with ${who} getting the first run` : ""}. ${vets ? `${vets} of them are juniors or seniors.` : "Most of the roster is underclassmen."}`,
      quote,
    ],
    text: `${name} opened practice.`,
  });
}

function slateCounts(state: GameState) {
  const id = state.playerTeamId;
  const games = state.schedule.filter(
    (g) => !g.declined && (g.kind === "conference" || g.kind === "noncon" || g.kind === "mte") && (g.homeId === id || g.awayId === id),
  );
  const league = games.filter((g) => g.kind === "conference").length;
  return { total: games.length, noncon: games.length - league, league };
}

function nGames(n: number, label: string) {
  return `${n} ${label} game${n === 1 ? "" : "s"}`;
}

export function scheduleStory(state: GameState) {
  const name = school(state.playerTeamId)?.name ?? "The program";
  const { total, noncon, league } = slateCounts(state);
  if (total <= 0) {
    return {
      dek: "The schedule is set.",
      grafs: [`${name} locked the ${state.season} schedule.`, "The opener is next."],
      text: `${name} set the schedule.`,
    };
  }
  return {
    dek: `${total} games: ${nGames(noncon, "non-conference")} and ${nGames(league, "conference")}.`,
    grafs: [
      `${name} locked the ${state.season} schedule at ${total} games — ${nGames(noncon, "non-conference")} and ${nGames(league, "conference")}. Conference play is in January and February.`,
      "The opener is next.",
    ],
    text: `${name} set the ${total}-game schedule.`,
  };
}

export function lockCopy(state: GameState): NewsArticle {
  const t = school(state.playerTeamId);
  const story = scheduleStory(state);
  return asArticle({
    week: 1,
    season: state.season,
    tone: "even",
    kicker: "Schedule",
    headline: `${t?.name ?? "The program"} sets ${state.season} schedule`,
    dek: story.dek,
    byline: "staff",
    outlet: DESK,
    grafs: story.grafs,
    text: story.text,
  });
}

/** Old lock notes counted the whole national board. Rewrite those on screen. */
export function presentNews(article: NewsArticle, state: GameState): NewsArticle {
  const blob = `${article.dek ?? ""} ${(article.grafs ?? []).join(" ")}`;
  if (!/filled in to make \d+|added \d+ games? to get to/.test(blob)) return article;
  const year = article.headline.match(/\b(20\d{2})\b/)?.[1];
  if (year && Number(year) !== state.season) {
    const name = school(state.playerTeamId)?.name ?? "The program";
    return {
      ...article,
      dek: "The 30-game slate was locked.",
      grafs: [
        `${name} locked the ${year} schedule at 30 games. Conference play was in January and February.`,
        "The opener followed.",
      ],
      text: `${name} set the schedule.`,
    };
  }
  return { ...article, ...scheduleStory(state) };
}

export function hydrateNews(raw: GameState["news"] | { week: number; text: string; tone: Tone }[] | undefined): NewsArticle[] {
  if (!raw?.length) return [];
  return raw.map((n, i) => {
    if ("headline" in n && n.headline && "grafs" in n && Array.isArray(n.grafs) && n.grafs.length) {
      return asArticle(n);
    }
    const text = "text" in n && n.text ? n.text : "headline" in n ? String(n.headline) : "News.";
    return asArticle({
      id: `legacy-${n.week}-${i}`,
      week: n.week,
      tone: n.tone,
      kicker: "Notebook",
      headline: text.replace(/\.$/, ""),
      dek: "",
      grafs: [text],
      text,
    });
  });
}
