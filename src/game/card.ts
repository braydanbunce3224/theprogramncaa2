import type { CardGrade, Expectations, GameState, SeasonCard } from "./types";
import { clamp } from "./rng";
import { TEAM_BY_ID } from "./teams";
import { promiseLine } from "./locker";
import { yourAwards } from "./awards";

function letterOf(score: number) {
  if (score >= 92) return "A";
  if (score >= 84) return "A-";
  if (score >= 78) return "B+";
  if (score >= 72) return "B";
  if (score >= 66) return "B-";
  if (score >= 60) return "C+";
  if (score >= 54) return "C";
  if (score >= 46) return "C-";
  if (score >= 38) return "D";
  return "F";
}

export function makeExpectations(state: GameState): Expectations {
  const t = state.teams[state.playerTeamId];
  const prestige = t?.prestige ?? TEAM_BY_ID[state.playerTeamId]?.prestige ?? 60;
  const rot = state.players.filter((p) => p.teamId === state.playerTeamId && !p.redshirt).sort((a, b) => b.ovr - a.ovr);
  const talent = rot.slice(0, 8).reduce((n, p) => n + p.ovr, 0) / Math.max(1, Math.min(8, rot.length));
  const wins = clamp(Math.round(7 + (prestige - 50) * 0.26 + (talent - 72) * 0.35), 6, 27);
  const ncaa = prestige >= 74 || wins >= 20 || talent >= 80;
  const note = `Projection, not the contract. This roster looks like a ${wins}-win team. ${ncaa ? "An NCAA bid is in range." : "An NCAA bid would be a bonus."}`;
  return { wins, ncaa, note };
}

function grade(label: string, score: number, note: string): CardGrade {
  return { label, letter: letterOf(score), note };
}

export function makeReportCard(state: GameState): SeasonCard {
  const you = state.teams[state.playerTeamId]!;
  const exp = state.expectations ?? makeExpectations(state);
  const sel = state.selection;
  const ncaa = Boolean(sel?.ncaa?.some((b) => b.teamId === you.id));
  const title = sel?.champ === you.id;
  const conf = sel?.confTourney === you.id || sel?.autos?.[you.conference] === you.id;

  const winScore = clamp(55 + (you.wins - exp.wins) * 6 + (you.losses === 0 ? 8 : 0), 20, 99);
  const postScore = title ? 99 : ncaa ? (exp.ncaa ? 86 : 94) : exp.ncaa ? 38 : 70;
  const grew = state.offseasonReport?.grew?.length ?? 0;
  const campJumps = state.camp?.jumps?.length ?? grew;
  const devScore = clamp(48 + campJumps * 6 + ((state.coachSkills?.development ?? 46) - 46) * 0.4, 28, 96);
  const promises = (state.promises ?? []).filter((p) => p.season === state.season);
  const kept = promises.filter((p) => p.kept === true).length;
  const broke = promises.filter((p) => p.kept === false).length;
  const lockerScore = promises.length ? clamp(70 + kept * 8 - broke * 16, 24, 96) : 68;
  const signed = state.recruits.filter((r) => r.committedTo === state.playerTeamId);
  const stars = signed.reduce((n, r) => n + r.stars, 0);
  const recScore = clamp(40 + stars * 4 + signed.length * 2, 28, 96);
  const heat = state.compliance?.heat ?? 0;
  const compScore = clamp(92 - heat * 1.4, 20, 96);
  const awards = yourAwards(state).length;
  const awardScore = clamp(50 + awards * 10, 50, 98);

  const grades = [
    grade("Wins", winScore, `${you.wins}-${you.losses} against a ${exp.wins}-win ask.`),
    grade("March", postScore, title ? "National champion." : ncaa ? "NCAA Tournament bid." : exp.ncaa ? "Missed the tournament." : "No bid expected."),
    grade("Development", devScore, campJumps ? `${campJumps} jump${campJumps === 1 ? "" : "s"} in camp.` : "No jumps."),
    grade("Locker room", lockerScore, promiseLine(state)),
    grade("Class", recScore, `${signed.length} signed · ${stars} stars in the class.`),
    grade("NCAA", compScore, heat ? `Compliance heat ${heat}.` : "No compliance issues."),
    grade("Awards", awardScore, awards ? `${awards} national honor${awards === 1 ? "" : "s"}.` : "Nobody on the lists."),
  ];

  const overallN = grades.reduce((n, g) => n + (g.letter.startsWith("A") ? 90 : g.letter.startsWith("B") ? 75 : g.letter.startsWith("C") ? 58 : g.letter.startsWith("D") ? 42 : 28), 0) / grades.length;
  const bump = conf ? 4 : 0;
  const overall = letterOf(overallN + bump + (title ? 8 : 0));
  const school = TEAM_BY_ID[you.id]?.name ?? "the program";
  const letter =
    overall.startsWith("A")
      ? `Great year at ${school}.`
      : overall.startsWith("B")
        ? `Solid year. The next one still has to be good.`
        : overall.startsWith("C")
          ? `Average year. The AD is going to want more.`
          : `Not good enough. They're going to look at other coaches.`;

  return {
    season: state.season,
    expectedWins: exp.wins,
    expectedNcaa: exp.ncaa,
    grades,
    overall,
    letter,
  };
}
