import { a as runLiveRest, c as mulberry32, i as newDynasty, l as TEAMS, n as beginLiveGame, o as lockGamePlan, r as lockSchedule, s as simContest } from "./routes-C3LqTYO7.js";
//#region src/game/audit.ts
function side(lines) {
	const g = (k) => lines.reduce((n, p) => n + (Number(p[k]) || 0), 0);
	const fga = g("fga");
	const tpa = g("tpa");
	const fta = g("fta");
	const to = g("to");
	const orb = Math.round(g("reb") * .28);
	return {
		pts: g("pts"),
		fg: fga ? g("fgm") / fga : 0,
		tpa,
		tp: tpa ? g("tpm") / tpa : 0,
		fta,
		ft: fta ? g("ftm") / fta : 0,
		ast: g("ast"),
		to,
		reb: g("reb"),
		stl: g("stl"),
		blk: g("blk"),
		pf: g("pf"),
		poss: Math.max(1, Math.round(fga - orb + to + .44 * fta))
	};
}
function line(rows, key) {
	const vals = rows.map((r) => r[key]);
	const avg = vals.reduce((n, v) => n + v, 0) / Math.max(1, vals.length);
	return {
		avg,
		sd: Math.sqrt(vals.reduce((n, v) => n + (v - avg) ** 2, 0) / Math.max(1, vals.length)),
		min: Math.min(...vals),
		max: Math.max(...vals)
	};
}
function summarize(rows, margins) {
	const stats = Object.fromEntries([
		"pts",
		"fg",
		"tpa",
		"tp",
		"fta",
		"ft",
		"ast",
		"to",
		"stl",
		"blk",
		"reb",
		"pf",
		"poss"
	].map((k) => [k, line(rows, k)]));
	const n = Math.max(1, margins.length);
	const margin = line(margins.map((m) => ({ pts: m })), "pts");
	const bucket = (lo, hi) => margins.filter((m) => m >= lo && m <= hi).length / n;
	return {
		n: rows.length,
		games: margins.length,
		stats: {
			...stats,
			margin
		},
		by10: margins.filter((m) => m >= 10).length / n,
		by20: margins.filter((m) => m >= 20).length / n,
		buckets: {
			close: bucket(1, 7),
			mid: bucket(8, 14),
			big: bucket(15, 19),
			blow: bucket(20, 200)
		}
	};
}
function auditGaps(live, sim) {
	const keys = [
		"pts",
		"fg",
		"tpa",
		"tp",
		"fta",
		"ft",
		"ast",
		"to",
		"stl",
		"blk",
		"reb",
		"pf",
		"poss",
		"margin"
	];
	const flags = [];
	for (const k of keys) {
		const a = live.stats[k].avg;
		const b = sim.stats[k].avg;
		const pct = k === "fg" || k === "tp" || k === "ft";
		const gap = Math.abs(a - b);
		if (pct ? gap >= .04 : gap >= Math.max(2.5, Math.abs(b) * .12)) flags.push(`${k} live ${pct ? (a * 100).toFixed(1) + "%" : a.toFixed(1)} vs sim ${pct ? (b * 100).toFixed(1) + "%" : b.toFixed(1)}`);
	}
	return flags;
}
function runAudit(n = 100) {
	const liveRows = [];
	const simRows = [];
	const liveMargins = [];
	const simMargins = [];
	for (let i = 0; i < n; i++) {
		const home = TEAMS[i % TEAMS.length].id;
		const away = TEAMS[(i * 17 + 5) % TEAMS.length].id;
		const id = home === away ? TEAMS[(i + 1) % TEAMS.length].id : home;
		const opp = away === id ? TEAMS[(i + 3) % TEAMS.length].id : away;
		let s = lockSchedule(newDynasty(id, 3e3 + i, {
			careerMode: true,
			identity: {
				first: "Pat",
				last: "Rivers",
				age: 40,
				almaMaterId: id
			}
		}));
		const slot = s.schedule.find((g) => g.homeId === s.playerTeamId || g.awayId === s.playerTeamId);
		s = {
			...s,
			phase: "regular",
			week: slot?.week ?? 1
		};
		let live = beginLiveGame(s);
		if (live && live.liveGame) {
			const L = runLiveRest(lockGamePlan(live)).liveGame;
			liveRows.push(side(L.homeLines ?? []), side(L.awayLines ?? []));
			liveMargins.push(Math.abs((L.homeScore ?? 0) - (L.awayScore ?? 0)));
		}
		const sim = simContest(s, id, opp, mulberry32(8e3 + i * 13), { site: "home" });
		simRows.push(side(sim.homeLines), side(sim.awayLines));
		simMargins.push(Math.abs(sim.homeScore - sim.awayScore));
	}
	return {
		live: summarize(liveRows, liveMargins),
		sim: summarize(simRows, simMargins)
	};
}
//#endregion
export { auditGaps, runAudit };
