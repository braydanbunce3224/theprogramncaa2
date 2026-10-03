import type {
  CoachIdentity, Feedback, GameBox, GameResult, GameSlot, GameState, LiveEvent, Mail, MteTemplate,
  Player, RecapPlayer, Recruit, Site, TeamRuntime, TeamSeed,
} from "./types";
import { MAX_GAMES, MAX_PER_WEEK, REGULAR_WEEKS, SCHOLARSHIPS, START_SEASON, SAVE_VERSION, WEEK_HOURS } from "./types";
import { TEAMS, TEAM_BY_ID, CONFERENCES, guestOf } from "./teams";
import { clamp, gaussian, hashString, mulberry32, pick, randInt, type Rng } from "./rng";
import { identityName, boxFromLive, estimateGameBoxes, clampPlayerFta } from "./engine-util";
import { reconcileFinal } from "./scoreFloor";
import { listCustomSchools, loadCustomSchools } from "./custom-schools";
import { simContest, scaleLiveMinutes } from "./sim";
import { gameCtx } from "./presser";
import { afterGameMail, weeklyStakeholderMail } from "./mail";
import { makePlayer, recruitsFor, inSeasonGrowth, nextSeason as rollSeason, spendCoachPoint, setPlayerMpg, setPlayerUsage, DEFAULT_COACH, emptyHistory, enterOffseason, recruitInterest, seedHeat, prestigeFit } from "./develop";
import { simRestLive, startLiveGame, stepLive } from "./plays";
export { simRestLive, startLiveGame, stepLive, offeredCalls, OFF_OPTS, DEF_OPTS, crowdFill, clockLabel, liveYouOffense } from "./plays";
import { continuePostseason } from "./selection";
import type { CoachAxis } from "./types";
import { randomPersonName } from "./people-names";
import { snapshotPack } from "./names";
import { applyChemistryWeek, teamChemistry, bustChemCache } from "./chemistry";
import { makeContract, openingLetter } from "./contract";
import { adFrom } from "./voices";

import { emptyCompliance, noteOffer, noteVisit, tickCompliance } from "./compliance";
import { withRecap } from "./recap";
import { emptySheet } from "./market";
import { eraHasNil, eraPortal } from "./era";
import { alignTeamsForYear, applyYearRealignment, conferencePlaysLeague, eraDecadeForSeason } from "./align";
import { campCopy, gameStory, lockCopy } from "./wire";
import { availableRoster, draftWaiting, rollGameInjuries, settleDraft as settleDraftRaw, openDraft as openDraftRaw, tickInjuries } from "./college";
import { tickPortal, scoutPortal, offerPortal, visitPortal, signPortal, assistPortalWeek, emptyPortal, portalPaper, portalOpen, portalOf } from "./portal";
import { tickPromises } from "./locker";
import { rollStory, resolveStory } from "./story";
import { makeExpectations } from "./card";
import { defaultSettings, settingsOf, recruitBias, signFloor, prestigeGravity, patchSettings, realign, retireCoach } from "./league";
import {
  stampPro, closeProClass, pipelineBonus, tickFlips, tickDonors, answerNilAsk, rollPotw, weeklyTake,
  gameOfDay, forceCommit, markCommit, preseasonWatch,
} from "./depth";
import { tickPodcasts } from "./podcast";
import { stampBook, applyPlayerLine, closeSeasonBook } from "./records";
import { snapshotLeaders } from "./leaders";
import { rivalryEdge, rivalryForSlot } from "./rivalry";
import { absorbBoard, memoryBump, rememberSigns, signParts } from "./recruit-depth";
import { ensureProgram, tickProgramWeek, tickProgramYear, staffRecruitBonus, staffHourBonus, tickEvents, tickFatigue, rematchEvents } from "./program";

export { makeContract, openingLetter, signExtension, takeContractJob, walkContract } from "./contract";
export { identityName } from "./engine-util";
export { eraHasNil, eraHasThree, eraHasShotClock, eraPortal, eraPace, eraThreeScale } from "./era";
export { conferenceInYear, leagueName } from "./align";
export { spendCoachPoint, setPlayerMpg, setPlayerUsage };
export { recapFor, withRecap } from "./recap";
export { hangLine, weekCard } from "./market";
export {
  classLabel, effectiveMpg, canRedshirt, setRedshirt, talkStay, letGo, draftWaiting, bandLabel, recruitPathLabel, isOut, tickInjuries, availableRoster, draftScore, draftBand, playedThisSeason, nationalBoard, recruitClassRank,
} from "./college";
export {
  tickPortal, scoutPortal, offerPortal, visitPortal, signPortal, portalOpen, portalOf, portalInterest, reasonLine, lastFit, desiredWindow, portalEra, portalHoursBudget, portalChance, portalAfford,
} from "./portal";
export { setFocus, spendCamp, lockCamp, campWaiting, campOf, FOCUS_OPTS, focusLabel } from "./camp";
export { makePromise, livePromises, PROMISE_OPTS, promiseLine, holdAccountable, talksLeft, pepTalk } from "./locker";
export { resolveStory, rollStory } from "./story";
export { yourAwards, awardLine, rollAwards } from "./awards";
export { makeExpectations, makeReportCard } from "./card";
export { settingsOf, patchSettings, realign, retireCoach, goatScore, goatLine, DIFFICULTY_OPTS, dreamJobs, openDreamJob, signFloor } from "./league";
export { mockBoard, winProb, gameOfDay, awardRace, searchPeople, forceCommit, answerNilAsk, intlLabel, PRO_TEAMS, traitOf, fogTape, FreakKinds, freakLine, playerAwardsOf } from "./depth";
export { tickPodcasts, podcastTease, POD_SHOWS, episodesOf, showOf, podcastTicker } from "./podcast";
export { toughestPlaces, gymName, gymPrior, gymScore, gymTease, gymOf, gymLiveEdge, gymSimEdge } from "./gym";
export { bookOf, bookLines } from "./records";
export { leadersOf, conferenceLeaders, snapshotLeaders, fmtRate } from "./leaders";
export { rivalryOf, rivalryForSlot, rivalryLine, rivalryTease, yourRivals, isRivalryGame } from "./rivalry";
export { callTimeout } from "./plays";
export {
  staffOf, facilitiesOf, practiceOf, depthOf, hireStaff, fireStaff, upgradeFacility, setPractice, setCaptain, setStarter,
  staffTease, facilityTease, PRACTICE_OPTS, FACILITY_OPTS, roleLabel, facilityStars, injuredOf, captainOf, isStarter, fatigueOf,
  refreshStaffPool, reseatProgram, upgradeCost, teamLoad, upcomingEvents, staffSchemeEdge, tickFatigue,
} from "./program";
export { scoutOpponent, liveScout, buildScout, nextOppId } from "./scout";
export { resumeOf, gameQuad, remainingSos } from "./ranks";

export const MTES: MteTemplate[] = [
  { id: "maui", name: "Island Classic", site: "Lahaina", week: 2, size: 8, minPrestige: 78 },
  { id: "atlantis", name: "Coral Eight", site: "Paradise Island", week: 2, size: 8, minPrestige: 76 },
  { id: "charleston", name: "Harbor Classic", site: "Charleston", week: 2, size: 8, minPrestige: 64 },
  { id: "players-era", name: "Desert Festival", site: "Las Vegas", week: 3, size: 8, minPrestige: 80 },
  { id: "empire", name: "Garden Classic", site: "New York", week: 2, size: 4, minPrestige: 72 },
  { id: "legends", name: "Borough Classic", site: "Brooklyn", week: 2, size: 4, minPrestige: 70 },
  { id: "fort-myers", name: "Gulf Tip-Off", site: "Fort Myers", week: 2, size: 4, minPrestige: 58 },
  { id: "cancun", name: "Caribbean Challenge", site: "Cancun", week: 3, size: 4, minPrestige: 62 },
  { id: "wooden", name: "Westwood Legacy", site: "Anaheim", week: 3, size: 4, minPrestige: 68 },
  { id: "emerald", name: "Coast Classic", site: "Niceville", week: 3, size: 4, minPrestige: 56 },
  { id: "hof", name: "Memorial Classic", site: "Kansas City", week: 3, size: 4, minPrestige: 66 },
  { id: "rainbow", name: "Pacific Classic", site: "Honolulu", week: 1, size: 4, minPrestige: 60 },
  { id: "cleveland", name: "Lakefront Classic", site: "Cleveland", week: 2, size: 4, minPrestige: 48 },
  { id: "sunshine", name: "Citrus Slam", site: "Daytona Beach", week: 1, size: 4, minPrestige: 50 },
];

function rosterFor(seed: number, teamId: string, prestige: number): Player[] {
  const rng = mulberry32(seed ^ hashString(teamId));
  const used = new Set<string>();
  const out: Player[] = [];
  for (let i = 0; i < 13; i++) {
    const pos = (["PG", "SG", "SF", "PF", "C"] as const)[i % 5];
    const base = 68 + (prestige - 50) * 0.32;
    const decay = i < 5 ? i * 0.22 : 1.7 + (i - 5) * 0.75;
    const ovr = clamp(Math.round(base + gaussian(rng) * 2.0 - decay), 58, 93);
    const name = randomPersonName(rng, used);
    out.push(makePlayer({
      id: `${teamId}-p${i}`,
      first: name.first,
      last: name.last,
      pos,
      year: 1 + (i % 4),
      teamId,
      ovr,
      mpg: i < 5 ? 26 : i < 8 ? 12 : 6,
      rng,
    }));
  }
  return out;
}

function roundRobinRounds(ids: string[]): { home: string; away: string }[][] {
  const teams = [...ids];
  if (teams.length % 2 === 1) teams.push("BYE");
  const n = teams.length;
  const half = n / 2;
  const arr = [...teams];
  const rounds: { home: string; away: string }[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: { home: string; away: string }[] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i]!;
      const b = arr[n - 1 - i]!;
      if (a === "BYE" || b === "BYE") continue;
      const aHome = (r + i) % 2 === 0;
      pairs.push(aHome ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(pairs);
    const last = arr.pop()!;
    arr.splice(1, 0, last);
  }
  return rounds;
}

function mirrorRounds(rounds: { home: string; away: string }[][]) {
  return rounds.map((pairs) => pairs.map((p) => ({ home: p.away, away: p.home })));
}

function packConfWeeks(roundCount: number, weeks: number[]): number[] {
  if (roundCount <= weeks.length) return weeks.slice(0, roundCount);
  const out = [...weeks];
  const extra = roundCount - weeks.length;
  const doubles: number[] = [];
  for (let i = weeks.length - 1; i >= 1 && doubles.length < extra; i--) doubles.push(weeks[i]!);
  for (let i = 0; doubles.length < extra && i < weeks.length; i++) {
    const w = weeks[i]!;
    if (!doubles.includes(w)) doubles.push(w);
  }
  out.push(...doubles.slice(0, extra));
  return out;
}

function rebalanceHomeAway(slots: GameSlot[]): GameSlot[] {
  const out = slots.map((g) => ({ ...g }));
  const ids = [...new Set(out.flatMap((g) => [g.homeId, g.awayId]))];
  const imbOf = (id: string) => {
    let h = 0;
    let a = 0;
    for (const g of out) {
      if (g.homeId === id) h++;
      else if (g.awayId === id) a++;
    }
    return h - a;
  };
  let guard = 0;
  while (guard++ < 600) {
    const heavy = ids.filter((id) => imbOf(id) > 1);
    const light = new Set(ids.filter((id) => imbOf(id) < -1));
    if (!heavy.length || !light.size) break;
    let flipped = false;
    for (const src of heavy) {
      const prev = new Map<string, number>();
      const q = [src];
      const seen = new Set<string>([src]);
      let sink: string | null = null;
      while (q.length && sink == null) {
        const u = q.shift()!;
        for (let i = 0; i < out.length; i++) {
          const g = out[i]!;
          if (g.homeId !== u) continue;
          const v = g.awayId;
          if (seen.has(v)) continue;
          seen.add(v);
          prev.set(v, i);
          if (light.has(v)) {
            sink = v;
            break;
          }
          q.push(v);
        }
      }
      if (!sink) continue;
      let cur = sink;
      while (cur !== src) {
        const idx = prev.get(cur);
        if (idx == null) break;
        const g = out[idx]!;
        out[idx] = { ...g, homeId: g.awayId, awayId: g.homeId };
        cur = g.homeId;
      }
      flipped = true;
      break;
    }
    if (!flipped) break;
  }
  return out;
}

function confSchedule(seed: number, teams: Record<string, TeamRuntime>): GameSlot[] {
  const rng = mulberry32(seed ^ 0xc0ff);
  const slots: GameSlot[] = [];
  let n = 0;
  const confWeeks: number[] = [];
  for (let w = 6; w <= REGULAR_WEEKS; w++) confWeeks.push(w);
  for (const conf of CONFERENCES) {
    if (!conferencePlaysLeague(conf.id)) continue;
    const members = Object.values(teams).filter((t) => t.conference === conf.id).map((t) => t.id);
    if (members.length < 2) continue;
    for (let i = members.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = members[i]!;
      members[i] = members[j]!;
      members[j] = tmp;
    }
    const once = roundRobinRounds(members);
    const double = members.length <= 11 && (members.length - 1) * 2 <= 20;
    let rounds = double ? [...once, ...mirrorRounds(once)] : once;
    if (!double && members.length % 2 === 0 && rounds.length % 2 === 1 && rounds.length > 2) {
      rounds = rounds.slice(0, -1);
    }
    const weeks = packConfWeeks(rounds.length, confWeeks);
    const confSlots: GameSlot[] = [];
    rounds.forEach((pairs, ri) => {
      const week = weeks[ri] ?? 6;
      for (const p of pairs) {
        confSlots.push({
          id: `c-${conf.id}-${n++}`,
          week,
          homeId: p.home,
          awayId: p.away,
          site: "home",
          kind: "conference",
        });
      }
    });
    slots.push(...(double ? confSlots : rebalanceHomeAway(confSlots)));
  }
  return slots;
}

function coachName(identity: CoachIdentity) {
  return identityName(identity);
}

export function newDynasty(
  teamId: string,
  seed: number,
  opts: { careerMode: boolean; identity?: CoachIdentity; eraDecade?: number | null },
): GameState {
  loadCustomSchools();
  const identity = opts.identity ?? { first: "Coach", last: "Stone", age: 38, almaMaterId: null };
  const eraDecade = opts.eraDecade ?? null;
  const nilOn = eraHasNil(eraDecade);
  const season = eraDecade != null ? eraDecade : START_SEASON;
  const teams: Record<string, TeamRuntime> = {};
  const players: Player[] = [];
  for (const t of TEAMS) {
    teams[t.id] = {
      id: t.id,
      conference: t.conference,
      prestige: t.prestige,
      wins: 0,
      losses: 0,
      confW: 0,
      confL: 0,
      homeW: 0,
      homeL: 0,
      homeStreak: 0,
      gymW: 0,
      gymL: 0,
      gymPf: 0,
      gymPa: 0,
      coachName: t.id === teamId ? coachName(identity) : "Staff",
      allWins: 0,
      allLosses: 0,
    };
    players.push(...rosterFor(seed, t.id, t.prestige));
  }
  const aligned = alignTeamsForYear(teams, season);
  const schedule = confSchedule(seed, aligned);
  const contract = makeContract(teamId, season, 1);
  const opening = openingLetter({
    identity,
    playerTeamId: teamId,
    contract,
    seed,
  } as GameState);
  const raw: GameState = {
    version: SAVE_VERSION,
    seed,
    season,
    week: 0,
    phase: "preseason",
    playerTeamId: teamId,
    teams: aligned,
    players,
    recruits: recruitsFor(seed, season),
    schedule,
    results: [],
    mail: [
      {
        id: `paper-${season}`,
        from: adFrom({ seed, playerTeamId: teamId }),
        subject: opening.subject,
        body: opening.body,
        week: 0,
        read: false,
        tone: "even",
      },
    ],
    news: [campCopy({
      identity,
      playerTeamId: teamId,
      season,
      seed,
      week: 0,
      teams: aligned,
      players,
    } as GameState)],
    identity,
    careerMode: opts.careerMode,
    eraDecade,
    nilCap: nilOn ? 100 : 0,
    donorMood: 58,
    adHeat: 55,
    fanMood: 60,
    scholarships: SCHOLARSHIPS,
    recruitingHours: WEEK_HOURS,
    cpuRecruit: false,
    pendingPresser: null,
    liveGame: null,
    lastPresserWeek: -1,
    recentQuestionIds: [],
    tutorialDone: false,
    coachSkills: { ...DEFAULT_COACH },
    skillPoints: 0,
    offseasonReport: null,
    history: emptyHistory(),
    selection: null,
    namePack: snapshotPack(),
    contract,
    contractReview: null,
    compliance: emptyCompliance(),
    sheet: emptySheet(),
    draft: null,
    portal: emptyPortal(season, eraPortal(eraDecade) === "none" ? "none" : "closed"),
    camp: null,
    promises: [],
    pendingStory: null,
    awards: [],
    reportCard: null,
    expectations: null,
    gamePlan: { off: ["motion", "pnr", "spread"], def: ["man", "pack"] },
    talksThisWeek: 0,
    settings: defaultSettings(eraDecade),
    donors: [],
    nilAsks: [],
    potw: [],
    proHistory: [],
    flash: null,
    gotdId: null,
    podcasts: [],
    watch: preseasonWatch({ players, playerTeamId: teamId }),
    pipelineBook: { states: {}, ties: {} },
    customSchools: listCustomSchools(),
  };
  const seeded = tickPodcasts(raw, mulberry32(seed ^ 0xca71));
  return tickEventsOpen(ensureProgram(seeded));
}

/** Drop a commissioner school into a save that is already open. */
export function worldWithCustom(state: GameState, school: TeamSeed): GameState {
  const list = [...(state.customSchools ?? []).filter((t) => t.id !== school.id), school];
  if (state.teams[school.id]) return { ...state, customSchools: list };
  const runtime: TeamRuntime = {
    id: school.id,
    conference: school.conference,
    prestige: school.prestige,
    wins: 0,
    losses: 0,
    confW: 0,
    confL: 0,
    homeW: 0,
    homeL: 0,
    homeStreak: 0,
    gymW: 0,
    gymL: 0,
    gymPf: 0,
    gymPa: 0,
    coachName: "Staff",
    allWins: 0,
    allLosses: 0,
  };
  const teams = alignTeamsForYear({ ...state.teams, [school.id]: runtime }, state.season);
  const players = [...state.players, ...rosterFor(state.seed, school.id, school.prestige)];
  const fresh = state.phase === "preseason" && state.results.length === 0;
  return {
    ...state,
    teams,
    players,
    customSchools: list,
    schedule: fresh ? confSchedule(state.seed ^ state.season, teams) : state.schedule,
  };
}

function tickEventsOpen(state: GameState): GameState {
  return tickProgramWeek({ ...state, events: state.events?.length ? state.events : undefined });
}

function isRegular(g: GameSlot) {
  return g.kind === "conference" || g.kind === "noncon" || g.kind === "mte";
}

export function yourGames(state: GameState) {
  return state.schedule.filter((g) => g.homeId === state.playerTeamId || g.awayId === state.playerTeamId);
}

export function nextYourGame(state: GameState) {
  return yourGames(state)
    .filter((g) => !g.resultId && !g.declined)
    .sort((a, b) => a.week - b.week || a.id.localeCompare(b.id))[0];
}

export function gamesInWeek(state: GameState, week: number, teamId = state.playerTeamId) {
  return state.schedule.filter((g) => !g.declined && g.week === week && (g.homeId === teamId || g.awayId === teamId));
}

export function resultFor(state: GameState, g: GameSlot) {
  if (!g.resultId) return undefined;
  return state.results.find((r) => r.id === g.resultId);
}

export function coachRecord(state: GameState) {
  const t = state.teams[state.playerTeamId];
  const jobW = t?.wins ?? 0;
  const jobL = t?.losses ?? 0;
  const booked = (state.history?.log ?? []).some((row) => row.season === state.season && row.counted);
  return {
    jobW,
    jobL,
    careerW: (state.history?.wins ?? 0) + (booked ? 0 : jobW),
    careerL: (state.history?.losses ?? 0) + (booked ? 0 : jobL),
  };
}

export function recordLine(t: TeamRuntime) {
  return `${t.wins}-${t.losses}`;
}

export function unreadMail(state: GameState) {
  return state.mail.filter((m) => !m.read).length;
}

export function markRead(state: GameState, id: string): GameState {
  return { ...state, mail: state.mail.map((m) => (m.id === id ? { ...m, read: true } : m)) };
}

function countRegular(schedule: GameSlot[], id: string) {
  return schedule.filter((g) => !g.declined && isRegular(g) && (g.homeId === id || g.awayId === id)).length;
}

function weekLoad(schedule: GameSlot[], id: string, week: number) {
  return schedule.filter((g) => !g.declined && g.week === week && (g.homeId === id || g.awayId === id)).length;
}

export function canAddGame(state: GameState, oppId: string, week: number, _site: Site): string | null {
  if (state.phase !== "preseason") return "Season's already started.";
  if (oppId === state.playerTeamId) return "That's you.";
  if (!state.teams[oppId] && !TEAM_BY_ID[oppId]) return "No such program.";
  if (week < 1 || week > REGULAR_WEEKS) return "That week isn't on the schedule.";
  if (countRegular(state.schedule, state.playerTeamId) >= MAX_GAMES) return "The schedule is full.";
  if (weekLoad(state.schedule, state.playerTeamId, week) >= MAX_PER_WEEK) return "Week is full.";
  if (weekLoad(state.schedule, oppId, week) >= MAX_PER_WEEK) return "They already have a full week.";
  if (state.schedule.some((g) => !g.declined && g.week === week && ((g.homeId === state.playerTeamId && g.awayId === oppId) || (g.homeId === oppId && g.awayId === state.playerTeamId)))) {
    return "Already booked that week.";
  }
  return null;
}

export function addNonCon(state: GameState, oppId: string, week: number, site: Site): { state: GameState; feedback: Feedback } {
  const err = canAddGame(state, oppId, week, site);
  if (err) return { state, feedback: { title: "Couldn't add", detail: err, parts: [] } };
  const homeId = site === "away" ? oppId : state.playerTeamId;
  const awayId = homeId === state.playerTeamId ? oppId : state.playerTeamId;
  const slot: GameSlot = {
    id: `nc-${state.playerTeamId}-${oppId}-${week}-${state.schedule.length}`,
    week,
    homeId,
    awayId,
    site: site === "neutral" ? "neutral" : "home",
    kind: "noncon",
  };
  return {
    state: { ...state, schedule: [...state.schedule, slot] },
    feedback: { title: "On the schedule", detail: `${TEAM_BY_ID[oppId]?.name ?? oppId} · week ${week}`, parts: [] },
  };
}

export function inviteExhibition(state: GameState, guestId: string, week: number): { state: GameState; feedback: Feedback } {
  const g = guestOf(guestId);
  if (!g) return { state, feedback: { title: "No such guest", detail: "That school isn't on a cup board.", parts: [] } };
  let next = state;
  if (!next.teams[g.id]) {
    next = {
      ...next,
      teams: {
        ...next.teams,
        [g.id]: {
          id: g.id,
          conference: "IND",
          prestige: g.prestige,
          wins: 0,
          losses: 0,
          confW: 0,
          confL: 0,
          homeW: 0,
          homeL: 0,
          homeStreak: 0,
          coachName: "Staff",
          allWins: 0,
          allLosses: 0,
          guest: g.div,
        },
      },
      players: [...next.players, ...rosterFor(next.seed ^ hashString(g.id), g.id, g.prestige)],
    };
    bustChemCache();
  }
  const added = addNonCon(next, g.id, week, "home");
  if (added.feedback.title === "Couldn't add") return added;
  const slot = added.state.schedule[added.state.schedule.length - 1];
  return {
    state: {
      ...added.state,
      schedule: added.state.schedule.map((s) => (slot && s.id === slot.id ? { ...s, cup: g.div } : s)),
    },
    feedback: { title: `${g.div} cup`, detail: `${g.name} at home · week ${week}. Exhibition. Not a Division I member.`, parts: [] },
  };
}

export function dropGame(state: GameState, id: string): GameState {
  if (state.phase !== "preseason") return state;
  const g = state.schedule.find((x) => x.id === id);
  if (!g || g.kind === "conference") return state;
  if (g.kind === "mte") {
    const event = mteEventOf(g.id);
    if (event) {
      const prefix = mtePrefix(event);
      return { ...state, schedule: state.schedule.filter((x) => !x.id.startsWith(prefix)) };
    }
  }
  return { ...state, schedule: state.schedule.filter((x) => x.id !== id) };
}

export function mteGameCount(m: Pick<MteTemplate, "size">) {
  return m.size >= 8 ? 3 : 2;
}

function mtePrefix(id: string) {
  return `mte-${id}-`;
}

function mteEventOf(slotId: string): string | null {
  for (const m of MTES) {
    if (slotId.startsWith(mtePrefix(m.id))) return m.id;
  }
  return null;
}

function dropNonConInWeek(schedule: GameSlot[], teamId: string, week: number) {
  return schedule.filter((g) => {
    if (g.kind !== "noncon" || g.week !== week) return true;
    return g.homeId !== teamId && g.awayId !== teamId;
  });
}

function dropNonConToFit(schedule: GameSlot[], teamId: string, need: number): GameSlot[] {
  const slots = schedule.slice();
  const count = () => countRegular(slots, teamId);
  while (count() + need > MAX_GAMES) {
    let idx = -1;
    for (let i = slots.length - 1; i >= 0; i--) {
      const g = slots[i]!;
      if (g.kind !== "noncon") continue;
      if (g.homeId !== teamId && g.awayId !== teamId) continue;
      idx = i;
      break;
    }
    if (idx < 0) break;
    slots.splice(idx, 1);
  }
  return slots;
}

function weekHardLoad(schedule: GameSlot[], id: string, week: number) {
  return schedule.filter((g) => !g.declined && g.week === week && g.kind !== "noncon" && (g.homeId === id || g.awayId === id)).length;
}

function mtePairings(ids: string[], rounds: number): { home: string; away: string }[][] {
  const teams = [...ids];
  if (teams.length % 2 === 1) teams.push("BYE");
  const n = teams.length;
  const half = n / 2;
  const arr = [...teams];
  const out: { home: string; away: string }[][] = [];
  for (let r = 0; r < rounds; r++) {
    const pairs: { home: string; away: string }[] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i]!;
      const b = arr[n - 1 - i]!;
      if (a === "BYE" || b === "BYE") continue;
      const aHome = (r + i) % 2 === 0;
      pairs.push(aHome ? { home: a, away: b } : { home: b, away: a });
    }
    out.push(pairs);
    const last = arr.pop()!;
    arr.splice(1, 0, last);
  }
  return out;
}

export function joinMte(state: GameState, mteId: string): { state: GameState; feedback: Feedback } {
  const m = MTES.find((x) => x.id === mteId);
  if (!m) return { state, feedback: { title: "No classic", detail: "", parts: [] } };
  if (state.phase !== "preseason") return { state, feedback: { title: "Season's underway", detail: "Can't join a classic once the year has started.", parts: [] } };
  const you = state.playerTeamId;
  const prestige = state.teams[you]?.prestige ?? TEAM_BY_ID[you]?.prestige ?? 50;
  if (prestige < m.minPrestige) return { state, feedback: { title: "They said no", detail: `${m.name} wants a bigger name.`, parts: [] } };
  if (state.schedule.some((g) => g.kind === "mte" && g.id.startsWith(mtePrefix(m.id)))) {
    return { state, feedback: { title: "Already in", detail: `${m.name} is already on the schedule.`, parts: [] } };
  }
  const games = mteGameCount(m);
  let schedule = dropNonConInWeek(state.schedule, you, m.week);
  schedule = dropNonConToFit(schedule, you, games);
  if (countRegular(schedule, you) + games > MAX_GAMES) {
    return { state, feedback: { title: "Schedule is full", detail: "Conference games already take the 30. A classic has to count in that 30.", parts: [] } };
  }
  if (weekHardLoad(schedule, you, m.week) + games > MAX_PER_WEEK) {
    return { state, feedback: { title: "Week is full", detail: `Week ${m.week} can't take ${m.name}.`, parts: [] } };
  }

  const rng = mulberry32(state.seed ^ hashString(m.id) ^ 0x11e);
  const want = m.size >= 8 ? 8 : 4;
  const field = [you];
  const consider = [...TEAMS].sort((a, b) => {
    const da = Math.abs(a.prestige - Math.max(m.minPrestige, prestige));
    const db = Math.abs(b.prestige - Math.max(m.minPrestige, prestige));
    return da - db || b.prestige - a.prestige;
  });
  for (const pass of [0, 1]) {
    for (const t of consider) {
      if (field.length >= want) break;
      if (t.id === you) continue;
      if (field.includes(t.id)) continue;
      if (pass === 0 && t.prestige < m.minPrestige - 8) continue;
      if (weekLoad(schedule, t.id, m.week) + games > MAX_PER_WEEK) continue;
      field.push(t.id);
    }
  }
  if (field.length < 4) {
    return { state, feedback: { title: "Field didn't fill", detail: `${m.name} couldn't find enough programs for that week.`, parts: [] } };
  }
  const use = field.length >= 8 && games === 3 ? field.slice(0, 8) : field.slice(0, 4);
  const rounds = use.length >= 8 ? 3 : 2;
  const pairings = mtePairings(use, rounds);
  const slots: GameSlot[] = [];
  let n = 0;
  for (const pairs of pairings) {
    for (const p of pairs) {
      slots.push({
        id: `${mtePrefix(m.id)}${n++}`,
        week: m.week,
        homeId: p.home,
        awayId: p.away,
        site: "neutral",
        kind: "mte",
      });
    }
  }
  const bumped = state.schedule.length - schedule.length;
  const yours = slots.filter((g) => g.homeId === you || g.awayId === you).length;
  return {
    state: { ...state, schedule: [...schedule, ...slots] },
    feedback: {
      title: `In the ${m.name}`,
      detail: `${yours} games · ${m.site} · week ${m.week}${bumped ? ` · ${bumped} non-con bumped` : ""} · counts in the 30`,
      parts: [],
    },
  };
}

function fillBoard(state: GameState): GameSlot[] {
  const rng = mulberry32(state.seed ^ (state.season * 13) ^ 0xa11);
  const slots = state.schedule.filter((g) => !g.declined);
  const ids = Object.keys(state.teams);
  let trimGuard = 0;
  while (trimGuard++ < 800) {
    let trimmed = false;
    for (const id of ids) {
      if (countRegular(slots, id) <= MAX_GAMES) continue;
      let idx = -1;
      for (let i = slots.length - 1; i >= 0; i--) {
        const g = slots[i]!;
        if (g.kind !== "noncon") continue;
        if (g.homeId !== id && g.awayId !== id) continue;
        idx = i;
        break;
      }
      if (idx < 0) continue;
      slots.splice(idx, 1);
      trimmed = true;
    }
    if (!trimmed) break;
  }
  const n = ids.length;
  const indexOf = new Map<string, number>();
  for (let i = 0; i < n; i++) indexOf.set(ids[i]!, i);
  const total = new Int16Array(n);
  const weeks = REGULAR_WEEKS + 1;
  const weekUsed = new Uint8Array(n * weeks);
  const booked = new Set<string>();

  for (const g of slots) {
    const hi = indexOf.get(g.homeId);
    const ai = indexOf.get(g.awayId);
    if (hi == null || ai == null) continue;
    if (isRegular(g)) {
      total[hi]++;
      total[ai]++;
    }
    if (g.week >= 0 && g.week < weeks) {
      weekUsed[hi * weeks + g.week]++;
      weekUsed[ai * weeks + g.week]++;
    }
    const lo = g.homeId < g.awayId ? g.homeId : g.awayId;
    const hiId = g.homeId < g.awayId ? g.awayId : g.homeId;
    booked.add(`${g.week}|${lo}|${hiId}`);
  }

  const early = [1, 2, 3, 4, 5];
  const allW: number[] = [];
  for (let w = 1; w <= REGULAR_WEEKS; w++) allW.push(w);

  const tryPair = (ai: number, bi: number, pool: number[]) => {
    if (ai === bi) return false;
    const aId = ids[ai]!;
    const bId = ids[bi]!;
    const lo = aId < bId ? aId : bId;
    const hiId = aId < bId ? bId : aId;
    for (const w of pool) {
      if (weekUsed[ai * weeks + w] >= MAX_PER_WEEK) continue;
      if (weekUsed[bi * weeks + w] >= MAX_PER_WEEK) continue;
      if (booked.has(`${w}|${lo}|${hiId}`)) continue;
      const aHome = rng() < 0.5;
      slots.push({
        id: `nc-fill-${slots.length}-${w}`,
        week: w,
        homeId: aHome ? aId : bId,
        awayId: aHome ? bId : aId,
        site: "home",
        kind: "noncon",
      });
      total[ai]++;
      total[bi]++;
      weekUsed[ai * weeks + w]++;
      weekUsed[bi * weeks + w]++;
      booked.add(`${w}|${lo}|${hiId}`);
      return true;
    }
    return false;
  };

  const youI = indexOf.get(state.playerTeamId);
  if (youI != null) {
    let guard = 0;
    while (total[youI] < MAX_GAMES && guard++ < 120) {
      let hit = false;
      const start = Math.floor(rng() * n);
      for (let k = 0; k < n; k++) {
        const b = (start + k) % n;
        if (b === youI) continue;
        if (tryPair(youI, b, allW)) {
          hit = true;
          break;
        }
      }
      if (!hit) break;
    }
  }

  for (let pass = 0; pass < 10; pass++) {
    let added = 0;
    const pool = pass < 4 ? early : allW;
    for (let a = 0; a < n; a++) {
      if (total[a] >= MAX_GAMES) continue;
      const start = Math.floor(rng() * n);
      let tries = 0;
      for (let k = 0; k < n && tries < 4 && total[a] < MAX_GAMES; k++) {
        const b = (start + k) % n;
        if (b === a || total[b] >= MAX_GAMES) continue;
        if (tryPair(a, b, pool)) {
          added++;
          tries++;
        }
      }
    }
    if (!added) break;
  }
  return slots;
}

export function lockSchedule(state: GameState): GameState {
  if (state.phase !== "preseason") return state;
  const schedule = fillBoard(state);
  const youNext = schedule
    .filter((g) => !g.declined && (g.homeId === state.playerTeamId || g.awayId === state.playerTeamId))
    .sort((a, b) => a.week - b.week)[0];
  const next: GameState = {
    ...state,
    phase: "regular",
    schedule,
    week: youNext?.week ?? 1,
    expectations: makeExpectations(state),
    recruitingHours: WEEK_HOURS + staffHourBonus(state),
    recruits: stampHeat(state).recruits,
    events: rematchEvents({ ...state, schedule }),
  };
  return tickProgramWeek(tickPodcasts({
    ...next,
    news: [lockCopy(next), ...next.news].slice(0, 60),
  }, mulberry32(state.seed ^ 0x10cc)));
}

export function openDraft(state: GameState): GameState {
  const next = openDraftRaw(state);
  if (!next.draft) return next;
  return { ...next, draft: { ...next.draft, league: next.draft.league.map(stampPro) } };
}

export function settleDraft(state: GameState): GameState {
  return closeProClass(openDraft(settleDraftRaw(state)));
}

function newsFor(state: GameState, slot: GameSlot, result: GameResult, plays?: { log?: LiveEvent[]; tape?: string[] }): GameState {
  const article = gameStory(state, slot, result, plays);
  return { ...state, news: [article, ...state.news].slice(0, 60) };
}

function bumpMinutes(state: GameState, homeId: string, awayId: string, homeLines?: RecapPlayer[], awayLines?: RecapPlayer[]): Player[] {
  const lineOf = (id: string, lines?: RecapPlayer[]) => lines?.find((p) => p.id === id);
  return state.players.map((p) => {
    if (p.teamId !== homeId && p.teamId !== awayId) return p;
    if (p.redshirt || (p.injury && p.injury.weeksLeft > 0)) return p;
    const lines = p.teamId === homeId ? homeLines : awayLines;
    if (lines) {
      const line = lineOf(p.id, lines);
      const add = Math.max(0, Math.round(line?.min ?? 0));
      if (add < 1 && !(line && (line.pts ?? 0) > 0)) return p;
      return {
        ...p,
        seasonMinutes: (p.seasonMinutes ?? 0) + add,
        seasonGames: (p.seasonGames ?? 0) + 1,
        stats: applyPlayerLine(p.stats, line ?? { min: add }),
      };
    }
    const add = Math.max(0, Math.round(p.mpg));
    return {
      ...p,
      seasonMinutes: (p.seasonMinutes ?? 0) + add,
      seasonGames: (p.seasonGames ?? 0) + 1,
      stats: applyPlayerLine(p.stats, { min: add, pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0 }),
    };
  });
}

function tempoShift(state: GameState, slot: GameSlot): number {
  const youIn = slot.homeId === state.playerTeamId || slot.awayId === state.playerTeamId;
  if (!youIn) return 0;
  const off = state.gamePlan?.off ?? [];
  let n = 0;
  if (off.some((p) => p === "push")) n += 5;
  if (off.some((p) => p === "delay")) n -= 5;
  return n;
}

function simSlot(
  state: GameState,
  slot: GameSlot,
  rng: Rng,
  forced?: { homeScore: number; awayScore: number; homeBox?: GameBox; awayBox?: GameBox; minutes?: number; log?: LiveEvent[]; homeLines?: RecapPlayer[]; awayLines?: RecapPlayer[] },
): GameState {
  if (slot.resultId) return { ...state, liveGame: state.liveGame?.slotId === slot.id ? null : state.liveGame };
  let hs: number;
  let as: number;
  const simmed = forced
    ? null
    : simContest(state, slot.homeId, slot.awayId, rng, {
        site: slot.site,
        youOff: slot.homeId === state.playerTeamId || slot.awayId === state.playerTeamId ? state.coachSkills?.offense : undefined,
        youDef: slot.homeId === state.playerTeamId || slot.awayId === state.playerTeamId ? state.coachSkills?.defense : undefined,
        youHome: slot.homeId === state.playerTeamId ? true : slot.awayId === state.playerTeamId ? false : undefined,
        tempo: tempoShift(state, slot),
      });
  if (forced) {
    hs = forced.homeScore;
    as = forced.awayScore;
  } else {
    hs = simmed!.homeScore;
    as = simmed!.awayScore;
  }
  const youHome = slot.homeId === state.playerTeamId;
  const youAway = slot.awayId === state.playerTeamId;
  if (!forced && settingsOf(state).forceWin && (youHome || youAway)) {
    if (youHome && hs <= as) hs = as + randInt(rng, 3, 9);
    if (youAway && as <= hs) as = hs + randInt(rng, 3, 9);
    state = { ...state, settings: { ...settingsOf(state), forceWin: false } };
  }
  if (hs === as) {
    if (rng() > 0.5) hs += 1;
    else as += 1;
  }
  if (hs < 40 || as < 40) {
    const add = 62 - Math.min(hs, as);
    if (add > 0) {
      hs += add;
      as += add;
    }
  }
  const boxes = forced?.homeBox && forced.awayBox
    ? { home: forced.homeBox, away: forced.awayBox, minutes: forced.minutes ?? 40 }
    : simmed
      ? { home: simmed.homeBox, away: simmed.awayBox, minutes: simmed.minutes }
      : estimateGameBoxes(hs, as, rng);
  const homeWin = hs > as;
  const lines = forced?.homeLines && forced.awayLines
    ? { home: forced.homeLines, away: forced.awayLines }
    : simmed
      ? { home: simmed.homeLines, away: simmed.awayLines }
      : undefined;
  const result: GameResult = withRecap(state, {
    id: `res-${slot.id}`,
    slotId: slot.id,
    homeId: slot.homeId,
    awayId: slot.awayId,
    homeScore: hs,
    awayScore: as,
    week: slot.week,
    minutes: boxes.minutes,
    homeBox: boxes.home,
    awayBox: boxes.away,
  }, forced?.log, lines);
  const nextTeams = { ...state.teams };
  const apply = (id: string, won: boolean, homeGame: boolean) => {
    const prev = nextTeams[id];
    if (!prev) return;
    const t = { ...prev };
    if (won) t.wins++;
    else t.losses++;
    if (slot.kind === "conference") {
      if (won) t.confW++;
      else t.confL++;
    }
    if (homeGame) {
      if (won) {
        t.homeW++;
        t.gymW = (t.gymW ?? 0) + 1;
        t.homeStreak = Math.max(0, t.homeStreak) + 1;
      } else {
        t.homeL++;
        t.gymL = (t.gymL ?? 0) + 1;
        t.homeStreak = Math.min(0, t.homeStreak) - 1;
      }
      t.gymPf = (t.gymPf ?? 0) + (id === slot.homeId ? hs : as);
      t.gymPa = (t.gymPa ?? 0) + (id === slot.homeId ? as : hs);
    }
    nextTeams[id] = t;
  };
  apply(slot.homeId, homeWin, slot.site === "home");
  apply(slot.awayId, !homeWin, false);
  if (nextTeams[slot.homeId]) nextTeams[slot.homeId] = bumpSeries(nextTeams[slot.homeId]!, slot.awayId, homeWin, hs, as);
  if (nextTeams[slot.awayId]) nextTeams[slot.awayId] = bumpSeries(nextTeams[slot.awayId]!, slot.homeId, !homeWin, as, hs);
  const youIn = slot.homeId === state.playerTeamId || slot.awayId === state.playerTeamId;
  const statHome = result.recap?.homeLeaders ?? lines?.home;
  const statAway = result.recap?.awayLeaders ?? lines?.away;
  const players = bumpMinutes({ ...state, players: state.players }, slot.homeId, slot.awayId, statHome, statAway);
  let next: GameState = {
    ...state,
    teams: nextTeams,
    players,
    results: [...state.results, result],
    schedule: (() => {
      const idx = state.schedule.findIndex((g) => g.id === slot.id);
      if (idx < 0) return state.schedule;
      const copy = state.schedule.slice();
      copy[idx] = { ...copy[idx]!, resultId: result.id };
      return copy;
    })(),
    liveGame: state.liveGame?.slotId === slot.id ? null : state.liveGame,
  };
  const margin = Math.abs(hs - as);
  const notable = margin <= 3 || margin >= 18;
  if (youIn) next = { ...next, recordBook: stampBook(next, result) };
  if (youIn || (notable && rng() < 0.2) || rng() < 0.05) {
    next = newsFor(next, slot, result, { log: forced?.log, tape: simmed?.tape });
  }
  next = rollGameInjuries(next, slot, rng);
  if (youIn) {
    const ctx = gameCtx(next, slot.id);
    if (ctx) {
      next = { ...next, mail: afterGameMail(next, ctx) };
    }
  }
  return next;
}

export function closeLive(state: GameState): GameState {
  const live = state.liveGame;
  if (!live) return state;
  if (live.sandbox) return { ...state, liveGame: null };
  const slot = state.schedule.find((g) => g.id === live.slotId);
  if (!slot) return { ...state, liveGame: null };
  const rng = mulberry32(state.seed ^ hashString(slot.id) ^ 0x11);
  const boxes = boxFromLive(live);
  const minutes = boxes.minutes;
  const homeLines = live.homeLines?.length ? clampPlayerFta(scaleLiveMinutes(live.homeLines, minutes), minutes) : undefined;
  const awayLines = live.awayLines?.length ? clampPlayerFta(scaleLiveMinutes(live.awayLines, minutes), minutes) : undefined;
  const fixed = reconcileFinal(homeLines ?? [], awayLines ?? [], live.homeScore, live.awayScore);
  const hs = fixed.homeScore;
  const as = fixed.awayScore;
  const next = simSlot(state, slot, rng, {
    homeScore: hs,
    awayScore: as,
    homeBox: boxes.home,
    awayBox: boxes.away,
    minutes,
    log: live.log,
    homeLines,
    awayLines,
  });
  if (live.shots?.length) {
    const last = next.results[next.results.length - 1];
    if (last?.recap) {
      const results = next.results.slice();
      results[results.length - 1] = { ...last, recap: { ...last.recap, shots: live.shots.slice(-80) } };
      return { ...next, results };
    }
  }
  return next;
}

export function beginLiveGame(state: GameState): GameState | null {
  if (state.liveGame?.done) state = closeLive(state);
  return startLiveGame(state);
}

export function runLivePossession(state: GameState): GameState {
  return stepLive(state, 1);
}

export function runLiveRest(state: GameState, opts?: { finish?: boolean }): GameState {
  return simRestLive(state, opts);
}

function openThisWeek(state: GameState) {
  return state.schedule.filter((g) => !g.resultId && !g.declined && g.week === state.week);
}

function regularLeft(state: GameState) {
  return state.schedule.some((g) => isRegular(g) && !g.resultId && !g.declined);
}

function earliestOpenRegular(state: GameState): number | null {
  let week: number | null = null;
  for (const g of state.schedule) {
    if (g.resultId || g.declined || !isRegular(g)) continue;
    if (week == null || g.week < week) week = g.week;
  }
  return week;
}

function wrapRegularWeek(s: GameState, rng: Rng): GameState {
  s = stampHeat(s);
  s = { ...s, players: applyChemistryWeek({ ...s, players: inSeasonGrowth(s, s.playerTeamId, rng) }), recruitingHours: WEEK_HOURS + staffHourBonus(s), mail: weeklyStakeholderMail(s, s.week) };
  s = tickInjuries(s);
  s = tickCompliance(s);
  s = tickPromises(s);
  s = cpuRecruitWeek(s, rng);
  s = assistRecruitWeek(s, rng);
  s = rollPotw(s);
  s = weeklyTake(s, rng);
  s = tickPodcasts(s, rng);
  s = tickFlips(s, rng);
  s = tickFatigue(s);
  s = tickEvents(s);
  if (!regularLeft(s)) {
    s = continuePostseason({ ...s, phase: "conference" });
    return tickPodcasts(s, rng);
  }
  const later = s.schedule.filter((g) => isRegular(g) && !g.resultId && g.week > s.week).sort((a, b) => a.week - b.week)[0]
    ?? s.schedule.filter((g) => isRegular(g) && !g.resultId).sort((a, b) => a.week - b.week)[0];
  s = { ...s, week: later ? later.week : s.week + 1, phase: "regular", talksThisWeek: 0 };
  s = tickPortal(s, rng);
  s = { ...s, gotdId: gameOfDay(s)?.id ?? null };
  s = { ...s, leaders: snapshotLeaders(s) };
  s = rollStory(s);
  return s;
}

function simOpenWeek(state: GameState, rng: Rng): GameState {
  let s = state;
  for (const g of openThisWeek(s)) {
    if (s.schedule.find((x) => x.id === g.id)?.resultId) continue;
    s = simSlot(s, g, rng);
  }
  return s;
}

export function simWeek(state: GameState): GameState {
  if (state.phase === "preseason") return lockSchedule(state);
  if (state.phase === "offseason") return state;
  if (state.pendingStory) state = resolveStory(state, state.pendingStory.choices.find((c) => c.tone === "even")?.id ?? state.pendingStory.choices[0]?.id ?? "even").state;
  if (state.liveGame && !state.liveGame.done) state = runLiveRest(state);
  if (state.liveGame?.done) state = closeLive(state);

  let s = state;
  const rng = mulberry32(s.seed ^ (s.week * 104729) ^ s.results.length);

  if (s.phase === "regular") {
    const earliest = earliestOpenRegular(s);
    if (earliest != null && earliest < s.week) s = { ...s, week: earliest };
    s = simOpenWeek(s, rng);
    return wrapRegularWeek(s, rng);
  }

  const leftover = s.schedule.filter((g) => !g.resultId && !g.declined);
  if (leftover.length) {
    const week = leftover.sort((a, b) => a.week - b.week)[0]!.week;
    const advanced = week !== s.week;
    s = { ...s, week };
    for (const g of leftover.filter((x) => x.week === week)) {
      if (s.schedule.find((x) => x.id === g.id)?.resultId) continue;
      s = simSlot(s, g, rng);
    }
    if (advanced) s = tickInjuries(s);
  }
  s = continuePostseason(s);
  return tickPodcasts(s, rng);
}

function drainUntilYourGame(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (!nextYourGame(s) && s.phase !== "offseason" && guard++ < 40) {
    const mark = `${s.phase}:${s.week}:${s.results.length}`;
    s = simWeek(s);
    if (`${s.phase}:${s.week}:${s.results.length}` === mark) break;
  }
  return s;
}

export function simGame(state: GameState): GameState {
  if (state.phase === "preseason") return lockSchedule(state);
  if (state.pendingStory) state = resolveStory(state, state.pendingStory.choices[0]?.id ?? "even").state;
  if (state.liveGame && !state.liveGame.done) state = runLiveRest(state);
  if (state.liveGame?.done) state = closeLive(state);

  const g = nextYourGame(state);
  if (!g) return drainUntilYourGame(state);

  let s = state;
  if (s.phase === "regular") {
    let guard = 0;
    while (s.phase === "regular" && s.week < g.week && guard++ < REGULAR_WEEKS + 4) {
      const earliest = earliestOpenRegular(s);
      if (earliest == null) break;
      if (earliest >= g.week) {
        s = { ...s, week: g.week };
        break;
      }
      s = { ...s, week: earliest };
      s = simWeek(s);
      if (s.schedule.find((x) => x.id === g.id)?.resultId) return s;
    }
  }

  const slot = s.schedule.find((x) => x.id === g.id);
  if (!slot || slot.resultId) return s;

  const rng = mulberry32(s.seed ^ hashString(g.id) ^ 0x5e1);
  s = { ...s, week: g.week };
  const you = s.playerTeamId;
  for (const other of s.schedule.filter((x) => !x.resultId && !x.declined && x.week === g.week && x.id !== g.id && x.homeId !== you && x.awayId !== you)) {
    s = simSlot(s, other, rng);
  }
  s = simSlot(s, slot, rng);

  const nxt = nextYourGame(s);
  if (!nxt || nxt.week > g.week) {
    if (s.phase === "regular") {
      const wrapRng = mulberry32(s.seed ^ (s.week * 104729) ^ s.results.length);
      s = wrapRegularWeek(s, wrapRng);
    } else {
      s = continuePostseason(s);
    }
  }
  return s;
}

function cpuRecruitWeek(state: GameState, rng: Rng): GameState {
  const taken = new Map<string, number>();
  const returning = new Map<string, number>();
  for (const p of state.players) {
    if (p.year < 4 || p.redshirt) returning.set(p.teamId, (returning.get(p.teamId) ?? 0) + 1);
  }
  for (const r of state.recruits) {
    if (r.committedTo) taken.set(r.committedTo, (taken.get(r.committedTo) ?? 0) + 1);
  }
  const spots = (id: string) => Math.max(0, SCHOLARSHIPS - (returning.get(id) ?? 0) - (taken.get(id) ?? 0));
  const g = prestigeGravity(state);
  const recruits = state.recruits.map((r) => {
    if (r.committedTo && r.committedTo !== state.playerTeamId) return r;
    const interest = { ...r.interest };
    for (const t of TEAMS) {
      if (t.id === state.playerTeamId) continue;
      if (rng() > 0.11) continue;
      const fit = prestigeFit(r, t.id);
      const cur = interest[t.id] ?? Math.round(fit * 0.82);
      interest[t.id] = clamp(cur + randInt(rng, 2, 6) + Math.round((t.prestige >= 88 ? 3 : t.prestige >= 76 ? 1 : 0) * g), 0, 99);
    }
    if (r.committedTo === state.playerTeamId) return { ...r, interest };
    const ranked = Object.entries(interest)
      .filter(([id]) => id !== state.playerTeamId && spots(id) > 0)
      .sort((a, b) => b[1] - a[1]);
    const best = ranked[0];
    if (!best) return { ...r, interest };
    const heat = best[1];
    const p = heat >= 80 ? 0.2 : heat >= 68 ? 0.11 : heat >= 58 ? 0.05 : 0;
    const late = state.week >= 10 ? 0.1 : state.week >= 6 ? 0.04 : 0;
    if (rng() < p + late) {
      taken.set(best[0], (taken.get(best[0]) ?? 0) + 1);
      return { ...r, interest, committedTo: best[0] };
    }
    return { ...r, interest };
  });
  return { ...state, recruits };
}

export function goOffseason(state: GameState): GameState {
  const rng = mulberry32(state.seed ^ (state.season * 104729) ^ 0xd0e);
  const closed = { ...state, recordBook: closeSeasonBook(state), leaders: snapshotLeaders(state) };
  return tickDonors(enterOffseason(closed), rng);
}

export function startNextSeason(state: GameState): GameState {
  if (draftWaiting(state)) state = settleDraft(state);
  const review = state.contractReview;
  if (review && !review.resolved && (review.decision === "fire" || review.decision === "extend")) {
    console.warn(
      `[engine] startNextSeason blocked: contract review "${review.decision}" is unresolved. Resolve it first.`,
    );
    return state;
  }
  const rolled = rollSeason(state.phase === "offseason" ? state : enterOffseason(state));
  const prevSeason = state.season;
  const decade = eraDecadeForSeason(rolled.season, state.eraDecade);
  let next: GameState = applyYearRealignment(
    decade !== state.eraDecade ? { ...rolled, eraDecade: decade } : rolled,
    prevSeason,
    rolled.season,
  );
  if (eraHasNil(next.eraDecade) && next.nilCap <= 0) next = { ...next, nilCap: 100 };
  if (!eraHasNil(next.eraDecade)) next = { ...next, nilCap: 0 };
  const portEra = eraPortal(next.eraDecade);
  if (portEra === "none") {
    if (next.portal?.window !== "none") next = { ...next, portal: { season: next.season, window: "none", transfers: [], hours: 0 } };
  } else if (next.portal?.window === "none") {
    next = { ...next, portal: { ...(next.portal ?? { season: next.season, transfers: [], hours: 0 }), window: "closed" } };
  }
  const opened: GameState = {
    ...next,
    schedule: confSchedule(next.seed ^ next.season, next.teams),
    phase: "preseason",
    week: 0,
    settings: settingsOf(next),
    selection: null,
    results: [],
    liveGame: null,
  };
  return tickProgramWeek(tickProgramYear(opened));
}

export function heatMark(r: Recruit, teamId: string, state?: GameState): "up" | "down" | "flat" {
  const now = interestIn(r, teamId, state);
  if (r.heatWas == null) return "flat";
  if (now > r.heatWas + 1) return "up";
  if (now < r.heatWas - 1) return "down";
  return "flat";
}

function stampHeat(state: GameState): GameState {
  const you = state.playerTeamId;
  return {
    ...state,
    recruits: state.recruits.map((r) => ({ ...r, heatWas: interestIn(r, you, state) })),
  };
}

function bumpSeries(t: TeamRuntime, oppId: string, won: boolean, youScore: number, themScore: number): TeamRuntime {
  const prev = t.series?.[oppId] ?? { w: 0, l: 0, last: "", lastWin: false, streak: 0 };
  const streak = won ? (prev.streak > 0 ? prev.streak + 1 : 1) : (prev.streak < 0 ? prev.streak - 1 : -1);
  return {
    ...t,
    series: {
      ...(t.series ?? {}),
      [oppId]: {
        w: prev.w + (won ? 1 : 0),
        l: prev.l + (won ? 0 : 1),
        last: `${youScore}-${themScore}`,
        lastWin: won,
        streak,
      },
    },
  };
}

export function seriesVs(state: GameState, a: string, b: string): { aWins: number; bWins: number; last: string; streak: number; lastWin: boolean } | null {
  const mark = state.teams[a]?.series?.[b];
  if (mark && (mark.w + mark.l) > 0) {
    return { aWins: mark.w, bWins: mark.l, last: mark.last, streak: mark.streak, lastWin: mark.lastWin };
  }
  const games = state.results.filter((r) =>
    (r.homeId === a && r.awayId === b) || (r.homeId === b && r.awayId === a),
  );
  if (!games.length) return null;
  let aWins = 0;
  let bWins = 0;
  for (const r of games) {
    const aHome = r.homeId === a;
    const aScore = aHome ? r.homeScore : r.awayScore;
    const bScore = aHome ? r.awayScore : r.homeScore;
    if (aScore > bScore) aWins++;
    else bWins++;
  }
  const last = games[games.length - 1]!;
  const aHome = last.homeId === a;
  const aScore = aHome ? last.homeScore : last.awayScore;
  const bScore = aHome ? last.awayScore : last.homeScore;
  const lastWin = aScore > bScore;
  let streak = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    const g = games[i]!;
    const ah = g.homeId === a;
    const as = ah ? g.homeScore : g.awayScore;
    const bs = ah ? g.awayScore : g.homeScore;
    const won = as > bs;
    if (streak === 0) streak = won ? 1 : -1;
    else if ((streak > 0 && won) || (streak < 0 && !won)) streak += won ? 1 : -1;
    else break;
  }
  return { aWins, bWins, last: `${aScore}-${bScore}`, streak, lastWin };
}

export function runLabel(run?: string): string {
  if (run === "title") return "NCAA title";
  if (run === "f4") return "Final Four";
  if (run === "e8") return "Elite Eight";
  if (run === "s16") return "Sweet 16";
  if (run === "bid") return "NCAA bid";
  if (run === "nit") return "NIT";
  if (run === "crown") return "CBI";
  return "";
}

export function interestIn(r: Recruit, teamId: string, state?: GameState) {
  const mem = state ? memoryBump(state, teamId, r) : null;
  const heat = recruitInterest(r, teamId) + (mem ? mem.pipe + mem.bond : pipelineBonus(r, teamId));
  const extra = state && teamId === state.playerTeamId ? recruitBias(state) + staffRecruitBonus(state) : 0;
  return clamp(heat + extra, 0, 99);
}

export function isTargeted(r: Recruit, teamId: string) {
  if (r.dropped && r.committedTo !== teamId) return false;
  return r.scouted || r.offers.includes(teamId) || r.visits.includes(teamId) || r.committedTo === teamId;
}

export function signChance(r: Recruit, state: GameState): number {
  if (r.committedTo === state.playerTeamId) return 100;
  if (r.committedTo) return 0;
  return signParts(r, state, interestIn(r, state.playerTeamId, state)).chance;
}

export function dropTarget(state: GameState, id: string): { state: GameState; feedback: Feedback } {
  const r = state.recruits.find((x) => x.id === id);
  if (!r) return { state, feedback: { title: "Gone", detail: "", parts: [] } };
  if (r.committedTo === state.playerTeamId) return { state, feedback: { title: "Already committed", detail: `${r.first} ${r.last} is already in the class.`, parts: [] } };
  const you = state.playerTeamId;
  const recruits = state.recruits.map((x) => {
    if (x.id !== id) return x;
    return {
      ...x,
      dropped: true,
      offers: x.offers.filter((o) => o !== you),
      visits: x.visits.filter((v) => v !== you),
    };
  });
  return {
    state: { ...state, recruits },
    feedback: { title: `Off the list`, detail: `${r.first} ${r.last} is no longer a target. The scholarship is back if you had an offer out.`, parts: [] },
  };
}

export function pitchNil(state: GameState, id: string): { state: GameState; feedback: Feedback } {
  if (!settingsOf(state).nilOn || state.nilCap <= 0) {
    return { state, feedback: { title: "NIL is off", detail: "This era, or this setting, has no pool.", parts: [] } };
  }
  const r = state.recruits.find((x) => x.id === id);
  if (!r) return { state, feedback: { title: "Gone", detail: "", parts: [] } };
  if (r.committedTo === state.playerTeamId) return { state, feedback: { title: "Already in", detail: "", parts: [] } };
  if (state.nilCap < 10) return { state, feedback: { title: "Pool's dry", detail: "Need 10 in the cap to bump a number.", parts: [] } };
  const bump = 8 + Math.round((r.wants.nil ?? 50) / 20);
  const recruits = state.recruits.map((x) => {
    if (x.id !== id) return x;
    const cur = interestIn(x, state.playerTeamId, state);
    return { ...x, interest: { ...x.interest, [state.playerTeamId]: clamp(cur + bump, 0, 99) } };
  });
  return {
    state: { ...state, recruits, nilCap: state.nilCap - 10 },
    feedback: { title: `NIL bump for ${r.first}`, detail: `The number moved. Interest +${bump}.`, parts: [{ label: "NIL", delta: -10 }, { label: "Interest", delta: bump }] },
  };
}

function rollWatch(state: GameState): GameState["watch"] {
  return state.players
    .filter((p) => !p.redshirt)
    .slice()
    .sort((a, b) => b.ovr - a.ovr || b.potential - a.potential)
    .slice(0, 10)
    .map((p) => ({
      name: `${p.first} ${p.last}`,
      teamId: p.teamId,
      yours: p.teamId === state.playerTeamId,
      pos: p.pos,
      ovr: p.ovr,
    }));
}

export function recruitStage(r: Recruit, teamId: string, state?: GameState): "signed" | "verbal" | "close" | "leaning" | "offered" | "visited" | "scouted" | "board" {
  if (r.committedTo === teamId) {
    const flips = state ? settingsOf(state).flipsOn : false;
    const late = state ? state.phase === "offseason" || state.week >= 14 : false;
    return flips && !late ? "verbal" : "signed";
  }
  const heat = interestIn(r, teamId, state);
  const offered = r.offers.includes(teamId);
  if (offered && heat >= 68) return "close";
  if (offered && heat >= 48) return "leaning";
  if (offered) return "offered";
  if (r.visits.includes(teamId)) return "visited";
  if (r.scouted) return "scouted";
  return "board";
}

export function scholarshipsLeft(state: GameState) {
  const returning = state.players.filter((p) => p.teamId === state.playerTeamId && (p.year < 4 || p.redshirt)).length;
  const signed = state.recruits.filter((r) => r.committedTo === state.playerTeamId).length;
  const port = portalPaper(state).incoming;
  return Math.max(0, SCHOLARSHIPS - returning - signed - port);
}

export function recruitingProgress(state: GameState) {
  const you = state.playerTeamId;
  const returning = state.players.filter((p) => p.teamId === you && (p.year < 4 || p.redshirt)).length;
  const signedRec = state.recruits.filter((r) => r.committedTo === you);
  const signed = signedRec.length;
  const portalIn = portalPaper(state).incoming;
  const paper = state.recruits.filter((r) => r.offers.includes(you) && r.committedTo !== you).length + portalPaper(state).offered;
  const spots = SCHOLARSHIPS;
  const left = Math.max(0, spots - returning - signed - portalIn);
  const open = left;
  const close = state.recruits.filter((r) => r.committedTo !== you && r.offers.includes(you) && interestIn(r, you, state) >= 68).length;
  const leaning = state.recruits.filter((r) => r.committedTo !== you && r.offers.includes(you) && interestIn(r, you, state) >= 48 && interestIn(r, you, state) < 68).length;
  const visited = state.recruits.filter((r) => r.visits.includes(you)).length;
  const targets = state.recruits.filter((r) => isTargeted(r, you) && r.committedTo !== you).length;
  return {
    taken: signed + portalIn,
    spots,
    hours: state.recruitingHours,
    targets,
    returning,
    signed,
    paper,
    open,
    close,
    leaning,
    left,
    portalIn,
    visited,
    signedNames: signedRec.map((r) => r.last).slice(0, 6),
  };
}

function spendHours(state: GameState, n: number): GameState | null {
  if (state.recruitingHours < n) return null;
  return { ...state, recruitingHours: state.recruitingHours - n };
}

export function scoutRecruit(state: GameState, id: string): { state: GameState; feedback: Feedback } {
  const r = state.recruits.find((x) => x.id === id);
  if (!r) return { state, feedback: { title: "Gone", detail: "", parts: [] } };
  if (r.scouted) return { state, feedback: { title: "Already scouted", detail: `${r.first} ${r.last}`, parts: [] } };
  const paid = spendHours(state, 1);
  if (!paid) return { state, feedback: { title: "No hours", detail: "Wait until next week.", parts: [] } };
  const rec = paid.recruitingHours;
  const recruits = paid.recruits.map((x) => (x.id === id ? { ...x, scouted: true, interest: { ...x.interest, [state.playerTeamId]: clamp(seedHeat(x, state.playerTeamId) + 3, 0, 99) } } : x));
  return {
    state: absorbBoard(state, { ...paid, recruitingHours: rec, recruits }),
    feedback: { title: `Scouted ${r.first}`, detail: r.freakTag ? `${r.freakTag}. Wants ${r.wants.style}.` : `Wants ${r.wants.style}.`, parts: [{ label: "Hours", delta: -1 }] },
  };
}

export function offerRecruit(state: GameState, id: string): { state: GameState; feedback: Feedback } {
  const r = state.recruits.find((x) => x.id === id);
  if (!r) return { state, feedback: { title: "Gone", detail: "", parts: [] } };
  if (r.offers.includes(state.playerTeamId)) return { state, feedback: { title: "Already offered", detail: `${r.first} ${r.last}`, parts: [] } };
  if (scholarshipsLeft(state) <= 0) return { state, feedback: { title: "No scholarships", detail: "You're out of scholarships this class.", parts: [] } };
  const paid = spendHours(state, 2);
  if (!paid) return { state, feedback: { title: "No hours", detail: "Wait until next week.", parts: [] } };
  const nilBump =
    state.nilCap <= 0
      ? r.wants.nil > 60
        ? -3
        : 0
      : clamp(Math.round((state.nilCap - r.nilAsk) / 12), -4, 5);
  const bump = 10 + Math.round(((state.coachSkills?.recruiting ?? 50) - 50) / 8) + nilBump + recruitBias(state) * 0.15;
  const recruits = paid.recruits.map((x) => {
    if (x.id !== id) return x;
    const interest = { ...x.interest, [state.playerTeamId]: clamp(seedHeat(x, state.playerTeamId) + bump, 0, 99) };
    return { ...x, offers: [...x.offers, state.playerTeamId], interest };
  });
  const offered = absorbBoard(state, { ...paid, recruits });
  return {
    state: noteOffer(offered, r),
    feedback: { title: `Offered ${r.first} ${r.last}`, detail: "The scholarship is on the table.", parts: [{ label: "Hours", delta: -2 }] },
  };
}

export function visitRecruit(state: GameState, id: string): { state: GameState; feedback: Feedback } {
  const r = state.recruits.find((x) => x.id === id);
  if (!r) return { state, feedback: { title: "Gone", detail: "", parts: [] } };
  const noted = noteVisit(state, r);
  if (noted.blocked) return { state: noted.state, feedback: { title: "Dead period", detail: noted.blocked, parts: [] } };
  const paid = spendHours(noted.state, 3);
  if (!paid) return { state: noted.state, feedback: { title: "No hours", detail: "Wait until next week.", parts: [] } };
  const bump = 8 + Math.round(((state.coachSkills?.recruiting ?? 50) - 50) / 10);
  const rng = mulberry32(state.seed ^ hashString(id) ^ (state.week * 13) ^ 0xf11);
  let flipped = false;
  let fromName = "";
  const recruits = paid.recruits.map((x) => {
    if (x.id !== id) return x;
    const visits = x.visits.includes(state.playerTeamId) ? x.visits : [...x.visits, state.playerTeamId];
    const interest = { ...x.interest, [state.playerTeamId]: clamp(seedHeat(x, state.playerTeamId) + bump + pipelineBonus(x, state.playerTeamId), 0, 99) };
    let committedTo = x.committedTo;
    const prevCommit = x.committedTo;
    if (prevCommit && prevCommit !== state.playerTeamId && settingsOf(state).flipsOn) {
      const them = interest[prevCommit] ?? prestigeFit(x, prevCommit);
      const us = interest[state.playerTeamId] ?? 0;
      if (us > them + 5 && rng() < 0.28 + (us - them) / 90) {
        committedTo = state.playerTeamId;
        flipped = true;
        fromName = TEAM_BY_ID[prevCommit]?.name ?? "their commit";
      }
    }
    return { ...x, visits, interest, committedTo, flipped: flipped || x.flipped };
  });
  let next: GameState = absorbBoard(state, { ...paid, recruits });
  if (flipped) next = markCommit(next, r, `He was in with ${fromName}. The in-home visit flipped him.`);
  return {
    state: next,
    feedback: {
      title: flipped ? `${r.first} flipped` : `Visited ${r.first}`,
      detail: flipped ? `He was in with ${fromName}. The in-home visit flipped him.` : "The in-home visit is done.",
      parts: [{ label: "Hours", delta: -3 }, ...(flipped ? [{ label: "Flip", delta: 1 }] : [])],
    },
  };
}

export function signGate(offered: boolean, asked: boolean): string | null {
  if (!offered) return "Put a scholarship on the table first.";
  if (asked) return "Already asked this week.";
  return null;
}

export function signRecruit(state: GameState, id: string): { state: GameState; feedback: Feedback } {
  const r = state.recruits.find((x) => x.id === id);
  if (!r) return { state, feedback: { title: "Gone", detail: "", parts: [] } };
  if (r.committedTo === state.playerTeamId) return { state, feedback: { title: "Already in", detail: `${r.first} ${r.last}`, parts: [] } };
  if (scholarshipsLeft(state) <= 0) return { state, feedback: { title: "No scholarships", detail: "", parts: [] } };
  if (!r.offers.includes(state.playerTeamId) && !settingsOf(state).godMode) {
    return { state, feedback: { title: "No offer", detail: "Put a scholarship on the table first.", parts: [] } };
  }
  if (settingsOf(state).godMode) {
    const forced = forceCommit(state, id);
    return forced.ok
      ? { state: forced.state, feedback: { title: `${r.first} committed`, detail: "God Mode. The pledge is in.", parts: [{ label: "Commit", delta: 1 }] } }
      : { state, feedback: { title: "No", detail: "", parts: [] } };
  }
  const asked = r.signAsk?.season === state.season && r.signAsk.week === state.week;
  if (asked && r.signAsk && !r.signAsk.hit) {
    return { state, feedback: { title: "Already asked", detail: `${r.first} said no this week. Ask again next week.`, parts: [] } };
  }
  const blocked = signGate(true, Boolean(asked));
  if (blocked) return { state, feedback: { title: "Not yet", detail: blocked, parts: [] } };
  const chance = signChance(r, state);
  const roll = mulberry32(state.seed ^ hashString(id) ^ ((state.season * 53 + state.week) * 997) ^ 0x51a9)();
  const hit = roll * 100 < chance;
  const verbal = settingsOf(state).flipsOn && state.phase !== "offseason" && state.week < 14;
  const recruits = state.recruits.map((x) =>
    x.id === id
      ? {
          ...x,
          signAsk: { season: state.season, week: state.week, hit },
          committedTo: hit ? state.playerTeamId : x.committedTo,
          offers: x.offers.includes(state.playerTeamId) ? x.offers : [...x.offers, state.playerTeamId],
        }
      : x,
  );
  if (!hit) {
    return {
      state: { ...state, recruits },
      feedback: { title: `${r.first} said no`, detail: `${chance}% this week. He said no. Ask again next week.`, parts: [] },
    };
  }
  const next = absorbBoard(state, markCommit({ ...state, recruits }, r, verbal ? "Verbal. He can still flip until signing day." : `${r.stars}★ ${r.pos}. Signed.`));
  return {
    state: next,
    feedback: {
      title: verbal ? `${r.first} ${r.last} committed` : `${r.first} ${r.last} signed`,
      detail: verbal ? "Verbal. He can still flip until signing day." : "Signed.",
      parts: [{ label: "Commit", delta: 1 }],
    },
  };
}

function rosterPosNeed(state: GameState): Record<string, number> {
  const counts: Record<string, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  for (const p of state.players) {
    if (p.teamId === state.playerTeamId && (p.year < 4 || p.redshirt)) counts[p.pos] = (counts[p.pos] ?? 0) + 1;
  }
  for (const r of state.recruits) {
    if (r.committedTo === state.playerTeamId) counts[r.pos] = (counts[r.pos] ?? 0) + 1;
  }
  return counts;
}

function staffTargetScore(state: GameState, r: Recruit): number {
  const you = state.playerTeamId;
  const prestige = TEAM_BY_ID[you]?.prestige ?? 60;
  const target = prestige >= 88 ? 5 : prestige >= 78 ? 4 : prestige >= 64 ? 3 : 2;
  const need = rosterPosNeed(state);
  const posGap = 4 - (need[r.pos] ?? 0);
  const int = interestIn(r, you, state);
  let score = r.stars * 12 - Math.abs(r.stars - target) * 9 + int + posGap * 6 + (r.scouted ? 4 : 0);
  if (r.path === "juco") score += prestige < 70 ? 10 : prestige >= 82 ? -8 : 3;
  if (r.freak) score += 5;
  return score;
}

export function assistRecruitWeek(state: GameState, rng: Rng): GameState {
  if (!state.cpuRecruit) return state;
  if (state.phase !== "regular" && state.phase !== "preseason") return state;
  let s = state;
  const you = s.playerTeamId;
  const visited = new Set<string>();
  const offered = new Set<string>();
  let guard = 0;
  while (s.recruitingHours > 0 && guard++ < 16) {
    const open = s.recruits.filter((r) => !r.committedTo || r.committedTo === you);
    const live = open.filter((r) => r.committedTo !== you);
    const onOffer = live.filter((r) => r.offers.includes(you));
    const sch = scholarshipsLeft(s);

    const visitTarget = onOffer
      .filter((r) => !visited.has(r.id) && interestIn(r, you, s) < 82)
      .sort((a, b) => staffTargetScore(s, b) - staffTargetScore(s, a) || rng() - 0.5)[0];
    if (visitTarget && s.recruitingHours >= 3) {
      const next = visitRecruit(s, visitTarget.id);
      if (next.state.recruitingHours < s.recruitingHours) {
        visited.add(visitTarget.id);
        s = next.state;
        continue;
      }
    }

    if (sch > 0 && s.recruitingHours >= 2) {
      const unoffered = live
        .filter((r) => !r.offers.includes(you) && !offered.has(r.id))
        .sort((a, b) => staffTargetScore(s, b) - staffTargetScore(s, a));
      const pickR = unoffered[0];
      if (pickR) {
        if (!pickR.scouted && s.recruitingHours >= 3) {
          const next = scoutRecruit(s, pickR.id);
          if (next.state.recruitingHours < s.recruitingHours) {
            s = next.state;
            continue;
          }
        }
        const next = offerRecruit(s, pickR.id);
        if (next.state.recruitingHours < s.recruitingHours) {
          offered.add(pickR.id);
          s = next.state;
          continue;
        }
      }
    }

    if (s.recruitingHours >= 1) {
      const unscouted = live.filter((r) => !r.scouted).sort((a, b) => b.stars - a.stars || staffTargetScore(s, b) - staffTargetScore(s, a))[0];
      if (unscouted) {
        const next = scoutRecruit(s, unscouted.id);
        if (next.state.recruitingHours < s.recruitingHours) {
          s = next.state;
          continue;
        }
      }
    }
    break;
  }
  const beforeLottery = s;
  if (s.cpuRecruit) {
    const returning = s.players.filter((p) => p.teamId === you && (p.year < 4 || p.redshirt)).length;
    let left = Math.max(0, SCHOLARSHIPS - returning - s.recruits.filter((r) => r.committedTo === you).length);
    let five = s.recruits.filter((r) => r.committedTo === you && r.stars >= 5).length;
    const late = s.week >= 8 ? 0.1 : s.week >= 4 ? 0.05 : 0;
    const floor = signFloor(s);
    s = {
      ...s,
      recruits: s.recruits.map((r) => {
        if (left <= 0 || r.committedTo || !r.offers.includes(you)) return r;
        const heat = interestIn(r, you, s);
        if (heat < Math.min(58, floor - 8)) return r;
        if (heat < 70 && !r.visits.includes(you)) return r;
        if (r.stars >= 5 && five >= 2 && heat < 84) return r;
        const p = (heat >= 78 ? 0.34 : heat >= 68 ? 0.22 : 0.14) + late;
        if (rng() < p) {
          left--;
          if (r.stars >= 5) five++;
          return { ...r, committedTo: you };
        }
        return r;
      }),
    };
  }
  return rememberSigns(beforeLottery, s);
}

export function setAssistedRecruit(state: GameState, on: boolean): { state: GameState; feedback: Feedback } {
  let next: GameState = { ...state, cpuRecruit: on };
  if (on) {
    const rng = mulberry32(state.seed ^ (state.week * 104729) ^ 0xa551);
    next = assistRecruitWeek(next, rng);
    next = assistPortalWeek(next, rng);
  }
  const spent = on ? Math.max(0, state.recruitingHours - next.recruitingHours) : 0;
  const portalSpent = on ? Math.max(0, portalOf(state).hours - portalOf(next).hours) : 0;
  return {
    state: next,
    feedback: {
      title: on ? "Assisted recruiting on" : "Assisted recruiting off",
      detail: on
        ? spent || portalSpent
          ? `Staff used ${spent} recruiting hours on high school prospects${portalSpent ? ` and ${portalSpent} in the portal` : ""}.`
          : "Staff will scout, offer, and visit with this week's recruiting time. Portal time is separate."
        : "You're back on the trail. Scout, offer, and visit yourself.",
      parts: spent ? [{ label: "Hours", delta: -spent }] : [],
    },
  };
}

export function answerPresser(state: GameState, _id: string): { state: GameState; feedback: Feedback } {
  if (!state.pendingPresser) return { state, feedback: { title: "", detail: "", parts: [] } };
  return {
    state: { ...state, pendingPresser: null },
    feedback: { title: "", detail: "", parts: [] },
  };
}