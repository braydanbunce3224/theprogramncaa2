// @ts-nocheck
import type { CoachHistory, GameState, Player, Recruit } from "./types";
import { SCHOLARSHIPS, WEEK_HOURS } from "./types";
import { CONFERENCES, TEAM_BY_ID, TEAMS } from "./teams";
import { clamp, hashString, mulberry32, randInt, pick, gaussian } from "./rng";
import { randomPersonName, randomIntlName } from "./people-names";
import { FreakKinds, INTL, heightFor, preseasonWatch } from "./depth";
import { makeContract, applyReview, openingLetter } from "./contract";
import { emptyCompliance } from "./compliance";
import { emptySheet } from "./market";
import { defaultSettings } from "./league";
import { eraHasNil } from "./era";
import { ensurePortal, tickPortal, enrollPortal, portalOf } from "./portal";
import { brief, campCopy, hydrateNews } from "./wire";
import { estimateGameBoxes } from "./engine-util";
import { rollCareer as rollCareerSafe } from "./records";
import { focusSkill, openCamp, lockCamp } from "./camp";
import { recordHof } from "./hof";
import { gradePromises } from "./locker";
import { rollAwards } from "./awards";
import { repairStoredMonsters, stampSeasonArchive } from "./archives";
import { isPhantomTest, listCustomSchools, mountCustomList } from "./custom-schools";
import { openDraft } from "./college";
import { makeReportCard } from "./card";
import { bustChemCache } from "./chemistry";
import { tickPodcasts, hydratePodcasts } from "./podcast";
import { ensureProgram } from "./program";

export const SKILL_LABEL = [
	{
		id: "shoot",
		label: "Shoot"
	},
	{
		id: "finish",
		label: "Finish"
	},
	{
		id: "defense",
		label: "Defense"
	},
	{
		id: "iq",
		label: "IQ"
	}
] as const;
export const COACH_AXES = [
	{
		id: "offense",
		label: "Offense",
		hint: "You score more"
	},
	{
		id: "defense",
		label: "Defense",
		hint: "They miss more"
	},
	{
		id: "recruiting",
		label: "Recruiting",
		hint: "Offers and visits stick"
	},
	{
		id: "development",
		label: "Development",
		hint: "Kids get better in the gym"
	},
	{
		id: "leadership",
		label: "Leadership",
		hint: "The locker room hears you"
	}
] as const;
export const DEFAULT_COACH = {
	offense: 48,
	defense: 48,
	recruiting: 50,
	development: 46,
	leadership: 50
};
export function emptyHistory(): CoachHistory {
	return {
		seasons: 0,
		wins: 0,
		losses: 0,
		titles: 0,
		ncaaBids: 0,
		confTitles: 0,
		sweet16: 0,
		elite8: 0,
		finalFour: 0,
		nitBids: 0,
		log: []
	};
}
export function prestigeFit(r, teamId) {
	const prestige = TEAM_BY_ID[teamId]?.prestige ?? 60;
	if (r.path === "juco") {
		const ready = (66 - prestige) * .28;
		const brand = (prestige - 50) * .14;
		return clamp(Math.round(30 + ready + brand), 12, 76);
	}
	const brand = (prestige - 50) * (.35 + r.stars * .08);
	const minutes = r.stars <= 2 ? (62 - prestige) * .18 : 0;
	return clamp(Math.round(24 + brand + minutes), 10, 74);
}
export function seedHeat(r, teamId) {
	const stored = r.interest[teamId];
	if (typeof stored === "number" && Number.isFinite(stored)) return stored;
	return prestigeFit(r, teamId);
}
export function recruitInterest(r, teamId) {
	if (r.committedTo === teamId) return 99;
	const offered = r.offers.includes(teamId) ? 8 : 0;
	const visited = r.visits.includes(teamId) ? 10 : 0;
	return clamp(seedHeat(r, teamId) + offered + visited, 0, 99);
}
function compositeOvr(s) {
	return clamp(Math.round(s.shoot * .28 + s.finish * .24 + s.defense * .28 + s.iq * .2), 40, 99);
}
function skillsFromOvr(ovr, pos, rng) {
	const wobble = () => Math.round(gaussian(rng) * 4);
	const bias = {
		PG: {
			shoot: 2,
			finish: -2,
			defense: -1,
			iq: 4
		},
		SG: {
			shoot: 5,
			finish: -1,
			defense: -1,
			iq: 0
		},
		SF: {
			shoot: 1,
			finish: 1,
			defense: 1,
			iq: 0
		},
		PF: {
			shoot: -3,
			finish: 4,
			defense: 2,
			iq: -1
		},
		C: {
			shoot: -6,
			finish: 6,
			defense: 4,
			iq: -2
		}
	}[pos];
	const raw = {
		shoot: clamp(ovr + wobble() + bias.shoot, 40, 99),
		finish: clamp(ovr + wobble() + bias.finish, 40, 99),
		defense: clamp(ovr + wobble() + bias.defense, 40, 99),
		iq: clamp(ovr + wobble() + bias.iq, 40, 99)
	};
	const diff = ovr - compositeOvr(raw);
	if (diff) {
		raw.shoot = clamp(raw.shoot + diff, 40, 99);
		raw.finish = clamp(raw.finish + Math.round(diff * .6), 40, 99);
	}
	return raw;
}
function potentialFor(ovr, year, rng) {
	return clamp(ovr + (year <= 1 ? randInt(rng, 3, 8) : year === 2 ? randInt(rng, 2, 6) : year === 3 ? randInt(rng, 1, 4) : randInt(rng, 0, 2)), ovr, 92);
}
export function makePlayer(opts): Player {
	const skills = opts.skills ?? skillsFromOvr(opts.ovr, opts.pos, opts.rng);
	const ovr = compositeOvr(skills);
	return {
		id: opts.id,
		first: opts.first,
		last: opts.last,
		pos: opts.pos,
		year: opts.year,
		ovr,
		potential: opts.potential ?? potentialFor(ovr, opts.year, opts.rng),
		morale: opts.morale ?? 68 + randInt(opts.rng, -6, 8),
		teamId: opts.teamId,
		mpg: opts.mpg,
		skills,
		seasonMinutes: 0,
		seasonGames: 0,
		careerMinutes: 0,
		careerGames: 0,
		path: void 0,
		redshirt: false,
		usedRedshirt: false,
		injury: null,
		focus: "balanced",
		growth: [],
		usage: clamp(Math.round(opts.mpg * 2.15), 8, 38)
	};
}
var POS = [
	"PG",
	"SG",
	"SF",
	"PF",
	"C"
];
function asPos(v) {
	return POS.includes(v) ? v : "SF";
}
function fillTeam(id, t) {
	const seed = TEAM_BY_ID[id];
	const rawConf = t?.conference ?? seed?.conference ?? "SEC";
	const conference = CONFERENCES.some((c) => c.id === rawConf) ? rawConf : seed?.conference ?? "SEC";
	return {
		id,
		conference,
		prestige: Number.isFinite(t?.prestige) ? Number(t?.prestige) : seed?.prestige ?? 50,
		wins: Number(t?.wins) || 0,
		losses: Number(t?.losses) || 0,
		confW: Number(t?.confW) || 0,
		confL: Number(t?.confL) || 0,
		homeW: Number(t?.homeW) || 0,
		homeL: Number(t?.homeL) || 0,
		homeStreak: Number(t?.homeStreak) || 0,
		gymW: Number(t?.gymW) || 0,
		gymL: Number(t?.gymL) || 0,
		gymPf: Number(t?.gymPf) || 0,
		gymPa: Number(t?.gymPa) || 0,
		coachName: t?.coachName || "Staff",
		coachYear: Number(t?.coachYear) > 0 ? Number(t.coachYear) : undefined,
		allWins: Number(t?.allWins) || 0,
		allLosses: Number(t?.allLosses) || 0,
		series: t?.series && typeof t.series === "object" ? t.series : void 0,
		guest: t?.guest === "D2" || t?.guest === "D3" || t?.guest === "NAIA" ? t.guest : void 0
	};
}
export function ensurePlayer(p, rng) {
	const pos = asPos(p?.pos);
	const ovr = clamp(Number(p?.ovr) || 70, 40, 99);
	const year = clamp(Number(p?.year) || 2, 1, 4);
	const skills = p?.skills && Number.isFinite(p.skills.shoot) ? p.skills : skillsFromOvr(ovr, pos, rng);
	const computed = p?.skills ? compositeOvr(skills) : ovr;
	return {
		id: p?.id || `p-${Math.abs(hashString(`${pos}-${ovr}`))}`,
		first: p?.first || "Player",
		last: p?.last || "Unknown",
		pos,
		year,
		ovr: computed,
		potential: Number.isFinite(p?.potential) ? p.potential : potentialFor(computed, year, rng),
		morale: Number.isFinite(p?.morale) ? p.morale : 70,
		teamId: p?.teamId || "",
		mpg: Number.isFinite(p?.mpg) ? p.mpg : 12,
		skills,
		seasonMinutes: Number(p?.seasonMinutes) || 0,
		seasonGames: Number(p?.seasonGames) || 0,
		careerMinutes: Number(p?.careerMinutes) || 0,
		careerGames: Number(p?.careerGames) || 0,
		stats: p?.stats && Number.isFinite(p.stats.g) ? p.stats : void 0,
		career: p?.career && Number.isFinite(p.career.g) ? p.career : void 0,
		path: p?.path === "juco" ? "juco" : p?.path === "hs" ? "hs" : void 0,
		redshirt: Boolean(p?.redshirt),
		usedRedshirt: Boolean(p?.usedRedshirt),
		injury: p?.injury && Number(p.injury.weeksLeft) > 0 ? {
			part: String(p.injury.part || "ankle"),
			weeksLeft: clamp(Number(p.injury.weeksLeft), 1, 12)
		} : null,
		portalFrom: typeof p?.portalFrom === "string" ? p.portalFrom : void 0,
		portalSeason: Number.isFinite(p?.portalSeason) ? p.portalSeason : void 0,
		focus: p?.focus === "shoot" || p?.focus === "finish" || p?.focus === "defense" || p?.focus === "iq" || p?.focus === "balanced" ? p.focus : "balanced",
		growth: Array.isArray(p?.growth) ? p.growth.filter((g) => g && Number.isFinite(g.season) && Number.isFinite(g.ovr)).slice(-12) : [],
		usage: Number.isFinite(p?.usage) ? clamp(Number(p.usage), 6, 40) : clamp(Math.round((Number.isFinite(p?.mpg) ? Number(p.mpg) : 12) * 2.15), 8, 38),
		country: typeof p?.country === "string" ? p.country : void 0,
		freak: Boolean(p?.freak) || void 0,
		freakTag: typeof p?.freakTag === "string" ? p.freakTag : void 0,
		height: typeof p?.height === "string" ? p.height : void 0,
		awards: Array.isArray(p?.awards) ? p.awards.slice(-12) : void 0
	};
}
export function ensureRecruit(r, rng) {
	const pos = asPos(r?.pos);
	const ovr = clamp(Number(r?.ovr) || 70, 40, 99);
	return {
		...r,
		id: r?.id || `r-${Math.abs(hashString(`${pos}-${ovr}`))}`,
		first: r?.first || "Recruit",
		last: r?.last || "Unknown",
		pos,
		stars: clamp(Number(r?.stars) || 2, 1, 5),
		ovr,
		skills: r?.skills && Number.isFinite(r.skills.shoot) ? r.skills : skillsFromOvr(ovr, pos, rng),
		potential: Number.isFinite(r?.potential) ? r.potential : potentialFor(ovr, 1, rng),
		state: r?.state || "—",
		scouted: Boolean(r?.scouted),
		offers: Array.isArray(r?.offers) ? r.offers : [],
		visits: Array.isArray(r?.visits) ? r.visits : [],
		interest: r?.interest && typeof r.interest === "object" ? r.interest : {},
		committedTo: r?.committedTo ?? null,
		nilAsk: Number(r?.nilAsk) || 0,
		wants: r?.wants ?? {
			home: 50,
			minutes: 50,
			scheme: 50,
			academics: 50,
			nil: 50,
			style: "motion"
		},
		path: r?.path === "juco" ? "juco" : "hs",
		country: typeof r?.country === "string" ? r.country : void 0,
		freak: Boolean(r?.freak) || void 0,
		freakTag: typeof r?.freakTag === "string" ? r.freakTag : void 0,
		height: typeof r?.height === "string" ? r.height : void 0,
		flipped: Boolean(r?.flipped) || void 0,
		dropped: Boolean(r?.dropped) || void 0,
		heatWas: Number.isFinite(r?.heatWas) ? Number(r?.heatWas) : void 0
	};
}
const KIND_IN = {
	c: "conference",
	n: "noncon",
	m: "mte",
	t: "conf-tourney",
	a: "ncaa",
	i: "nit",
	w: "crown"
};
function unpackPlayer(raw) {
	if (!Array.isArray(raw) || raw.length < 19 || typeof raw[0] !== "string") return raw;
	const flags = raw.length >= 21 ? Number(raw[19]) || 0 : 0;
	const extra = flags && raw[20] && typeof raw[20] === "object" ? raw[20] : {};
	return {
		id: raw[0],
		first: raw[1],
		last: raw[2],
		pos: raw[3],
		year: raw[4],
		ovr: raw[5],
		potential: raw[6],
		morale: raw[7],
		teamId: raw[8],
		mpg: raw[9],
		seasonMinutes: raw[10],
		seasonGames: raw[11],
		careerMinutes: raw[12],
		careerGames: raw[13],
		usage: raw[14],
		skills: { shoot: raw[15], finish: raw[16], defense: raw[17], iq: raw[18] },
		redshirt: Boolean(flags & 1),
		usedRedshirt: Boolean(flags & 2),
		freak: Boolean(flags & 4) || void 0,
		...extra
	};
}
function maybePlayer(raw, rng) {
	if (Array.isArray(raw)) raw = unpackPlayer(raw);
	if (!raw || typeof raw !== "object") return null;
	const p = raw;
	if (!p.id && !p.last && !p.first) return null;
	try {
		const next = ensurePlayer(p, rng);
		if (!next.teamId) return null;
		return next;
	} catch {
		return null;
	}
}
function maybeRecruit(raw, rng) {
	if (!raw || typeof raw !== "object") return null;
	const r = raw;
	if (!r.id && !r.last) return null;
	try {
		return ensureRecruit(r, rng);
	} catch {
		return null;
	}
}

function expandSlot(raw) {
  if (Array.isArray(raw) && raw.length >= 5 && typeof raw[4] === "string" && raw[4].length === 1 && KIND_IN[raw[4]]) {
    const id = String(raw[0] ?? "");
    const homeId = String(raw[2] ?? "");
    const awayId = String(raw[3] ?? "");
    if (!id || !homeId || !awayId) return null;
    const slot = {
      id,
      week: Number(raw[1]) || 0,
      homeId,
      awayId,
      site: typeof raw[7] === "string" ? raw[7] : "home",
      kind: KIND_IN[raw[4]],
    };
    if (raw[5]) slot.resultId = String(raw[5]);
    if (raw[6]) slot.declined = true;
    return slot;
  }
  if (Array.isArray(raw) && raw.length >= 6) {
    const id = String(raw[0] ?? "");
    const homeId = String(raw[2] ?? "");
    const awayId = String(raw[3] ?? "");
    if (!id || !homeId || !awayId) return null;
    const resultId = raw[6];
    const slot = {
      id,
      week: Number(raw[1]) || 0,
      homeId,
      awayId,
      site: raw[4] || "home",
      kind: raw[5] || "noncon",
    };
    if (resultId) slot.resultId = String(resultId);
    if (raw[7]) slot.declined = true;
    return slot;
  }
  if (!raw || typeof raw !== "object") return null;
  const g = raw;
  if (!g.id || !g.homeId || !g.awayId) return null;
  return g;
}

function expandResult(raw) {
  if (Array.isArray(raw) && raw.length === 6 && typeof raw[3] === "number") {
    const homeScore = Number(raw[3]);
    const awayScore = Number(raw[4]);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
    const id = String(raw[0] ?? "");
    if (!id) return null;
    const slotId = id.startsWith("res-") ? id.slice(4) : id;
    return {
      id,
      slotId,
      homeId: String(raw[1] ?? ""),
      awayId: String(raw[2] ?? ""),
      homeScore,
      awayScore,
      week: Number(raw[5]) || 0,
    };
  }
  if (Array.isArray(raw) && raw.length >= 6) {
    const homeScore = Number(raw[4]);
    const awayScore = Number(raw[5]);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
    const id = String(raw[0] ?? "");
    if (!id) return null;
    return {
      id,
      slotId: String(raw[1] ?? id),
      homeId: String(raw[2] ?? ""),
      awayId: String(raw[3] ?? ""),
      homeScore,
      awayScore,
      week: Number(raw[6]) || 0,
    };
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (!r.id || !Number.isFinite(r.homeScore) || !Number.isFinite(r.awayScore)) return null;
  return r;
}

function capShares(players, teamId) {
	const live = players.filter((p) => p && p.teamId === teamId && !p.redshirt && !(p.injury && p.injury.weeksLeft > 0));
	const sum = live.reduce((n, p) => n + (Number(p.mpg) || 0), 0);
	if (sum <= 200 || !live.length) return players;
	const scale = 200 / sum;
	const next = new Map();
	let used = 0;
	for (const p of live) {
		const mpg = Math.max(0, Math.floor((Number(p.mpg) || 0) * scale));
		next.set(p.id, mpg);
		used += mpg;
	}
	let extra = 200 - used;
	for (const p of live.slice().sort((a, b) => (b.mpg || 0) - (a.mpg || 0))) {
		if (extra <= 0) break;
		next.set(p.id, (next.get(p.id) || 0) + 1);
		extra--;
	}
	return players.map((p) => next.has(p.id) ? { ...p, mpg: next.get(p.id) } : p);
}
export function hydrateState(state): GameState {
	if (!state || typeof state !== "object") throw new Error("Empty save.");
	mountCustomList(Array.isArray(state.customSchools) ? state.customSchools : []);
	const seed = Number.isFinite(state.seed) ? state.seed : 1;
	const rng = mulberry32(seed ^ 1307);
	const rawTeams = state.teams && typeof state.teams === "object" ? state.teams : {};
	let playerTeamId = typeof state.playerTeamId === "string" ? state.playerTeamId : "";
	if (!playerTeamId || !rawTeams[playerTeamId] && !TEAM_BY_ID[playerTeamId]) playerTeamId = Object.keys(rawTeams)[0] || TEAMS[0].id;
	const teams = {};
	for (const [id, t] of Object.entries(rawTeams)) {
		if (!id) continue;
		teams[id] = fillTeam(id, t);
	}
	if (!teams[playerTeamId]) teams[playerTeamId] = fillTeam(playerTeamId, void 0);
	for (const id of Object.keys(teams)) {
		const seed = TEAM_BY_ID[id];
		if (seed && isPhantomTest(seed) && id !== playerTeamId) delete teams[id];
	}
	for (const row of listCustomSchools()) {
		if (!row?.id || isPhantomTest(row) || teams[row.id]) continue;
		teams[row.id] = fillTeam(row.id, { conference: row.conference, prestige: row.prestige });
	}
	let players = (Array.isArray(state.players) ? state.players : []).map((p) => maybePlayer(p, rng)).filter((p) => Boolean(p));
	players = players.filter((p) => p.teamId === playerTeamId || teams[p.teamId]);
	if ((state.phase || "preseason") === "preseason" && !(Array.isArray(state.results) && state.results.length)) {
		players = capShares(players, playerTeamId);
	}
	const identity = {
		first: state.identity?.first?.trim() || "Coach",
		last: state.identity?.last?.trim() || "Stone",
		age: clamp(Number(state.identity?.age) || 38, 28, 82),
		almaMaterId: state.identity?.almaMaterId && TEAM_BY_ID[state.identity.almaMaterId] ? state.identity.almaMaterId : null
	};
	return refreshVoice(repairStoredMonsters(tickPodcasts(ensureProgram({
		...state,
		version: Number(state.version) || 0,
		seed,
		season: Number(state.season) || 2026,
		week: Number.isFinite(state.week) ? state.week : 0,
		phase: state.phase || "preseason",
		playerTeamId,
		identity,
		players,
		recruits: (Array.isArray(state.recruits) ? state.recruits : []).map((r) => maybeRecruit(r, rng)).filter((r) => Boolean(r)),
		schedule: (Array.isArray(state.schedule) ? state.schedule : []).map((g) => expandSlot(g)).filter((g) => g && (g.resultId || (teams[g.homeId] && teams[g.awayId]))),
		customSchools: (Array.isArray(state.customSchools) ? state.customSchools : []).filter((t) => t && !isPhantomTest(t) && (t.id === playerTeamId || teams[t.id])),
		mail: Array.isArray(state.mail) ? state.mail.filter((m) => m && m.id) : [],
		coachSkills: state.coachSkills ?? { ...DEFAULT_COACH },
		skillPoints: Number(state.skillPoints) || 0,
		offseasonReport: state.offseasonReport ?? null,
		liveGame: state.liveGame ?? null,
		lastPresserWeek: state.lastPresserWeek ?? -9,
		recentQuestionIds: Array.isArray(state.recentQuestionIds) ? state.recentQuestionIds : [],
		history: {
			...emptyHistory(),
			...state.history,
			log: Array.isArray(state.history?.log) ? state.history.log : []
		},
		selection: state.selection ?? null,
		cpuRecruit: state.version >= 14 ? Boolean(state.cpuRecruit) : false,
		namePack: state.namePack ?? null,
		recruitingHours: Number.isFinite(state.recruitingHours) ? state.recruitingHours : 10,
		eraDecade: state.eraDecade ?? null,
		nilCap: Number.isFinite(state.nilCap) ? state.nilCap : eraHasNil(state.eraDecade) ? 100 : 0,
		contract: state.contract ?? makeContract(playerTeamId, Number(state.season) || 2026, 1),
		contractReview: state.contractReview ?? null,
		compliance: state.compliance ?? emptyCompliance(),
		sheet: state.sheet ?? emptySheet(),
		draft: state.draft ?? null,
		portal: ensurePortal(state.portal, Number(state.season) || 2026, state.eraDecade ?? null),
		camp: state.camp ?? null,
		promises: Array.isArray(state.promises) ? state.promises : [],
		pendingStory: state.pendingStory ?? null,
		awards: Array.isArray(state.awards) ? state.awards : [],
		reportCard: state.reportCard ?? null,
		expectations: state.expectations ?? null,
		gamePlan: state.gamePlan ?? null,
		talksThisWeek: Number(state.talksThisWeek) || 0,
		settings: state.settings ?? defaultSettings(state.eraDecade ?? null),
		donors: Array.isArray(state.donors) ? state.donors : [],
		nilAsks: Array.isArray(state.nilAsks) ? state.nilAsks : [],
		potw: Array.isArray(state.potw) ? state.potw : [],
		proHistory: Array.isArray(state.proHistory) ? state.proHistory : [],
		flash: state.flash ?? null,
		gotdId: state.gotdId ?? null,
		retired: Boolean(state.retired),
		watch: Array.isArray(state.watch) && state.watch.length ? state.watch : preseasonWatch(state),
		pipelineBook: state.pipelineBook && typeof state.pipelineBook === "object"
			? { states: state.pipelineBook.states ?? {}, ties: state.pipelineBook.ties ?? {} }
			: { states: {}, ties: {} },
		news: hydrateNews(Array.isArray(state.news) ? state.news : []),
		podcasts: hydratePodcasts(state.podcasts),
		staff: state.staff ?? null,
		facilities: state.facilities ?? null,
		practice: state.practice ?? "scrimmage",
		scouted: state.scouted ?? null,
		events: Array.isArray(state.events) ? state.events : [],
		depth: state.depth ?? { starters: {}, captainId: null },
		fatigue: state.fatigue && typeof state.fatigue === "object" ? state.fatigue : {},
		coachMoves: Array.isArray(state.coachMoves) ? state.coachMoves : [],
		carousel: state.carousel ?? null,
		snake: state.snake ?? null,
		results: (Array.isArray(state.results) ? state.results : []).map((r) => expandResult(r)).filter((r) => r).map((r) => {
      const yours = r.homeId === playerTeamId || r.awayId === playerTeamId;
      if (!yours) return r;
      return fillResultBox(r, mulberry32(seed ^ hashString(r.id) ^ 2817));
    }),
		teams,
		donorMood: Number.isFinite(state.donorMood) ? state.donorMood : 58,
		adHeat: Number.isFinite(state.adHeat) ? state.adHeat : 55,
		fanMood: Number.isFinite(state.fanMood) ? state.fanMood : 60,
		scholarships: Number.isFinite(state.scholarships) ? state.scholarships : 13,
		pendingPresser: state.pendingPresser ?? null
	}))));
}

function refreshVoice(state) {
	const canned = (a) => /smells like last year|has the keys|like each other|make an open shot|gets the first look|after a week of practice/.test(`${a?.dek ?? ""} ${(a?.grafs ?? []).join(" ")}`);
	let news = state.news ?? [];
	if (news.some(canned)) {
		const fresh = campCopy(state);
		news = news.map((a) => (canned(a) ? { ...fresh, id: a.id } : a));
	}
	let expectations = state.expectations;
	if (expectations?.note && /gravy/.test(expectations.note)) {
		expectations = { ...expectations, note: expectations.note.replace("A bid would be gravy and everybody knows it.", "An NCAA bid would be a bonus.") };
	}
	let mail = state.mail ?? [];
	if (mail.some((m) => /love it back|papers write it|doorway in April/.test(m.body ?? ""))) {
		const fresh = openingLetter(state);
		mail = mail.map((m) => (/love it back|papers write it|doorway in April/.test(m.body ?? "") ? { ...m, subject: fresh.subject, body: fresh.body } : m));
	}
	if (news === state.news && expectations === state.expectations && mail === (state.mail ?? [])) return state;
	return { ...state, news, expectations, mail };
}
function fillResultBox(r, rng) {
	if (r.homeBox && r.awayBox && r.minutes) return r;
	const boxes = estimateGameBoxes(r.homeScore, r.awayScore, rng);
	return {
		...r,
		minutes: r.minutes ?? boxes.minutes,
		homeBox: r.homeBox ?? boxes.home,
		awayBox: r.awayBox ?? boxes.away
	};
}
function bumpSkill(s, key, n, cap) {
	return {
		...s,
		[key]: clamp(s[key] + n, 40, cap)
	};
}
export function inSeasonGrowth(state, teamId, rng) {
	const dev = state.coachSkills?.development ?? 46;
	const lead = state.coachSkills?.leadership ?? 50;
	return state.players.map((raw) => {
		if (raw.teamId !== teamId) return raw;
		let p = ensurePlayer(raw, rng);
		const floor = 22 + Math.round(lead * .08);
		p = {
			...p,
			morale: clamp(p.morale, floor, 99)
		};
		if (p.ovr >= p.potential) return p;
		if (p.redshirt || p.injury && p.injury.weeksLeft > 0) return p;
		if (p.seasonGames < 1 || p.seasonGames % 5 !== 0) return p;
		if (p.mpg < 10) return p;
		const plan = state.practice ?? "scrimmage";
		const yearBump = p.year <= 1 ? -0.04 : p.year >= 4 ? 0.05 : p.year === 3 ? 0.02 : 0;
		const chance = .18 + p.mpg / 90 + (dev - 46) / 220 + (p.morale - 60) / 400 + (p.skills.iq - 55) / 800 + ((state.facilities?.practice ?? 1) - 1) * .04 + (plan === "hard" ? .05 : plan === "rest" ? -.06 : plan === "film" ? .02 : 0) + yearBump;
		if (rng() > chance) return p;
		let key = focusSkill(p, p.focus);
		if (plan === "film" && (p.focus === "balanced" || !p.focus)) key = "iq";
		if (plan === "hard" && (p.focus === "balanced" || !p.focus)) key = "finish";
		const skills = bumpSkill(p.skills, key, 1, Math.max(p.potential, 99));
		const nextOvr = compositeOvr(skills);
		const label = key === "shoot" ? "midrange" : key === "finish" ? "finishing" : key === "defense" ? "defense" : "IQ";
		const from = plan === "film" ? "film" : plan === "hard" ? "hard practice" : plan === "rest" ? "a light week" : "skill work";
		return {
			...p,
			skills,
			ovr: nextOvr,
			potential: Math.max(p.potential, nextOvr),
			growth: [...(p.growth ?? []), { season: state.season, ovr: nextOvr, focus: p.focus ?? "balanced", jump: 1, note: `+1 ${label} from ${from}` }].slice(-8)
		};
	});
}
function recruitToPlayer(r, teamId, mpg, rng, i) {
	const school = 68 + ((TEAM_BY_ID[teamId]?.prestige ?? 60) - 50) * .32;
	const cap = r.path === "juco" ? 90 : 88;
	const ovr = clamp(Math.round(r.ovr * .64 + school * .36), 54, cap);
	return {
		...makePlayer({
			id: `${teamId}-in-${r.id}-${i}`,
			first: r.first,
			last: r.last,
			pos: r.pos,
			year: r.path === "juco" ? 3 : 1,
			teamId,
			ovr,
			potential: Math.max(ovr, Math.min(r.potential, r.path === "juco" ? 91 : 90)),
			mpg,
			rng
		}),
		path: r.path === "juco" ? "juco" : "hs",
		country: r.country,
		freak: r.freak,
		freakTag: r.freakTag,
		height: r.height
	};
}
function walkOn(teamId, prestige, i, rng, used, season) {
	const pos = [
		"PG",
		"SG",
		"SF",
		"PF",
		"C"
	][i % 5];
	const ovr = clamp(Math.round(prestige * .4 + 36 + gaussian(rng) * 3 - i), 52, 78);
	const name = randomPersonName(rng, used);
	return makePlayer({
		id: `${teamId}-wo-${season}-${i}-${Math.floor(rng() * 1e6)}`,
		first: name.first,
		last: name.last,
		pos,
		year: 1,
		teamId,
		ovr,
		mpg: 6,
		rng
	});
}
function resolveCommits(state, rng) {
	const you = state.playerTeamId;
	let recruits = state.recruits.map((r) => {
		if (r.committedTo) return r;
		const heat = recruitInterest(r, you);
		if (r.offers.includes(you) && heat >= 48 && rng() < .55 + heat / 280) return {
			...r,
			committedTo: you
		};
		if (r.stars >= 4 && rng() < .62) {
			const powers = TEAMS.filter((t) => t.prestige >= 76 && t.id !== you);
			const w = powers.map((t) => Math.max(1, (t.prestige - 70) * (r.stars === 5 ? 2 : 1)));
			let roll = rng() * w.reduce((n, x) => n + x, 0);
			let power = powers[0].id;
			for (let i = 0; i < powers.length; i++) {
				roll -= w[i];
				if (roll <= 0) {
					power = powers[i].id;
					break;
				}
			}
			return {
				...r,
				committedTo: power
			};
		}
		if (rng() < .35) {
			const school = pick(rng, TEAMS.map((t) => t.id));
			return {
				...r,
				committedTo: school
			};
		}
		return r;
	});
	const returning = state.players.filter((p) => p.teamId === you && (p.year < 4 || p.redshirt)).length;
	const signed = recruits.filter((r) => r.committedTo === you).length;
	const portalIn = portalOf(state).transfers.filter((t) => t.committedTo === you).length;
	let need = Math.max(0, 13 - returning - signed - portalIn);
	if (need > 0) {
		const pool = recruits.filter((r) => !r.committedTo && r.offers.includes(you)).sort((a, b) => recruitInterest(b, you) - recruitInterest(a, you) || b.ovr - a.ovr);
		const take = new Set(pool.slice(0, need).map((r) => r.id));
		if (take.size) recruits = recruits.map((r) => take.has(r.id) ? {
			...r,
			committedTo: you
		} : r);
	}
	return recruits;
}
export function marchRunOf(state, id) {
	const sel = state.selection;
	if (sel?.champ === id) return "title";
	const ncaa = (sel?.ncaa ?? []).some((b) => b.teamId === id);
	const playIn = Boolean(sel?.ncaa?.find((b) => b.teamId === id)?.playIn);
	let wins = 0;
	for (const g of state.schedule) {
		if (g.kind !== "ncaa" || !g.resultId) continue;
		if (g.homeId !== id && g.awayId !== id) continue;
		const r = state.results.find((x) => x.id === g.resultId);
		if (!r) continue;
		if (g.homeId === id ? r.homeScore > r.awayScore : r.awayScore > r.homeScore) wins++;
	}
	if (ncaa) {
		const adj = playIn ? wins - 1 : wins;
		if (adj >= 4) return "f4";
		if (adj >= 3) return "e8";
		if (adj >= 2) return "s16";
		return "bid";
	}
	if ((sel?.nit ?? []).includes(id)) return "nit";
	if ((sel?.crown ?? []).includes(id)) return "crown";
}
export function closeSeason(state) {
	const hist = {
		...emptyHistory(),
		...state.history,
		log: [...state.history?.log ?? []]
	};
	const idx = hist.log.findIndex((l) => l.season === state.season);
	const already = idx >= 0 ? hist.log[idx] : null;
	if (already?.counted) return {
		...state,
		history: hist
	};
	const you = state.teams[state.playerTeamId];
	const sel = state.selection;
	const confTitle = sel?.confTourney === you.id || sel?.autos?.[you.conference] === you.id;
	const ncaaBid = Boolean(sel?.ncaa?.some((b) => b.teamId === you.id));
	const title = sel?.champ === you.id;
	const run = marchRunOf(state, you.id);
	const row = {
		...(already ?? {}),
		season: state.season,
		teamId: you.id,
		wins: you.wins,
		losses: you.losses,
		confW: you.confW,
		confL: you.confL,
		coachName: you.coachName,
		confTitle,
		ncaaBid,
		title,
		run,
		counted: true
	};
	const log = hist.log.slice();
	if (idx >= 0) log[idx] = row;
	else log.push(row);
	const teams = Object.fromEntries(Object.values(state.teams).map((t) => [t.id, {
		...t,
		allWins: (t.allWins ?? 0) + t.wins,
		allLosses: (t.allLosses ?? 0) + t.losses
	}]));
	const players = state.players.map((p) => ({
		...p,
		careerGames: (p.careerGames ?? 0) + (p.seasonGames ?? 0),
		careerMinutes: (p.careerMinutes ?? 0) + (p.seasonMinutes ?? 0)
	}));
	const next = {
		...state,
		teams,
		players,
		history: {
			...hist,
			wins: hist.wins + you.wins,
			losses: hist.losses + you.losses,
			ncaaBids: hist.ncaaBids + (ncaaBid ? 1 : 0),
			confTitles: hist.confTitles + (confTitle ? 1 : 0),
			titles: hist.titles + (title ? 1 : 0),
			sweet16: (hist.sweet16 ?? 0) + (run === "s16" || run === "e8" || run === "f4" || run === "title" ? 1 : 0),
			elite8: (hist.elite8 ?? 0) + (run === "e8" || run === "f4" || run === "title" ? 1 : 0),
			finalFour: (hist.finalFour ?? 0) + (run === "f4" || run === "title" ? 1 : 0),
			nitBids: (hist.nitBids ?? 0) + (run === "nit" ? 1 : 0),
			log
		}
	};
	recordHof(next);
	return next;
}
export function enterOffseason(state) {
	if (state.phase === "offseason" && state.offseasonReport) return state;
	const closed = closeSeason(state);
	const graded = gradePromises(closed);
	const awards = rollAwards(graded);
	const prior = (graded.awards ?? []).filter((a) => a.season !== graded.season);
	const yoursPoy = awards.find((a) => a.kind === "poy" && a.yours);
	const hist = graded.history;
	const log = hist.log.map((row, i) => i === hist.log.length - 1 && yoursPoy ? {
		...row,
		poy: yoursPoy.name
	} : row);
	const withDraft = openDraft({
		...graded,
		awards: [...prior, ...awards].slice(-480),
		history: {
			...hist,
			log
		}
	});
	const you = withDraft.teams[withDraft.playerTeamId];
	const pointsEarned = 1 + (you.wins > you.losses ? 1 : 0) + (you.confW >= 10 ? 1 : 0);
	const report = {
		grew: [],
		graduated: withDraft.players.filter((p) => p.teamId === withDraft.playerTeamId && p.year >= 4 && !p.redshirt).map((p) => ({
			name: `${p.first} ${p.last}`,
			ovr: p.ovr
		})),
		incoming: [],
		walkons: [],
		pointsEarned
	};
	const school = TEAM_BY_ID[withDraft.playerTeamId];
	const year = withDraft.history.log[withDraft.history.log.length - 1];
	const extra = year ? `${year.wins}-${year.losses}${year.confTitle ? ", conference title" : ""}${year.run === "title" ? ", national title" : year.run === "f4" ? ", Final Four" : year.run === "e8" ? ", Elite Eight" : year.run === "s16" ? ", Sweet 16" : year.ncaaBid ? ", NCAA bid" : year.run === "nit" ? ", NIT" : year.run === "crown" ? ", CBI" : ""}.` : "";
	const honor = yoursPoy ? ` ${yoursPoy.name} is national player of the year.` : awards.some((a) => a.yours && a.kind === "all-american") ? " An All-American on the roster." : "";
	const opened = openCamp({
		...withDraft,
		phase: "offseason",
		liveGame: null,
		pendingPresser: null,
		pendingStory: null,
		skillPoints: (closed.skillPoints ?? 0) + pointsEarned,
		offseasonReport: report,
		news: [brief(closed.week, `Offseason opens in ${school.name}`, [`${school.name} closed the year ${extra.trim() || "without a banner"}.${honor} You earned ${pointsEarned} coaching point${pointsEarned === 1 ? "" : "s"} for the summer.`, "Film first. Then stay-or-go. Then camp. Then the portal, if it's that kind of year. Then whoever is still in the gym."], year?.title || year?.confTitle ? "good" : "even", "Notebook"), ...withDraft.news].slice(0, 60)
	});
	const carded = {
		...opened,
		reportCard: makeReportCard(opened)
	};
	const rng = mulberry32(closed.seed ^ closed.season * 104729);
	return stampSeasonArchive(tickPodcasts(tickPortal(applyReview(carded), rng), rng));
}
export function spendCoachPoint(state, axis) {
	if ((state.skillPoints ?? 0) < 1) return {
		state,
		ok: false
	};
	const cur = state.coachSkills ?? { ...DEFAULT_COACH };
	if (cur[axis] >= 99) return {
		state,
		ok: false
	};
	bustChemCache();
	return {
		ok: true,
		state: {
			...state,
			skillPoints: state.skillPoints - 1,
			coachSkills: {
				...cur,
				[axis]: clamp(cur[axis] + 4, 20, 99)
			}
		}
	};
}
export function setPlayerMpg(state, id, mpg) {
	bustChemCache();
	return {
		...state,
		players: state.players.map((p) => p.id === id ? { ...p, mpg: clamp(mpg, 0, 38) } : p)
	};
}
export function setPlayerUsage(state, id, usage) {
	return {
		...state,
		players: state.players.map((p) => p.id === id ? {
			...p,
			usage: clamp(usage, 6, 40)
		} : p)
	};
}
export function nextSeason(state) {
	const rng = mulberry32(state.seed ^ (state.season + 1) * 224737);
	if (state.camp && !state.camp.locked) state = lockCamp(state, rng);
	if (state.camp?.locked) state = {
		...state,
		reportCard: makeReportCard(state)
	};
	const commits = resolveCommits(state, rng);
	let players = state.players.filter((p) => p.redshirt || p.year < 4);
	players = players.map((p) => {
		if (p.redshirt) return {
			...p,
			redshirt: false,
			usedRedshirt: true,
			injury: null,
			seasonMinutes: 0,
			seasonGames: 0,
			stats: void 0,
			career: p.career,
			morale: clamp(p.morale + 2, 40, 88)
		};
		return {
			...p,
			year: p.year + 1,
			seasonMinutes: 0,
			seasonGames: 0,
			careerMinutes: p.careerMinutes ?? 0,
			careerGames: p.careerGames ?? 0,
			career: rollCareerSafe(p.stats, p.career),
			stats: void 0,
			morale: clamp(p.morale + 4, 40, 88),
			injury: null,
			redshirt: false
		};
	});
	const incoming = [];
	const byTeam = {};
	for (const r of commits) {
		if (!r.committedTo) continue;
		(byTeam[r.committedTo] ??= []).push(r);
	}
	const ported = enrollPortal({
		...state,
		players,
		recruits: commits
	}, rng);
	players = ported.players;
	for (const p of players) {
		if (p.teamId !== state.playerTeamId || p.portalSeason !== state.season + 1) continue;
		const name = `${p.first} ${p.last}`;
		if (!incoming.some((row) => row.name === name)) incoming.push({
			name,
			ovr: p.ovr
		});
	}
	const rosterOf = new Map();
	for (const p of players) {
		const list = rosterOf.get(p.teamId);
		if (list) list.push(p);
		else rosterOf.set(p.teamId, [p]);
	}
	for (const team of TEAMS) {
		const roster = rosterOf.get(team.id) ?? [];
		const spots = Math.max(0, 13 - roster.length);
		(byTeam[team.id] ?? []).sort((a, b) => b.ovr - a.ovr).slice(0, spots).forEach((r, i) => {
			const p = recruitToPlayer(r, team.id, i < 2 ? 16 : 10, rng, i);
			players.push(p);
			roster.push(p);
			if (team.id === state.playerTeamId) incoming.push({
				name: `${p.first} ${p.last}`,
				ovr: p.ovr
			});
		});
		rosterOf.set(team.id, roster);
	}
	const walkons = [];
	const nextYear = state.season + 1;
	for (const team of TEAMS) {
		let roster = rosterOf.get(team.id) ?? [];
		let i = 0;
		const used = new Set(roster.map((p) => `${p.first} ${p.last}`.toLowerCase()));
		while (roster.length < 13) {
			const p = walkOn(team.id, team.prestige, i++, rng, used, state.season);
			players.push(p);
			roster.push(p);
			used.add(`${p.first} ${p.last}`.toLowerCase());
			if (team.id === state.playerTeamId) walkons.push({
				name: `${p.first} ${p.last}`,
				ovr: p.ovr
			});
		}
		if (roster.length > 13) {
			roster.sort((a, b) => {
				const aKeep = a.portalSeason === nextYear ? 1 : 0;
				const bKeep = b.portalSeason === nextYear ? 1 : 0;
				if (aKeep !== bKeep) return aKeep - bKeep;
				return a.ovr - b.ovr || a.mpg - b.mpg;
			});
			const cut = new Set(roster.slice(0, roster.length - 13).map((p) => p.id));
			players = players.filter((p) => p.teamId !== team.id || !cut.has(p.id));
			roster = roster.filter((p) => !cut.has(p.id));
		}
		roster.sort((a, b) => b.ovr - a.ovr || b.mpg - a.mpg);
		for (let idx = 0; idx < roster.length; idx++) {
			roster[idx].mpg = idx < 5 ? 28 : idx < 8 ? 18 : 8;
		}
		rosterOf.set(team.id, roster);
	}
	bustChemCache();
	const teams = Object.fromEntries(Object.values(state.teams).map((t) => [t.id, {
		...t,
		wins: 0,
		losses: 0,
		confW: 0,
		confL: 0,
		homeW: 0,
		homeL: 0,
		homeStreak: t.homeStreak ?? 0,
		gymW: t.gymW ?? 0,
		gymL: t.gymL ?? 0,
		gymPf: t.gymPf ?? 0,
		gymPa: t.gymPa ?? 0,
		allWins: t.allWins ?? 0,
		allLosses: t.allLosses ?? 0
	}]));
	const season = state.season + 1;
	const report = {
		...state.offseasonReport ?? {
			grew: [],
			graduated: [],
			incoming: [],
			walkons: [],
			pointsEarned: 0
		},
		incoming,
		walkons
	};
	return {
		...state,
		season,
		week: 0,
		phase: "preseason",
		players,
		recruits: recruitsFor(state.seed, season),
		schedule: [],
		results: [],
		liveGame: null,
		pendingPresser: null,
		recruitingHours: 10,
		offseasonReport: report,
		teams,
		draft: null,
		portal: ported.portal,
		camp: null,
		pendingStory: null,
		selection: null,
		gotdId: null,
		promises: (state.promises ?? []).filter((p) => p.kept != null).slice(-24),
		expectations: null,
		talksThisWeek: 0,
		identity: {
			...state.identity,
			age: Math.min(82, state.identity.age + 1)
		},
		history: {
			...emptyHistory(),
			...state.history,
			seasons: (state.history?.seasons ?? 0) + 1,
			log: state.history?.log ?? []
		},
		news: [brief(0, `${season} is here`, [`${incoming.length} newcomer${incoming.length === 1 ? "" : "s"} on campus. ${report.graduated.length} gone. The gym doesn't care who left.`, incoming.length ? `The new names will have to earn minutes. Nobody is handing them out in October.` : `The returning group gets the gym to itself for a week. Then the league starts asking again.`], "good", "Camp"), ...state.news].slice(0, 60),
		watch: preseasonWatch({ players, playerTeamId: state.playerTeamId }),
	};
}
function makeJuco(season, n, stars, rng, _used, name) {
	const pos = ["PG", "SG", "SF", "PF", "C"][n % 5];
	const ovr = clamp(Math.round((stars === 4 ? 80 : stars === 3 ? 74 : 68) + (rng() - .5) * 5), 60, 86);
	const roll = (b) => clamp(Math.round(22 + rng() * 48 + b), 10, 96);
	return {
		id: `r-${season}-j-${n}`,
		first: name.first,
		last: name.last,
		pos,
		stars,
		ovr,
		potential: clamp(ovr + Math.floor(rng() * 5), ovr, 90),
		state: pick(rng, ["TX", "CA", "FL", "KS", "OK", "MO", "IA", "IL", "MS", "AL", "GA", "NC", "AZ", "WA", "OR"]),
		scouted: false,
		offers: [],
		visits: [],
		interest: {},
		committedTo: null,
		nilAsk: Math.round(stars * 16 + rng() * 18),
		wants: {
			home: roll(-6),
			minutes: roll(22),
			scheme: roll(4),
			academics: roll(-4),
			nil: roll(stars >= 3 ? 10 : -6),
			style: pick(rng, ["motion", "spread", "post", "transition", "iso"]),
		},
		skills: {
			shoot: clamp(ovr + Math.round((rng() - .5) * 8), 48, 92),
			finish: clamp(ovr + Math.round((rng() - .5) * 8) + 3, 48, 92),
			defense: clamp(ovr + Math.round((rng() - .5) * 8), 48, 92),
			iq: clamp(ovr + Math.round((rng() - .5) * 6) + 2, 48, 92),
		},
		path: "juco",
	};
}

export function recruitsFor(seed, season): Recruit[] {
	const rng = mulberry32(seed ^ season * 7919);
	const out = [];
	const used = /* @__PURE__ */ new Set();
	const counts = {
		5: 8,
		4: 36,
		3: 90,
		2: 70,
		1: 24
	};
	let n = 0;
	const STATES = [
		"CA",
		"TX",
		"NY",
		"FL",
		"IL",
		"OH",
		"PA",
		"GA",
		"NC",
		"VA",
		"IN",
		"KY",
		"KS",
		"AZ",
		"WA",
		"OR",
		"CO",
		"TN",
		"AL",
		"SC",
		"NJ",
		"MA",
		"CT",
		"MD",
		"MO",
		"WI",
		"MI",
		"MN",
		"UT",
		"NV"
	];
	const styles = [
		"motion",
		"spread",
		"post",
		"transition",
		"iso"
	];
	for (const stars of [
		5,
		4,
		3,
		2,
		1
	]) for (let i = 0; i < counts[stars]; i++) {
		n++;
		const pos0 = [
			"PG",
			"SG",
			"SF",
			"PF",
			"C"
		][n % 5];
		const intl = rng() < .09 ? pick(rng, INTL) : null;
		const freak = rng() < (stars >= 5 ? .14 : stars >= 4 ? .08 : .02) ? pick(rng, FreakKinds) : null;
		const pos = freak?.pos ?? pos0;
		const ovr = clamp(Math.round((stars === 5 ? 84 : stars === 4 ? 78 : stars === 3 ? 71 : stars === 2 ? 64 : 58) + gaussian(rng) * 2), 52, 90);
		const skills0 = skillsFromOvr(ovr, pos, rng);
		const skills = freak ? {
			shoot: clamp(skills0.shoot + freak.bump.shoot, 40, 99),
			finish: clamp(skills0.finish + freak.bump.finish, 40, 99),
			defense: clamp(skills0.defense + freak.bump.defense, 40, 99),
			iq: clamp(skills0.iq + freak.bump.iq, 40, 99)
		} : skills0;
		const roll = (b) => clamp(Math.round(18 + rng() * 50 + b), 8, 96);
		const name = intl ? randomIntlName(rng, used, intl.country) : randomPersonName(rng, used);
		out.push({
			id: `r-${season}-${n}`,
			first: name.first,
			last: name.last,
			pos,
			stars,
			ovr: compositeOvr(skills),
			potential: potentialFor(ovr, 1, rng) + (freak ? 2 : 0),
			state: intl ? intl.country : pick(rng, STATES),
			scouted: false,
			offers: [],
			visits: [],
			interest: {},
			committedTo: null,
			nilAsk: Math.round(stars * 18 + rng() * 20),
			wants: {
				home: roll(stars <= 3 ? 14 : -8),
				minutes: roll(stars <= 3 ? 16 : 2),
				scheme: roll(8),
				academics: roll(rng() < .18 ? 28 : -10),
				nil: roll(stars >= 4 ? 22 : -8),
				style: pick(rng, styles)
			},
			skills,
			path: "hs",
			country: intl ? intl.country : "US",
			freak: Boolean(freak) || void 0,
			freakTag: freak?.tag,
			height: heightFor(pos, rng, Boolean(freak))
		});
	}
	[
		4,
		4,
		4,
		4,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		3,
		2,
		2,
		2,
		2,
		2,
		2,
		2,
		2
	].forEach((stars, i) => {
		n++;
		const name = randomPersonName(rng, used);
		out.push(makeJuco(season, n, stars, rng, used, name));
	});
	return out;
}