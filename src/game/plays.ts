// @ts-nocheck
import type { DefPlay, GameState, LiveEvent, LiveGame, OffPlay, Player } from "./types";
import { TEAM_BY_ID, teamOf } from "./teams";
import { clamp, gaussian, hashString, mulberry32, pick, randInt, type Rng } from "./rng";
import { teamChemistry } from "./chemistry";
import { availableRoster } from "./college";
import { blankLine, credit, finishRealism, onCourtFive } from "./sim";
import { eraHasShotClock, eraHasThree, eraThreeScale } from "./era";
import { clampPlayerFta, ftaCap, teamFtaCap, liveMinutes } from "./engine-util";
import { reconcileFinal, logBoxFaults } from "./scoreFloor";
import { gymLiveEdge, gymCrowd } from "./gym";
import { rivalryEdge } from "./rivalry";
import { fatigueOf } from "./program";
import { FOUL_CLOCK, TWO_FOR_HI, TWO_FOR_LO, endgameMenu } from "./liveControls";

export interface CallOption {
  id: OffPlay | DefPlay;
  side: "off" | "def";
  label: string;
}

export function clockLabel(half, clock) {
	const total = Math.max(0, Math.floor(Number.isFinite(clock) ? clock : 0));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${half >= 3 ? `OT${half - 2}` : `H${half}`} ${m}:${s.toString().padStart(2, "0")}`;
}
function roster(state, teamId) {
	return availableRoster(state, teamId);
}
function pickPlayer(rng, r, prefer) {
	const pool = prefer ? r.filter((p) => prefer.includes(p.pos)) : r;
	const use = pool.length ? pool : r;
	if (!use.length) return {
		id: "walk",
		first: "Walk",
		last: "On",
		pos: "SG",
		year: 1,
		ovr: 60,
		potential: 60,
		morale: 50,
		teamId: "",
		mpg: 10,
		skills: {
			shoot: 60,
			finish: 60,
			defense: 60,
			iq: 60
		},
		seasonMinutes: 0,
		seasonGames: 0,
		careerMinutes: 0,
		careerGames: 0
	};
	const w = use.map((p) => {
		const usg = p.usage ?? p.mpg * 2.15;
		const skill = prefer?.includes("C") || prefer?.includes("PF") ? p.skills?.finish ?? p.ovr : prefer?.includes("SG") || prefer?.includes("SF") ? p.skills?.shoot ?? p.ovr : ((p.skills?.shoot ?? p.ovr) + (p.skills?.finish ?? p.ovr) + (p.skills?.iq ?? p.ovr)) / 3;
		return Math.max(1, p.mpg * 1.2 + usg * .85 + skill * .55);
	});
	let t = rng() * w.reduce((s, n) => s + n, 0);
	for (let i = 0; i < use.length; i++) {
		t -= w[i];
		if (t <= 0) return use[i];
	}
	return use[0];
}
function pickFoulTarget(rng, r) {
	const use = r.filter((p) => p && p.id !== "walk");
	const pool = use.length ? use : r;
	if (!pool.length) return pickPlayer(rng, r, null);
	const ranked = [...pool].sort((a, b) => (a.skills?.shoot ?? a.ovr ?? 70) - (b.skills?.shoot ?? b.ovr ?? 70));
	return ranked[rng() < 0.8 ? 0 : Math.min(1, ranked.length - 1)];
}
function foulIsLegal(live, youScore, themScore) {
	if (live.half < 2) return false;
	const trail = themScore - youScore;
	if (live.clock <= 60 && trail >= 1 && trail <= 8) return true;
	if (live.clock <= 12 && trail === -3) return true;
	return false;
}
function teamOvr(state, teamId) {
	const r = roster(state, teamId).slice(0, 8);
	if (!r.length) return 70;
	return r.reduce((s, p) => s + p.ovr, 0) / r.length;
}
function nm(p) {
	return `${p.first} ${p.last}`;
}
var OFF_META = {
	motion: {
		label: "Motion",
		prefer: null
	},
	pnr: {
		label: "Pick & roll",
		prefer: ["PG", "SG"]
	},
	post: {
		label: "Post up",
		prefer: ["PF", "C"]
	},
	iso: {
		label: "Clear-out",
		prefer: [
			"PG",
			"SG",
			"SF"
		]
	},
	spread: {
		label: "Hunt a three",
		prefer: ["SG", "SF"]
	},
	push: {
		label: "Push tempo",
		prefer: ["PG", "SG"]
	},
	horns: {
		label: "Horns",
		prefer: ["PG", "PF"]
	},
	floppy: {
		label: "Floppy",
		prefer: ["SG", "SF"]
	},
	delay: {
		label: "Hold for last",
		prefer: ["PG", "SG"]
	},
	hammer: {
		label: "Hammer",
		prefer: ["SF", "SG"]
	}
};
var DEF_META = {
	man: { label: "Man" },
	zone: { label: "2-3 zone" },
	press: { label: "Full-court press" },
	pack: { label: "Pack-line" },
	trap: { label: "Sideline trap" },
	switch: { label: "Switch all" },
	foul: { label: "Foul him" },
	sag: { label: "Sag the paint" }
};
export const OFF_OPTS: { id: OffPlay; label: string }[] = Object.keys(OFF_META).map((id) => ({
	id: id as OffPlay,
	label: OFF_META[id].label
}));
export const DEF_OPTS: { id: DefPlay; label: string }[] = Object.keys(DEF_META).map((id) => ({
	id: id as DefPlay,
	label: DEF_META[id].label
}));
export function crowdFill(state, live) {
	const hp = state.teams[live.homeId]?.prestige ?? TEAM_BY_ID[live.homeId]?.prestige ?? 60;
	const ap = state.teams[live.awayId]?.prestige ?? TEAM_BY_ID[live.awayId]?.prestige ?? 60;
	const slot = state.schedule.find((g) => g.id === live.slotId);
	const neutral = slot?.site === "neutral" || slot?.kind === "ncaa" || slot?.kind === "nit" || slot?.kind === "crown" || slot?.kind === "mte" || slot?.kind === "conf-tourney";
	const gym = gymCrowd(state, live.homeId);
	const home = clamp(Math.max((hp - 32) / 62, gym.fill), .28, .98);
	const away = clamp((ap - 40) / 70, .12, .72);
	if (neutral) {
		const mix = clamp((home + away) / 2, .35, .9);
		return {
			home: mix,
			away: mix,
			packed: mix >= .78,
			split: true
		};
	}
	return {
		home,
		away: away * .42,
		packed: gym.packed || home >= .82,
		split: false
	};
}
function clash(off, def) {
	let two = 0, three = 0, to = 0, ft = 0;
	let note = "";
	if (off === "post" && def === "pack") {
		two -= .12;
		three += .05;
		note = "Pack-line fronted the post.";
	} else if (off === "post" && def === "man") {
		two += .11;
		note = "The block was theirs.";
	} else if (off === "post" && def === "zone") {
		two += .08;
		note = "Soft middle. The 5 went to work.";
	} else if (off === "post" && def === "trap") {
		to += .1;
		three += .06;
		note = "They trapped the catch. Kick or die.";
	} else if (off === "spread" && def === "zone") {
		three += .14;
		two -= .06;
		note = "Zone left the corner.";
	} else if (off === "spread" && def === "press") {
		to += .12;
		note = "Press jumped the skip.";
	} else if (off === "spread" && def === "pack") {
		three -= .06;
		note = "Pack-line ran the shooter off the line.";
	} else if (off === "push" && def === "press") {
		two += .1;
		to += .1;
		note = "Press vs the push — live by the break.";
	} else if (off === "push" && def === "sag") {
		two += .08;
		note = "They sagged. The rim was there early.";
	} else if (off === "iso" && def === "trap") {
		to += .14;
		note = "Double came on the clear-out.";
	} else if (off === "iso" && def === "switch") {
		two += .07;
		note = "Switch left a mismatch on an island.";
	} else if (off === "iso" && def === "pack") {
		two -= .07;
		note = "Help sat in the paint. Iso had nowhere.";
	} else if (off === "pnr" && def === "trap") {
		to += .11;
		three += .07;
		note = "Trap on the screen. Pocket or turnover.";
	} else if (off === "pnr" && def === "switch") {
		two += .09;
		note = "Switch. The roll was open.";
	} else if (off === "pnr" && def === "sag") {
		three += .06;
		note = "They sat back. The pull-up was there.";
	} else if (off === "motion" && def === "man") {
		two += .05;
		to -= .04;
		note = "Motion vs man — the cut was on time.";
	} else if (off === "motion" && def === "zone") {
		three += .05;
		note = "Extra pass vs the zone.";
	} else if (off === "horns" && def === "man") {
		two += .08;
		note = "Horns got a dive at the nail.";
	} else if (off === "horns" && def === "zone") {
		two += .06;
		three += .04;
		note = "High post vs zone.";
	} else if (off === "floppy" && def === "zone") {
		three += .12;
		note = "Floppy into a gap in the zone.";
	} else if (off === "floppy" && def === "switch") {
		three -= .05;
		two += .04;
		note = "They switched the screen. Floppy died.";
	} else if (off === "hammer" && def === "zone") {
		three += .1;
		note = "Corner was empty. Hammer.";
	} else if (off === "hammer" && def === "man") {
		two += .08;
		note = "Backdoor cut vs overplay.";
	} else if (off === "delay" && def === "press") {
		to -= .06;
		note = "They pressed a hold. You burned clock.";
	} else if (off === "delay" && def === "foul") {
		ft += .35;
		note = "Intentional foul. The offense shoots.";
	} else if (def === "foul") {
		ft += .4;
		two -= .15;
		three -= .15;
		note = "Intentional foul. The offense shoots.";
	} else if (def === "press") {
		to += .07;
		note = "Pressure on the ball.";
	} else if (def === "trap") {
		to += .08;
		note = "Trap came.";
	} else note = "Play whistled dead.";
	return {
		two,
		three,
		to,
		ft,
		note
	};
}
function mix(off, def) {
	const m = {
		two: .44,
		three: .36,
		ft: .14,
		to: .17,
	};
	if (off === "post") {
		m.two += .2;
		m.three -= .14;
		m.ft += .04;
	}
	if (off === "spread" || off === "floppy") {
		m.three += .22;
		m.two -= .14;
	}
	if (off === "iso") {
		m.two += .08;
		m.to += .05;
	}
	if (off === "pnr" || off === "horns") {
		m.two += .1;
		m.three += .04;
	}
	if (off === "push") {
		m.two += .08;
		m.three += .06;
		m.to += .05;
	}
	if (off === "hammer") {
		m.three += .1;
		m.two += .06;
	}
	if (off === "delay") {
		m.two += .08;
		m.to -= .06;
		m.three -= .04;
	}
	if (off === "motion") m.to -= .04;
	if (def === "press" || def === "trap") {
		m.to += .12;
		m.ft += .07;
	}
	if (def === "zone") {
		m.three += .1;
		m.two -= .08;
	}
	if (def === "pack") {
		m.three -= .14;
		m.two += .08;
	}
	if (def === "foul") {
		m.ft = .82;
		m.two = .08;
		m.three = .04;
		m.to = .06;
	}
	const c = clash(off, def);
	m.to = Math.max(.04, m.to + c.to);
	m.ft = Math.max(.04, m.ft + c.ft * .15);
	const sum = m.two + m.three + m.ft + m.to;
	m.two /= sum;
	m.three /= sum;
	m.ft /= sum;
	m.to /= sum;
	return m;
}
function rollKind(rng, off, def) {
	const m = mix(off, def);
	const x = rng();
	if (x < m.two) return "two";
	if (x < m.two + m.three) return "three";
	if (x < m.two + m.three + m.ft) return "ft";
	return "to";
}
export function intentionalFoulText(youOff, defender, shooter) {
	if (youOff) return `${defender} fouls ${shooter}. They sent you to the line.`;
	return `${defender} fouls ${shooter}. You sent them to the line.`;
}
function describe(off, def, kind, made, a, b, defP, and1, youOff) {
	const A = nm(a);
	const B = nm(b);
	const D = nm(defP);
	if (def === "foul") return intentionalFoulText(youOff, D, A);
	if (kind === "to") {
		if (off === "push") return `Turnover in the open floor! Stolen by ${D}.`;
		if (def === "press" || def === "trap") return `The press gets ${A}! ${D} steals it.`;
		if (off === "post") return `${D} strips ${A} on the block.`;
		return `Turnover! ${D} steals it from ${A}.`;
	}
	if (kind === "ft") {
		if (off === "post") return `${D} fouls ${A} in the post.`;
		if (off === "push") return `${D} fouls ${A} in transition.`;
		return `${D} fouls ${A}. ${A} at the stripe.`;
	}
	if (kind === "three") {
		if (made) {
			if (off === "post" && b.id !== a.id) return `${B} kicks it out... ${A} for three!`;
			if (off === "push") return `${A} pulls up in transition... BANG!`;
			if (off === "hammer" && b.id !== a.id) return `${B} finds ${A} in the corner... three!`;
			if (off === "hammer") return `${A} in the corner... three!`;
			if (off === "pnr" && b.id !== a.id) return `${B} draws two, ${A} pops... three!`;
			return `${A} for three!`;
		}
		if (off === "push") return `${A} rushes a three. No.`;
		return `${A} misses from downtown.`;
	}
	if (made) {
		if (and1) return `${A}... AND ONE!`;
		if (off === "post") return `${A} drop-steps ${D}. Bucket.`;
		if (off === "push") return `${A} throws it down!`;
		if (off === "iso") return `${A} creates... jumper's good.`;
		if (off === "pnr") return `${A} turns the corner. Lays it in.`;
		if (off === "horns") return `${A} dives, pocket pass, finish.`;
		return `${A} lays it in.`;
	}
	if (off === "post") return `${A} is short in the post.`;
	if (off === "iso") return `${A}'s jumper is short.`;
	if (off === "push") return `${A} off the glass in transition. No.`;
	return `${A}'s jumper rims out.`;
}
function hoopFt(poss) {
	return poss === "home" ? {
		x: 88.75,
		y: 25
	} : {
		x: 5.25,
		y: 25
	};
}
/** Place the play on the floor from the outcome — not a random decoration. */
export function playSpot(kind, off, poss, rng) {
	const h = hoopFt(poss);
	const dir = poss === "home" ? -1 : 1;
	let x = h.x;
	let y = h.y;
	if (kind === "ft") {
		x = h.x + dir * 13.75;
		y = 25 + (rng() - .5) * .6;
	} else if (kind === "to") {
		if (off === "push") {
			x = 47 + dir * (8 + rng() * 18);
			y = 10 + rng() * 30;
		} else {
			x = h.x + dir * (18 + rng() * 16);
			y = 8 + rng() * 34;
		}
	} else if (kind === "three") {
		if (rng() < .34) {
			x = h.x + dir * 2.2;
			y = rng() < .5 ? 3.2 : 46.8;
		} else if (rng() < .35) {
			x = h.x + dir * 22.4;
			y = 25 + (rng() - .5) * 6;
		} else {
			const ang = (rng() < .5 ? 1 : -1) * (.45 + rng() * .55);
			x = h.x + dir * Math.cos(ang) * 22.6;
			y = h.y + Math.sin(ang) * 22.6;
		}
	} else {
		const d = off === "post" ? 2 + rng() * 4 : off === "pnr" || off === "horns" ? 4 + rng() * 8 : 3 + rng() * 12;
		const ang = (rng() - .5) * 1.6;
		x = h.x + dir * Math.cos(ang) * d;
		y = h.y + Math.sin(ang) * d;
	}
	return {
		x: clamp(x, 1.5, 92.5),
		y: clamp(y, 1.5, 48.5)
	};
}
export function distToHoop(x, y, poss) {
	const h = hoopFt(poss);
	return Math.hypot(x - h.x, y - h.y);
}
function impactLine(_off, _def, _kind, _made, _pts, note, _youOff) {
	return note;
}
function possSeconds(rng, off, def, clock, stall, pace, late) {
	if (def === "foul" || late === "foul3") return Math.min(clock, randInt(rng, 2, 4));
	if (off === "delay") {
		if (clock <= 60) return Math.min(clock, Math.max(3, clock - randInt(rng, 0, stall ? 2 : 4)));
		return Math.min(clock, randInt(rng, stall ? 24 : 20, stall ? 36 : 32));
	}
	if (late === "twofor" || (pace === "fast" && off === "push" && clock <= 58 && clock >= 24)) {
		if (clock >= 18) return Math.min(clock, randInt(rng, 6, 9));
	}
	let sec = off === "push" ? randInt(rng, stall ? 12 : 10, stall ? 17 : 15) : off === "iso" ? randInt(rng, stall ? 18 : 16, stall ? 26 : 23) : randInt(rng, stall ? 16 : 14, stall ? 23 : 20);
	if (def === "press" || def === "trap") sec = Math.max(12, sec - 2);
	if (pace === "slow") sec += 4;
	else if (pace === "fast") sec = Math.max(11, sec - 2);
	return Math.min(clock, Math.max(4, sec));
}
function believeLine(live, rng, kind, made) {
	if (live.homeId === "utah-state") {
		if (made && kind === "three") return "I Believe that we will win — the Spectrum is on its feet.";
		if (made && kind === "two" && rng() < .18) return "I Believe that we will win — the Spectrum is on its feet.";
		if (rng() < .12) return "I Believe that we will win — the Spectrum is on its feet.";
		return null;
	}
	if (live.awayId === "utah-state" && rng() < .1) return "The Aggie bench is chirping I Believe on the road.";
	return null;
}
export function startLiveGame(state) {
	if (state.liveGame && !state.liveGame.done) return state;
	const open = state.schedule.filter((x) => !x.resultId && !x.declined && (x.homeId === state.playerTeamId || x.awayId === state.playerTeamId)).sort((a, b) => a.week - b.week);
	const g = state.phase === "regular" ? open.find((x) => x.week === state.week) : open[0];
	if (!g) return null;
	const home = teamOf(g.homeId);
	const away = teamOf(g.awayId);
	if (!home || !away) return null;
	const plan = state.gamePlan;
	const live = {
		slotId: g.id,
		homeId: g.homeId,
		awayId: g.awayId,
		homeScore: 0,
		awayScore: 0,
		half: 1,
		clock: 1200,
		poss: "home",
		offCall: plan?.off[0] ?? "motion",
		defCall: plan?.def[0] ?? "man",
		log: [{
			t: "H1 20:00",
			text: `${away.name} at ${home.name}. Tip to the home side.`,
			homeScore: 0,
			awayScore: 0
		}],
		done: false,
		planned: false,
		planOff: plan?.off ? [...plan.off] : [
			"motion",
			"pnr",
			"spread"
		],
		planDef: plan?.def ? [...plan.def] : ["man", "pack"],
		htAdj: false,
		homeLines: availableRoster(state, g.homeId).slice(0, 13).map(blankLine),
		awayLines: availableRoster(state, g.awayId).slice(0, 13).map(blankLine),
		timeoutsHome: 4,
		timeoutsAway: 4,
		shots: []
	};
	return {
		...state,
		liveGame: live
	};
}
export function callTimeout(state) {
	const live = state.liveGame;
	if (!live || live.done || !live.planned) return state;
	const youHome = live.homeId === state.playerTeamId;
	const key = youHome ? "timeoutsHome" : "timeoutsAway";
	const left = live[key] ?? 4;
	if (left <= 0) return state;
	const text = youHome
		? `${TEAM_BY_ID[live.homeId]?.name ?? "Home"} timeout. ${left - 1} left.`
		: `${TEAM_BY_ID[live.awayId]?.name ?? "Away"} timeout. ${left - 1} left.`;
	return {
		...state,
		liveGame: {
			...live,
			[key]: left - 1,
			timeoutBoost: 0.035,
			log: [{
				t: clockLabel(live.half, live.clock),
				text,
				homeScore: live.homeScore,
				awayScore: live.awayScore,
				kind: "period"
			}, ...live.log].slice(0, 48)
		}
	};
}
export function setPlanSlot(state, side, index, id) {
	const live = state.liveGame;
	const plan = state.gamePlan ?? {
		off: [
			"motion",
			"pnr",
			"spread"
		],
		def: ["man", "pack"]
	};
	if (side === "off") {
		const off = [...plan.off];
		off[clamp(index, 0, 2)] = id;
		const next = {
			...state,
			gamePlan: {
				...plan,
				off
			}
		};
		if (!live || live.done || live.planned) return next;
		return {
			...next,
			liveGame: {
				...live,
				planOff: [...off],
				offCall: off[0]
			}
		};
	}
	const def = [...plan.def];
	def[clamp(index, 0, 1)] = id;
	const next = {
		...state,
		gamePlan: {
			...plan,
			def
		}
	};
	if (!live || live.done || live.planned) return next;
	return {
		...next,
		liveGame: {
			...live,
			planDef: [...def],
			defCall: def[0]
		}
	};
}
export function lockGamePlan(state) {
	const live = state.liveGame;
	if (!live || live.done) return state;
	const off = live.planOff?.length ? live.planOff : state.gamePlan?.off ?? ["motion"];
	const def = (live.planDef?.length ? live.planDef : state.gamePlan?.def ?? ["man"]).map((id) => id === "foul" ? "man" : id);
	return {
		...state,
		liveGame: {
			...live,
			planned: true,
			offCall: off[0],
			defCall: def[0],
			log: [{
				t: "H1 20:00",
				text: `Gameplan set. ${OFF_META[off[0]].label} to start. Tip.`,
				homeScore: 0,
				awayScore: 0
			}]
		}
	};
}
export function setLiveCall(state, kind, id) {
	const live = state.liveGame;
	if (!live || live.done) return state;
	const coach = state.identity?.last || "Coach";
	const changed = kind === "off" ? live.offCall !== id : live.defCall !== id;
	const label = kind === "off" ? OFF_META[id]?.label ?? id : DEF_META[id]?.label ?? id;
	const text = kind === "off"
		? `${coach} goes to ${label}.`
		: id === "zone"
			? `${coach} switches to a ${label}.`
			: id === "foul"
				? `${coach} says foul them.`
				: `${coach} switches to ${label}.`;
	const next = kind === "off"
		? { ...live, offCall: id, lastYouOff: id, htAdj: live.half >= 2 ? true : live.htAdj }
		: { ...live, defCall: id, lastYouDef: id, htAdj: live.half >= 2 ? true : live.htAdj };
	if (!changed || !live.planned) return { ...state, liveGame: next };
	return {
		...state,
		liveGame: {
			...next,
			log: [{
				t: clockLabel(live.half, live.clock),
				text,
				homeScore: live.homeScore,
				awayScore: live.awayScore,
				kind: "period"
			}, ...live.log].slice(0, 48)
		}
	};
}
export function setLivePace(state, pace) {
	const live = state.liveGame;
	if (!live || live.done || !live.planned) return state;
	if ((live.pace ?? "normal") === pace) return state;
	const coach = state.identity?.last || "Coach";
	const word = pace === "slow" ? "slows it down" : pace === "fast" ? "pushes the tempo" : "goes back to a normal pace";
	return {
		...state,
		liveGame: {
			...live,
			pace,
			log: [{
				t: clockLabel(live.half, live.clock),
				text: `${coach} ${word}.`,
				homeScore: live.homeScore,
				awayScore: live.awayScore,
				kind: "period"
			}, ...live.log].slice(0, 48)
		}
	};
}
function userFive(state, live) {
	const you = state.playerTeamId;
	const side = live.homeId === you ? "home" : live.awayId === you ? "away" : null;
	if (!side) return null;
	const key = side === "home" ? "homeOn" : "awayOn";
	const roster = availableRoster(state, you);
	let on = live[key];
	if (!on || on.length < 5) on = roster.slice().sort((a, b) => b.mpg - a.mpg).slice(0, 5).map((p) => p.id);
	return { side, key, roster, on };
}
export function toggleLiveSub(state, playerId) {
	const live = state.liveGame;
	if (!live || live.done || !live.planned) return state;
	const pack = userFive(state, live);
	if (!pack) return state;
	const { key, roster, on } = pack;
	const onSet = new Set(on);
	let nextOn = on.slice();
	let text = "";
	if (onSet.has(playerId)) {
		const bench = roster.filter((p) => !onSet.has(p.id)).sort((a, b) => b.mpg - a.mpg);
		const inn = bench[0];
		if (!inn) return state;
		const out = roster.find((p) => p.id === playerId);
		nextOn = on.map((id) => id === playerId ? inn.id : id);
		text = `${inn.first} ${inn.last} checks in for ${out ? `${out.first} ${out.last}` : "him"}.`;
	} else {
		const inn = roster.find((p) => p.id === playerId);
		if (!inn) return state;
		const lines = pack.side === "home" ? live.homeLines : live.awayLines;
		const worst = [...on].sort((a, b) => {
			const load = (id) => fatigueOf(state, id) + ((lines?.find((l) => l.id === id)?.pf ?? 0) * 10);
			return load(b) - load(a);
		})[0];
		const out = roster.find((p) => p.id === worst);
		nextOn = on.map((id) => id === worst ? playerId : id);
		text = `${inn.first} ${inn.last} checks in for ${out ? `${out.first} ${out.last}` : "him"}.`;
	}
	const alert = live.foulAlert && nextOn.includes(live.foulAlert.id) ? live.foulAlert : null;
	return {
		...state,
		liveGame: {
			...live,
			[key]: nextOn,
			foulAlert: alert,
			log: [{
				t: clockLabel(live.half, live.clock),
				text,
				homeScore: live.homeScore,
				awayScore: live.awayScore,
				kind: "period"
			}, ...live.log].slice(0, 48)
		}
	};
}
export function sitFoul(state) {
	const id = state.liveGame?.foulAlert?.id;
	if (!id) return state;
	return toggleLiveSub(state, id);
}
/** First half: 3 fouls, or 2 early for a starter. Later: 4. Five fouls is a disqualification, not a prompt. */
export function isFoulTrouble(half, clock, fouls, starter = false) {
	if (fouls >= 5 || fouls < 2) return false;
	if (half <= 1) {
		if (fouls >= 3) return true;
		return Boolean(starter) && fouls >= 2 && clock >= 15 * 60;
	}
	return fouls >= 4;
}
export function liveYouOffense(state) {
	const live = state.liveGame;
	if (!live) return true;
	return (live.poss === "home" ? live.homeId : live.awayId) === state.playerTeamId;
}
/** Full-court press needs a dead-ball inbound. A missed shot is a live rebound. */
export function pressLegal(state) {
	const live = state.liveGame;
	if (!live) return false;
	const last = live.log.find((e) => e.kind && e.kind !== "period");
	if (!last) return true;
	if ((last.poss === "home" ? live.homeId : live.awayId) !== state.playerTeamId) return true;
	if (last.kind === "to") return true;
	return Boolean(last.made);
}
export function lateMenu(state) {
	return endgameMenu(state);
}
export function queueLate(state, choice) {
	const live = state.liveGame;
	if (!live || live.done) return state;
	const next = { ...live, lateChoice: choice };
	if (choice === "twofor") {
		next.pace = "fast";
		next.offCall = "push";
		next.lastYouOff = "push";
	}
	if (choice === "foul3") {
		next.defCall = "foul";
		next.lastYouDef = "foul";
	}
	if (choice === "letplay") {
		next.defCall = next.defCall === "foul" ? "man" : next.defCall || "man";
		next.lastYouDef = next.defCall;
	}
	return { ...state, liveGame: next };
}
export function offeredCalls(state): CallOption[] {
	const live = state.liveGame;
	if (!live || live.done) return [];
	const youOff = liveYouOffense(state);
	const rng = mulberry32(state.seed ^ live.clock ^ live.log.length ^ live.half * 17);
	const youScore = live.homeId === state.playerTeamId ? live.homeScore : live.awayScore;
	const trail = (live.homeId === state.playerTeamId ? live.awayScore : live.homeScore) - youScore;
	const late = live.half >= 2 && live.clock <= 90;
	const r = roster(state, state.playerTeamId);
	const big = r.find((p) => p.pos === "C" || p.pos === "PF");
	const wing = r.find((p) => p.pos === "SG" || p.pos === "SF");
	const offPool = [];
	const defPool = [];
	if (youOff) {
		offPool.push("motion", "pnr");
		if (big && (big.skills?.finish ?? big.ovr) >= 58) offPool.push("post", "horns");
		if (wing && (wing.skills?.shoot ?? wing.ovr) >= 58) offPool.push("spread", "floppy", "hammer");
		offPool.push("iso", "push");
		if (late || (live.half >= 2 && live.clock <= 45)) offPool.unshift("delay");
		if (trail >= 1 && live.half >= 2 && live.clock <= 240) offPool.unshift("push");
		if (trail >= 4) offPool.push("spread", "push", "hammer");
		if (trail <= -6 && live.clock < 40) offPool.push("delay");
	} else {
		defPool.push("man", "zone", "pack");
		const inbound = pressLegal(state);
		if (inbound && (trail > 0 || live.lastYouOff === "push")) defPool.push("press", "trap");
		else if (inbound) defPool.push("press");
		else if (trail > 0 || live.lastYouOff === "push") defPool.push("trap");
		if (live.lastYouOff === "post") defPool.push("pack", "sag");
		if (live.lastYouOff === "spread" || live.lastYouOff === "floppy") defPool.push("pack", "switch");
		if (live.half >= 2 && live.clock <= 150 && trail >= 1 && trail <= 10) defPool.unshift("foul");
		if (late && trail >= 1 && trail <= 3) defPool.push("foul");
		if (trail <= -8) defPool.push("sag", "pack");
		defPool.push("switch");
	}
	const seen = new Set();
	const pool = (youOff ? offPool : defPool).filter((id) => {
		if (seen.has(id)) return false;
		seen.add(id);
		return true;
	});
	const shuffled = [...pool].sort(() => rng() - .5);
	const planBoost = youOff ? live.planOff ?? [] : live.planDef ?? [];
	const preferred = [...new Set(planBoost.filter((id) => pool.includes(id)))];
	const rest = shuffled.filter((id) => !preferred.includes(id));
	const take = [...preferred, ...rest];
	const n = live.half === 2 && !live.htAdj ? 6 : 4;
	while (take.length < n) {
		const extra = youOff ? pick(rng, [
			"motion",
			"pnr",
			"iso",
			"push"
		]) : pick(rng, pressLegal(state) ? [
			"man",
			"zone",
			"pack",
			"press"
		] : [
			"man",
			"zone",
			"pack",
			"switch"
		]);
		if (!take.includes(extra)) take.push(extra);
		else break;
	}
	return take.slice(0, n).map((id) => youOff ? {
		id,
		side: "off",
		label: OFF_META[id].label
	} : {
		id,
		side: "def",
		label: DEF_META[id].label
	});
}
export function stepLive(state, n = 1) {
	let s = state;
	for (let i = 0; i < n; i++) {
		if (!s.liveGame || s.liveGame.done) break;
		s = onePoss(s);
	}
	return s;
}
function padLive(live) {
	const minutes = liveMinutes(live.half);
	const homeLines = clampPlayerFta((live.homeLines ?? []).map((p) => ({ ...p })), minutes);
	const awayLines = clampPlayerFta((live.awayLines ?? []).map((p) => ({ ...p })), minutes);
	const hPts = homeLines.reduce((n, p) => n + (p.pts ?? 0), 0);
	const aPts = awayLines.reduce((n, p) => n + (p.pts ?? 0), 0);
	return {
		...live,
		homeScore: homeLines.length ? hPts : live.homeScore,
		awayScore: awayLines.length ? aPts : live.awayScore,
		homeLines,
		awayLines
	};
}
function sealLive(state, live) {
	const boardH = live.homeScore;
	const boardA = live.awayScore;
	const padded = padLive(live);
	const rng = mulberry32((state.seed ^ hashString(padded.slotId) ^ (padded.homeScore * 17) ^ padded.awayScore) >>> 0);
	finishRealism(padded.homeLines ?? [], padded.awayLines ?? [], roster(state, padded.homeId), roster(state, padded.awayId), rng);
	for (const rows of [padded.homeLines, padded.awayLines]) {
		if (!rows) continue;
		const fgm = rows.reduce((n, p) => n + (p.fgm ?? 0), 0);
		let ast = rows.reduce((n, p) => n + (p.ast ?? 0), 0);
		const order = [...rows].sort((a, b) => (b.ast ?? 0) - (a.ast ?? 0));
		while (ast > fgm && order.length) {
			const p = order.find((x) => (x.ast ?? 0) > 0);
			if (!p) break;
			p.ast = (p.ast ?? 0) - 1;
			ast--;
		}
	}
	const fixed = reconcileFinal(padded.homeLines ?? [], padded.awayLines ?? [], boardH, boardA);
	logBoxFaults(`${padded.homeId} home`, padded.homeLines);
	logBoxFaults(`${padded.awayId} away`, padded.awayLines);
	return {
		...padded,
		homeScore: fixed.homeScore,
		awayScore: fixed.awayScore
	};
}
export function simRestLive(state, opts = {}) {
	const finish = !opts || opts.finish !== false;
	let s = state;
	let guard = 0;
	let held = false;
	while (s.liveGame && !s.liveGame.done && guard++ < 320) {
		const live = s.liveGame;
		if (!finish && live.half >= 2 && live.clock > 0 && live.clock <= 120 && Math.abs(live.homeScore - live.awayScore) <= 8) {
			held = true;
			const youHave = (live.poss === "home" ? live.homeId : live.awayId) === s.playerTeamId;
			const mm = Math.floor(live.clock / 60);
			const ss = Math.floor(live.clock % 60);
			const left = `${mm}:${String(ss).padStart(2, "0")}`;
			s = {
				...s,
				liveGame: {
					...live,
					log: [{
						t: clockLabel(live.half, live.clock),
						text: `Close game, ${youHave ? "you have" : "they have"} the ball with ${left} left.`,
						homeScore: live.homeScore,
						awayScore: live.awayScore,
						kind: "period"
					}, ...live.log].slice(0, 48)
				}
			};
			break;
		}
		s = onePoss(s);
	}
	if (held) return s;
	if (s.liveGame && !s.liveGame.done) {
		const live = sealLive(state, {
			...s.liveGame,
			clock: 0,
			done: true
		});
		s = {
			...s,
			liveGame: {
				...live,
				log: [{
					t: "Final",
					text: `Final: ${TEAM_BY_ID[live.homeId]?.name} ${live.homeScore}, ${TEAM_BY_ID[live.awayId]?.name} ${live.awayScore}.`,
					homeScore: live.homeScore,
					awayScore: live.awayScore,
					kind: "period"
				}, ...live.log].slice(0, 48)
			}
		};
	} else if (s.liveGame?.done) s = {
		...s,
		liveGame: sealLive(state, s.liveGame)
	};
	return s;
}
function liveFive(rng, roster, lines, pinned) {
	const foulOut = (id) => (lines?.find((x) => x.id === id)?.pf ?? 0) >= 5;
	const pool = roster.filter((p) => !foulOut(p.id));
	const use = pool.length >= 5 ? pool : roster;
	if (pinned && pinned.length) {
		const on = [];
		for (const id of pinned) {
			const p = use.find((x) => x.id === id);
			if (p && !foulOut(p.id) && !on.some((q) => q.id === p.id)) on.push(p);
		}
		for (const p of [...use].sort((a, b) => b.mpg - a.mpg)) {
			if (on.length >= 5) break;
			if (!on.some((q) => q.id === p.id)) on.push(p);
		}
		if (on.length >= 5) return on.slice(0, 5);
	}
	const played = use.map((p) => lines?.find((x) => x.id === p.id)?.min ?? 0);
	return onCourtFive(rng, use, use.map((p) => Math.max(8, p.mpg)), played);
}
export function activeFive(rng, roster, lines, pinned) {
	return liveFive(rng, roster, lines, pinned);
}
function assistGuy(rng, five, shooter) {
	const mates = (five ?? []).filter((p) => p && p.id && p.id !== shooter?.id && p.id !== "walk");
	if (!mates.length || rng() > 0.58) return null;
	const w = mates.map((p) => {
		const iq = (p.skills?.iq ?? p.ovr ?? 60) / 100;
		const pos = p.pos === "PG" ? 3.1 : p.pos === "SG" ? 1.8 : p.pos === "SF" ? 1.1 : 0.6;
		return pos * (0.4 + iq);
	});
	let t = rng() * w.reduce((s, n) => s + n, 0);
	for (let i = 0; i < mates.length; i++) {
		t -= w[i];
		if (t <= 0) return mates[i];
	}
	return mates[0];
}
function onePoss(state) {
	const live = state.liveGame;
	if (!live || live.done) return state;
	const tick = (live.ticks ?? 0) + 1;
	const rng = mulberry32((Math.imul((state.seed ^ hashString(String(live.slotId))) >>> 0, 0x9e3779b1) ^ Math.imul(tick, 0x85ebca6b) ^ Math.imul((live.clock | 0) + 1, 0xc2b2ae35) ^ Math.imul((live.homeScore | 0) + 1, 0x27d4eb2f) ^ Math.imul((live.awayScore | 0) + 3, 0x165667b1) ^ Math.imul(live.half | 0, 0x94d049bb)) >>> 0);
	const offId = live.poss === "home" ? live.homeId : live.awayId;
	const defId = live.poss === "home" ? live.awayId : live.homeId;
	const youOff = offId === state.playerTeamId;
	const offScore = offId === live.homeId ? live.homeScore : live.awayScore;
	const defScore = offId === live.homeId ? live.awayScore : live.homeScore;
	const youScoreNow = live.homeId === state.playerTeamId ? live.homeScore : live.awayScore;
	const oppScoreNow = live.homeId === state.playerTeamId ? live.awayScore : live.homeScore;
	if (!youOff && live.half >= 2 && !live.parked12 && youScoreNow - oppScoreNow === 3 && live.clock > FOUL_CLOCK && live.clock <= 40) {
		return {
			...state,
			liveGame: {
				...live,
				clock: 12,
				parked12: true,
				ticks: tick,
				log: [{
					t: clockLabel(live.half, 12),
					text: "0:12. Up 3. They have the ball. Foul up 3, or don't.",
					homeScore: live.homeScore,
					awayScore: live.awayScore,
					kind: "period"
				}, ...live.log].slice(0, 48)
			}
		};
	}
	let defPlay = youOff ? cpuDef(rng, live.offCall, live.lastYouOff) : live.defCall;
	if (!youOff && live.lateChoice === "foul3") defPlay = "foul";
	if (!youOff && live.lateChoice === "letplay" && defPlay === "foul") defPlay = "man";
	if (defPlay === "foul" && !foulIsLegal(live, defScore, offScore)) {
		const fallback = live.planDef?.[0] ?? "man";
		defPlay = fallback === "foul" ? "man" : fallback;
	}
	const offPlay = youOff && live.lateChoice === "twofor" ? "push" : youOff ? live.offCall : cpuOff(rng, defPlay, live.lastYouDef);
	const offR = roster(state, offId);
	const defR = roster(state, defId);
	const offLines0 = live.poss === "home" ? live.homeLines : live.awayLines;
	const defLines0 = live.poss === "home" ? live.awayLines : live.homeLines;
	const offFive = liveFive(rng, offR, offLines0, live.poss === "home" ? live.homeOn : live.awayOn);
	const defFive = liveFive(rng, defR, defLines0, live.poss === "home" ? live.awayOn : live.homeOn);
	const offPool = offFive.length ? offFive : offR;
	const defPool = defFive.length ? defFive : defR;
	let a = defPlay === "foul" ? pickFoulTarget(rng, offPool) : pickPlayer(rng, offPool, OFF_META[offPlay].prefer);
	if ((offLines0?.find((x) => x.id === a.id)?.pts ?? 0) >= 42) {
		const cooler = offPool.filter((p) => p.id !== a.id && (offLines0?.find((x) => x.id === p.id)?.pts ?? 0) < 42);
		if (cooler.length) a = pickPlayer(rng, cooler, null);
		else {
			const other = [...offPool].filter((p) => p.id !== a.id).sort((p, q) => (offLines0?.find((x) => x.id === p.id)?.pts ?? 0) - (offLines0?.find((x) => x.id === q.id)?.pts ?? 0))[0];
			if (other) a = other;
		}
	}
	const b = pickPlayer(rng, offPool, offPlay === "spread" || offPlay === "floppy" || offPlay === "hammer" ? ["SG", "SF"] : null);
	const d = pickPlayer(rng, defPool, null);
	const c = clash(offPlay, defPlay);
	const coach = state.coachSkills;
	const coachOff = youOff ? ((coach?.offense ?? 48) - 50) / 180 : 0;
	const coachDef = !youOff ? ((coach?.defense ?? 48) - 50) / 180 : 0;
	const gap = (teamOvr(state, offId) - teamOvr(state, defId)) / 28;
	const edge = gap * 0.08 + (offId === live.homeId ? (gymLiveEdge(state, live.homeId) + rivalryEdge(live.homeId, live.awayId)) * 0.35 : 0);
	const chem = teamChemistry(state, offId).score;
	const chemSwing = (chem - teamChemistry(state, defId).score) / 800;
	const extraPass = chem >= 72 && (a.skills?.iq ?? 0) + (b.skills?.iq ?? 0) >= 140;
	const shoot = (a.skills?.shoot ?? a.ovr) / 100;
	const finish = (a.skills?.finish ?? a.ovr) / 100;
	const iq = (a.skills?.iq ?? a.ovr) / 100;
	const dfn = (d.skills?.defense ?? d.ovr) / 100;
	let kind = rollKind(rng, offPlay, defPlay);
	if (defPlay === "foul") kind = "ft";
	if (live.lateChoice === "letplay" && kind === "ft") kind = rng() < 0.12 ? "to" : rng() < 0.34 ? "three" : "two";
	if (defPlay === "pack" && kind === "three" && rng() < .45) kind = "two";
	if (shoot > finish + .08 && kind === "two" && rng() < .18) kind = "three";
	if (finish > shoot + .1 && kind === "three" && rng() < .35) kind = "two";
	if ((a.pos === "C" || a.pos === "PF") && kind === "three" && rng() < .55) kind = "two";
	if (a.pos === "SG" && kind === "two" && shoot > .72 && rng() < .16) kind = "three";
	if (!eraHasThree(state.eraDecade) && kind === "three") kind = "two";
	else if (kind === "three" && eraThreeScale(state.eraDecade) < 1 && rng() > eraThreeScale(state.eraDecade)) kind = "two";
	if (kind !== "to" && kind !== "ft" && rng() < clamp(.02 + c.to * .04 - iq * .01 - gap * .008, 0, .06)) kind = "to";
	const make2 = clamp(.48 + finish * .08 - dfn * .05 + gap * .05 + c.two * .04 + chemSwing + gaussian(rng) * .012, .32, .58);
	const make3 = clamp(.345 + shoot * .06 - dfn * .03 + gap * .03 + c.three * .03 + chemSwing + gaussian(rng) * .01, .24, .42);
	let pts = 0;
	let made = false;
	let and1 = false;
	let ftm = 0;
	let fta = 0;
	if (kind === "two") {
		made = rng() < make2;
		pts = made ? 2 : 0;
		if (made && rng() < .08 + finish * .1) {
			and1 = true;
			fta = 1;
			if (rng() < clamp(.72 + (shoot - .68) * .45, .52, .88)) {
				ftm = 1;
				pts = 3;
			}
		}
	} else if (kind === "three") {
		made = rng() < make3;
		pts = made ? 3 : 0;
	} else if (kind === "ft") {
		const ft = clamp(.72 + (shoot - .68) * .5, .52, .88);
		const attempts = 2;
		fta = attempts;
		for (let i = 0; i < attempts; i++) if (rng() < ft) ftm++;
		pts = ftm;
		made = pts > 0;
	}
	const minutesNow = liveMinutes(live.half);
	const capNow = ftaCap(minutesNow);
	const sideNow = teamFtaCap(minutesNow);
	const offLinesNow = live.poss === "home" ? live.homeLines : live.awayLines;
	const shooterFta = offLinesNow?.find((x) => x.id === a.id)?.fta ?? 0;
	const sideFta = (offLinesNow ?? []).reduce((n, p) => n + (p.fta ?? 0), 0);
	const room = Math.min(capNow - shooterFta, sideNow - sideFta);
	if (fta > 0 && room < fta) {
		if (kind === "ft") {
			if (room <= 0) {
				kind = "two";
				made = rng() < make2;
				pts = made ? 2 : 0;
				fta = 0;
				ftm = 0;
				and1 = false;
			} else {
				fta = room;
				ftm = Math.min(ftm, fta);
				pts = ftm;
				made = pts > 0;
			}
		} else {
			and1 = false;
			fta = 0;
			ftm = 0;
			pts = made ? 2 : 0;
		}
	}
	let text = describe(offPlay, defPlay, kind, made, a, b, d, and1, youOff);
	if (offPlay === "delay" && youOff && live.clock <= 70) text = `Holding for last. ${text}`;
	if (live.lateChoice === "twofor") text = `2-for-1. Early shot. ${text}`;
	if (live.lateChoice === "letplay") text = `Don't foul — playing out the possession. ${text}`;
	if (live.lateChoice === "foul3" || (!youOff && defPlay === "foul" && live.half >= 2 && live.clock <= FOUL_CLOCK && defScore - offScore === 3)) text = `Foul up 3. Clock stops. ${text}`;
	if (extraPass && made && (kind === "two" || kind === "three") && b.id !== a.id && rng() < .45) text = `${text} Kick-out!`;
	if (chem <= 42 && kind === "to" && rng() < .4) text = `${text} Nobody wanted it.`;
	if (kind === "ft") text = `${text} ${pts} of ${fta || 2}.`;
	const believe = believeLine(live, rng, kind, made);
	if (believe) {
		if ((made && kind === "three" && live.homeId === "utah-state") || rng() < .12) text = `${text} ${believe}`;
	}
	const crowd = crowdFill(state, live);
	if (made && kind === "three" && live.poss === "home" && !crowd.split && rng() < crowd.home * .4) text = crowd.packed ? `${text} The crowd goes wild!` : `${text} The home crowd is up!`;
	else if (made && kind === "three" && crowd.split && rng() < .25) text = `${text} Both sides are on their feet.`;
	const impact = impactLine(offPlay, defPlay, kind, made, pts, c.note, youOff);
	const used = possSeconds(rng, offPlay, defPlay, live.clock, !eraHasShotClock(state.eraDecade), live.lateChoice === "twofor" ? "fast" : live.pace, live.lateChoice);
	let clock = live.clock - used;
	let parked12 = Boolean(live.parked12);
	if (live.half >= 2 && !parked12 && live.clock > 12 && clock < 12 && clock > 0) {
		clock = 12;
		parked12 = true;
	}
	let half = live.half;
	const homeScore = live.homeScore + (live.poss === "home" ? pts : 0);
	const awayScore = live.awayScore + (live.poss === "away" ? pts : 0);
	const spot = playSpot(kind, offPlay, live.poss, rng);
	let poss = live.poss === "home" ? "away" : "home";
	const astRaw = made && kind !== "to" && kind !== "ft" ? assistGuy(rng, offFive, a) : null;
	const ast = astRaw && astRaw.id !== a.id ? astRaw : null;
	const events = [{
		t: clockLabel(half, Math.max(0, clock)),
		text,
		homeScore,
		awayScore,
		impact,
		pts,
		kind,
		made,
		poss: live.poss,
		x: spot.x,
		y: spot.y,
		playerId: a.id,
		astId: ast?.id
	}, ...live.log].slice(0, 48);
	const homeLines = (live.homeLines ?? availableRoster(state, live.homeId).slice(0, 13).map(blankLine)).map((row) => ({ ...row }));
	const awayLines = (live.awayLines ?? availableRoster(state, live.awayId).slice(0, 13).map(blankLine)).map((row) => ({ ...row }));
	const offLines = live.poss === "home" ? homeLines : awayLines;
	const defLines = live.poss === "home" ? awayLines : homeLines;
	if (a.id && a.id !== "walk" && !offLines.some((x) => x.id === a.id)) offLines.push(blankLine(a));
	if (b.id && b.id !== "walk" && !offLines.some((x) => x.id === b.id)) offLines.push(blankLine(b));
	if (ast?.id && ast.id !== "walk" && !offLines.some((x) => x.id === ast.id)) offLines.push(blankLine(ast));
	const shooter = offLines.find((x) => x.id === a.id);
	const passer = ast ? offLines.find((x) => x.id === ast.id) : undefined;
	const dt = used / 60;
	for (const p of offFive) credit(offLines.find((x) => x.id === p.id), { min: dt });
	for (const p of defFive) credit(defLines.find((x) => x.id === p.id), { min: dt });
	if (kind === "to") {
		credit(shooter, { to: 1 });
		if (rng() < .55) credit(defLines.find((x) => x.id === d.id) ?? defLines[0], { stl: 1 });
	} else if (kind === "ft") credit(shooter, {
		fta,
		ftm,
		pts
	});
	else if (kind === "three") {
		credit(shooter, {
			fga: 1,
			tpa: 1,
			fgm: made ? 1 : 0,
			tpm: made ? 1 : 0,
			pts,
			fta,
			ftm
		});
		if (made) credit(passer, { ast: 1 });
		else {
			credit(defLines.find((x) => x.id === d.id) ?? defLines[0], { reb: 1 });
			if (rng() < .09) credit(defLines.find((x) => x.id === d.id) ?? defLines[0], { blk: 1 });
		}
	} else if (kind === "two") {
		credit(shooter, {
			fga: 1,
			fgm: made ? 1 : 0,
			pts,
			fta,
			ftm
		});
		if (made) credit(passer, { ast: 1 });
		else {
			credit(defLines.find((x) => x.id === d.id) ?? defLines[0], { reb: 1 });
			if (rng() < .07) credit(defLines.find((x) => x.id === d.id) ?? defLines[0], { blk: 1 });
		}
	}
	let foulAlert = live.foulAlert ?? null;
	const touchFoul = (who) => {
		if (!who || who.id === "walk") return;
		const row = defLines.find((x) => x.id === who.id) ?? defLines[0];
		if (!row) return;
		if ((row.pf ?? 0) >= 5) return;
		credit(row, { pf: 1 });
		const pf = row.pf ?? 0;
		if (defId !== state.playerTeamId) return;
		if (pf >= 5) {
			foulAlert = foulAlert?.id === row.id ? null : foulAlert;
			return;
		}
		const starter = (state.players.find((p) => p.id === row.id)?.mpg ?? 0) >= 22;
		foulAlert = isFoulTrouble(live.half, live.clock, pf, starter)
			? { id: row.id, name: row.name, fouls: pf }
			: foulAlert?.id === row.id
				? null
				: foulAlert;
	};
	if (kind === "ft" || and1 || defPlay === "foul") touchFoul(d);
	else if (rng() < (defPlay === "press" || defPlay === "trap" ? .12 : .07)) touchFoul(defPool[Math.floor(rng() * defPool.length)] ?? d);
	const sitFive = (teamId, lines, on) => {
		const dead = new Set(lines.filter((l) => (l.pf ?? 0) >= 5).map((l) => l.id));
		if (!dead.size) return on;
		const team = availableRoster(state, teamId);
		const base = on && on.length ? on.slice() : team.slice().sort((a, b) => b.mpg - a.mpg).slice(0, 5).map((p) => p.id);
		const kept = base.filter((id) => !dead.has(id));
		const bench = team.filter((p) => !kept.includes(p.id) && !dead.has(p.id)).sort((a, b) => b.mpg - a.mpg);
		const next = kept.slice();
		for (const p of bench) {
			if (next.length >= 5) break;
			next.push(p.id);
		}
		for (const id of dead) {
			if (!base.includes(id)) continue;
			const p = team.find((x) => x.id === id);
			if (!p) continue;
			events.unshift({
				t: clockLabel(half, Math.max(0, clock)),
				text: `${p.first} ${p.last} has five fouls and sits.`,
				homeScore,
				awayScore,
				kind: "period"
			});
		}
		return next;
	};
	const homeOn = sitFive(live.homeId, homeLines, live.homeOn);
	const awayOn = sitFive(live.awayId, awayLines, live.awayOn);
	if (clock <= 0) {
		if (half === 1) {
			half = 2;
			clock = 1200;
			poss = "away";
			events.unshift({
				t: "H2 20:00",
				text: `Halftime ${TEAM_BY_ID[live.homeId]?.abbr} ${homeScore}, ${TEAM_BY_ID[live.awayId]?.abbr} ${awayScore}. Mix the plan.`,
				homeScore,
				awayScore,
				kind: "period"
			});
		} else if (half === 2 && homeScore === awayScore) {
			half = 3;
			clock = 300;
			// poss is already the team that did not just have the ball. Do not hand it back to home.
			const otId = poss === "home" ? live.homeId : live.awayId;
			events.unshift({
				t: "OT 5:00",
				text: `Tied. ${TEAM_BY_ID[otId]?.abbr ?? "They"} ball to start overtime.`,
				homeScore,
				awayScore,
				kind: "period"
			});
		} else if (half >= 3 && homeScore === awayScore && half < 5) {
			half = half + 1;
			clock = 300;
			const otId = poss === "home" ? live.homeId : live.awayId;
			events.unshift({
				t: "OT 5:00",
				text: `Still tied. ${TEAM_BY_ID[otId]?.abbr ?? "They"} ball.`,
				homeScore,
				awayScore,
				kind: "period"
			});
		} else {
			const finished = sealLive(state, {
				...live,
				homeScore,
				awayScore,
				clock: 0,
				poss,
				half,
				homeLines,
				awayLines,
				done: true,
				ticks: tick,
				log: events
			});
			finished.log = [{
				t: "Final",
				text: `Final: ${TEAM_BY_ID[finished.homeId]?.name} ${finished.homeScore}, ${TEAM_BY_ID[finished.awayId]?.name} ${finished.awayScore}.`,
				homeScore: finished.homeScore,
				awayScore: finished.awayScore,
				kind: "period"
			}, ...finished.log.filter((e) => e.t !== "Final")].slice(0, 48);
			return {
				...state,
				liveGame: finished
			};
		}
	}
	let parked2Half = live.parked2Half;
	if (clock > 0) {
		const youHome = live.homeId === state.playerTeamId;
		const nextYou = (poss === "home") === youHome;
		const youNow = youHome ? homeScore : awayScore;
		const oppNow = youHome ? awayScore : homeScore;
		const leadNow = youNow - oppNow;
		const inTwo = clock >= TWO_FOR_LO && clock <= TWO_FOR_HI;
		const crossedTwo = live.clock > TWO_FOR_HI && clock < TWO_FOR_LO;
		const justParked12 = parked12 && clock <= 12 && live.clock > 12;
		if (!justParked12 && live.lateChoice !== "twofor" && nextYou && leadNow >= 0 && leadNow <= 8 && parked2Half !== half && (inTwo || crossedTwo)) {
			if (!inTwo) clock = 36;
			parked2Half = half;
			if (events[0] && events[0].kind !== "period") events[0] = { ...events[0], t: clockLabel(half, Math.max(0, clock)) };
		}
	}
	if (foulAlert) {
		const youHome = live.homeId === state.playerTeamId;
		const on = youHome ? homeOn : awayOn;
		const starter = (state.players.find((p) => p.id === foulAlert.id)?.mpg ?? 0) >= 22;
		if (!on?.includes(foulAlert.id) || !isFoulTrouble(half, Math.max(0, clock), foulAlert.fouls, starter)) foulAlert = null;
	}
	return {
		...state,
		liveGame: {
			...live,
			homeScore,
			awayScore,
			clock: Math.max(0, clock),
			half,
			poss,
			log: events,
			done: false,
			ticks: tick,
			htAdj: half !== live.half ? false : live.htAdj,
			homeLines,
			awayLines,
			homeOn,
			awayOn,
			foulAlert,
			timeoutBoost: 0,
			timeoutsHome: half === 3 && live.half === 2 ? (live.timeoutsHome ?? 4) + 1 : live.timeoutsHome,
			timeoutsAway: half === 3 && live.half === 2 ? (live.timeoutsAway ?? 4) + 1 : live.timeoutsAway,
			shots: (kind === "two" || kind === "three") && Number.isFinite(spot?.x)
				? [...(live.shots ?? []), { x: spot.x, y: spot.y, made: Boolean(made), three: kind === "three", home: live.poss === "home" }].slice(-120)
				: live.shots,
			lateChoice: null,
			parked12,
			parked2Half
		}
	};
}
function cpuOff(rng, userDef, lastDef) {
	const d = lastDef ?? userDef;
	if (d === "zone") return rng() < .55 ? "spread" : "floppy";
	if (d === "press") return rng() < .5 ? "push" : "motion";
	if (d === "pack") return rng() < .5 ? "spread" : "hammer";
	if (d === "trap") return rng() < .5 ? "motion" : "horns";
	if (d === "foul") return "delay";
	return pick(rng, [
		"motion",
		"pnr",
		"post",
		"iso",
		"spread",
		"push",
		"horns"
	]);
}
function cpuDef(rng, userOff, lastOff) {
	const o = lastOff ?? userOff;
	if (o === "post") return rng() < .6 ? "pack" : "sag";
	if (o === "spread" || o === "floppy") return rng() < .55 ? "pack" : "switch";
	if (o === "push") return rng() < .45 ? "press" : "man";
	if (o === "iso") return rng() < .4 ? "trap" : "pack";
	if (o === "delay") return rng() < .35 ? "foul" : "man";
	return pick(rng, [
		"man",
		"man",
		"zone",
		"press",
		"pack",
		"switch"
	]);
}
