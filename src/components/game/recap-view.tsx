import { useEffect, useState } from "react";
import { useGame } from "@/game/store";
import { boxTotals, madeLine, playedLines } from "@/game/box";
import { TEAM_BY_ID } from "@/game/teams";
import { recapFor, resultFor, yourGames, nextYourGame } from "@/game/engine";
import { bindTap } from "@/lib/tap";
import { ncaaRoundLabel, NCAA_SHORT, ncaaOutcome, confOutcome, siteWord } from "@/game/brand";
import { confAliveBefore } from "@/game/selection";
import type { GameResult, GameState, RecapPlayer, ShotMark } from "@/game/types";

function Board({ result, homeSeed, awaySeed }: { result: GameResult; homeSeed?: number; awaySeed?: number }) {
  const home = TEAM_BY_ID[result.homeId];
  const away = TEAM_BY_ID[result.awayId];
  const homeWin = result.homeScore > result.awayScore;
  return (
    <div className="recap-board">
      <div className={`recap-side ${homeWin ? "is-win" : "is-loss"}`}>
        <span className="recap-dot" style={{ background: home?.color }} />
        <div className="min-w-0">
          <p className="recap-school">{homeSeed != null ? `(${homeSeed}) ` : ""}{home?.name ?? result.homeId}</p>
          <p className="recap-mascot">{home?.mascot}</p>
        </div>
        <p className="recap-pts">{result.homeScore}</p>
      </div>
      <div className={`recap-side ${homeWin ? "is-loss" : "is-win"}`}>
        <span className="recap-dot" style={{ background: away?.color }} />
        <div className="min-w-0">
          <p className="recap-school">{awaySeed != null ? `(${awaySeed}) ` : ""}{away?.name ?? result.awayId}</p>
          <p className="recap-mascot">{away?.mascot}</p>
        </div>
        <p className="recap-pts">{result.awayScore}</p>
      </div>
    </div>
  );
}

function Line({ p }: { p: RecapPlayer }) {
  const three = madeLine(p.tpm, p.tpa);
  const ft = madeLine(p.ftm, p.fta);
  return (
    <tr>
      <td className="recap-name">
        {p.id === "totals" ? null : <span className="recap-pos">{p.pos}</span>}
        {p.name}
      </td>
      <td data-k="MIN">{p.min}</td>
      <td data-k="PTS">{p.pts}</td>
      <td data-k="REB">{p.reb}</td>
      <td data-k="AST">{p.ast}</td>
      <td data-k="TO">{p.to ?? 0}</td>
      <td data-k="STL">{p.stl ?? 0}</td>
      <td data-k="BLK">{p.blk ?? 0}</td>
      <td data-k="PF">{p.pf ?? 0}</td>
      <td data-k="FG">{p.fgm}–{p.fga}</td>
      <td data-k="3P">{three}</td>
      <td data-k="FT">{ft}</td>
    </tr>
  );
}

function totals(rows: RecapPlayer[]) {
  return boxTotals(rows);
}

function Box({ title, color, rows }: { title: string; color?: string; rows: RecapPlayer[] }) {
  const shown = playedLines(rows);
  const team = totals(shown);
  const [copied, setCopied] = useState(false);
  const share = [`${title} final`, ...[...shown, team].map((p) => `${p.name}  ${p.pts} pts  ${p.reb} reb  ${p.ast} ast  ${madeLine(p.fgm, p.fga)} FG`)].join("\n");
  return (
    <div className="recap-box">
      <div className="flex items-center justify-between gap-2">
        <p className="recap-box-h">
          <span className="recap-dot" style={{ background: color }} />
          {title} · Final
        </p>
        <button
          type="button"
          className="min-h-11 shrink-0 px-2 text-xs font-semibold text-accent"
          {...bindTap(() => {
            void navigator.clipboard?.writeText(share).then(() => setCopied(true)).catch(() => setCopied(false));
          })}
        >
          {copied ? "Copied" : "Copy box"}
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th className="recap-name">Player</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
            <th>TO</th>
            <th>STL</th>
            <th>BLK</th>
            <th>PF</th>
            <th>FG</th>
            <th>3PT</th>
            <th>FT</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <Line key={p.id} p={p} />
          ))}
          <Line p={{ ...team, name: "TEAM" }} />
        </tbody>
      </table>
    </div>
  );
}

function RecapStrip({ state, result, recap }: { state: GameState; result: GameResult; recap: NonNullable<GameResult["recap"]> }) {
  const { closeRecap, setView } = useGame();
  const top = [...(recap.homeLeaders ?? []), ...(recap.awayLeaders ?? [])].sort((a, b) => b.pts - a.pts)[0];
  const next = nextYourGame(state);
  const oppId = next ? (next.homeId === state.playerTeamId ? next.awayId : next.homeId) : "";
  return (
    <div className="rounded-xl border border-border bg-elevated p-4">
      <p className="text-sm font-semibold">
        {TEAM_BY_ID[result.awayId]?.name} {result.awayScore}, {TEAM_BY_ID[result.homeId]?.name} {result.homeScore}
      </p>
      <p className="mt-1 text-sm text-muted">
        {TEAM_BY_ID[result.homeId]?.abbr} {recap.homePpp.toFixed(2)} PPP · {TEAM_BY_ID[result.awayId]?.abbr} {recap.awayPpp.toFixed(2)} PPP
      </p>
      {top && (
        <p className="mt-1 text-sm">
          {top.name} · {top.pts} pts
        </p>
      )}
      <button
        type="button"
        className="mt-3 min-h-11 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg"
        {...bindTap(() => {
          closeRecap();
          if (next) setView("hub");
        })}
      >
        {next && oppId ? `Next · ${TEAM_BY_ID[oppId]?.name ?? "the gym"}` : "Back to the gym"}
      </button>
    </div>
  );
}

function ShotChart({ shots, boxMade, boxAtt, home, away }: { shots: ShotMark[]; boxMade: number; boxAtt: number; home?: string; away?: string }) {
  const made = shots.filter((s) => s.made).length;
  const same = made === boxMade && shots.length === boxAtt;
  return (
    <div className="rounded-xl border border-border bg-elevated p-3">
      <p className="text-[11px] tracking-[0.16em] text-muted uppercase">
        {same
          ? `Shot chart · ${made}/${shots.length} from the floor`
          : `Plotted shots · ${made}/${shots.length}. Box is ${boxMade}–${boxAtt} from the floor.`}
      </p>
      <svg viewBox="0 0 94 50" className="mt-2 w-full" role="img" aria-label="Shot chart">
        <rect width="94" height="50" fill="var(--color-court)" />
        <rect x="1" y="1" width="92" height="48" fill="none" stroke="var(--color-lane)" strokeWidth="0.45" />
        <line x1="47" y1="1" x2="47" y2="49" stroke="var(--color-lane)" strokeWidth="0.35" />
        {shots.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.three ? 1.3 : 1.05}
            fill={s.made ? (s.home ? home ?? "#d4af5a" : away ?? "#c48982") : "none"}
            stroke={s.home ? home ?? "#d4af5a" : away ?? "#c48982"}
            strokeWidth="0.4"
            opacity={s.made ? 0.9 : 0.45}
          />
        ))}
      </svg>
    </div>
  );
}

export function RecapView() {
  const { state, recapId, closeRecap, openRecap } = useGame();
  const result = state
    ? state.results.find((r) => r.id === recapId) ?? [...state.results].reverse().find((r) => r.homeId === state.playerTeamId || r.awayId === state.playerTeamId)
    : undefined;
  const you = state?.playerTeamId;
  const youWin = Boolean(
    state && result && (result.homeId === you ? result.homeScore : result.awayScore) > (result.homeId === you ? result.awayScore : result.homeScore),
  );
  const slot = state && result ? state.schedule.find((g) => g.id === result.slotId) : undefined;
  const ncaaCall = slot?.kind === "ncaa" ? ncaaOutcome(slot.id, youWin) : null;
  const alive = state && slot?.kind === "conf-tourney" ? confAliveBefore(state, slot.id) : null;
  const confCall = alive != null ? confOutcome(alive, youWin) : null;
  const call = ncaaCall ?? confCall;
  const banner = call?.banner === "national" || call?.banner === "conference";
  const national = call?.banner === "national";
  const resultLabel = call?.label ?? (youWin ? "Win" : "Loss");
  useEffect(() => {
    if (!banner) return;
    try {
      navigator.vibrate?.([40, 40, 80, 40, 120]);
    } catch {
      /* no haptics */
    }
  }, [banner, result?.id]);

  if (!state) return null;
  if (!result) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl">Recap</h1>
        <p className="text-sm text-muted">No final yet. Sim or play a game first.</p>
        <button type="button" className="min-h-12 rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(closeRecap)}>
          Back
        </button>
      </div>
    );
  }
  const recap = recapFor(state, result);
  const archive = yourGames(state)
    .filter((g) => g.resultId)
    .sort((a, b) => b.week - a.week)
    .slice(0, 8);

  return (
    <div className="recap-sheet">
      {banner && <TitleBurst national={Boolean(national)} />}
      <p className="recap-kicker">
        {slot?.kind === "ncaa"
          ? [NCAA_SHORT, state.selection?.ncaa.find((b) => b.teamId === result.homeId)?.region, ncaaRoundLabel(slot.id), siteWord(slot, you ?? "")].filter(Boolean).join(" · ")
          : `${recap.played ? "Played" : "Simulated"} · Week ${result.week} · ${siteWord(slot, you ?? "")} · ${result.minutes ?? 40} min`}
      </p>
      <h1 className="recap-hed">{recap.headline}</h1>
      <p className="recap-lede">{recap.lede}</p>
      <Board
        result={result}
        homeSeed={state.selection?.ncaa.find((b) => b.teamId === result.homeId)?.seed}
        awaySeed={state.selection?.ncaa.find((b) => b.teamId === result.awayId)?.seed}
      />
      <p className={`recap-wl ${youWin ? "text-win" : "text-loss"}`}>
        {resultLabel}
      </p>
      <RecapStrip state={state} result={result} recap={recap} />

      <div className="recap-copy">
        {(recap.grafs ?? []).map((g, i) => (
          <p key={i}>{g}</p>
        ))}
      </div>

      <div className="recap-key">
        <p className="recap-kicker">Key sequence</p>
        <p>{recap.keyPlay}</p>
      </div>

      <div className="recap-factors">
        <div>
          <p className="recap-kicker">{TEAM_BY_ID[result.homeId]?.abbr ?? "Home"}</p>
          <p>
            {recap.homePpp.toFixed(2)} PPP · {recap.homeTo} TO · {recap.homeOrb} ORB
          </p>
        </div>
        <div>
          <p className="recap-kicker">{TEAM_BY_ID[result.awayId]?.abbr ?? "Away"}</p>
          <p>
            {recap.awayPpp.toFixed(2)} PPP · {recap.awayTo} TO · {recap.awayOrb} ORB
          </p>
        </div>
      </div>

      {recap.shots && recap.shots.length > 4 && (
        <ShotChart
          shots={recap.shots}
          boxMade={boxTotals(playedLines(recap.homeLeaders)).fgm + boxTotals(playedLines(recap.awayLeaders)).fgm}
          boxAtt={boxTotals(playedLines(recap.homeLeaders)).fga + boxTotals(playedLines(recap.awayLeaders)).fga}
          home={TEAM_BY_ID[result.homeId]?.color}
          away={TEAM_BY_ID[result.awayId]?.color}
        />
      )}

      <Box title={TEAM_BY_ID[result.homeId]?.name ?? "Home"} color={TEAM_BY_ID[result.homeId]?.color} rows={recap.homeLeaders} />
      <Box title={TEAM_BY_ID[result.awayId]?.name ?? "Away"} color={TEAM_BY_ID[result.awayId]?.color} rows={recap.awayLeaders} />

      {recap.notes.length > 0 && (
        <ul className="recap-notes">
          {recap.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {archive.length > 1 && (
        <div className="recap-archive">
          <p className="recap-kicker">This season</p>
          <div className="recap-archive-list">
            {archive.map((g) => {
              const r = resultFor(state, g);
              if (!r) return null;
              const oppId = g.homeId === state.playerTeamId ? g.awayId : g.homeId;
              const youScore = g.homeId === state.playerTeamId ? r.homeScore : r.awayScore;
              const oppScore = g.homeId === state.playerTeamId ? r.awayScore : r.homeScore;
              const on = r.id === result.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`recap-chip ${on ? "is-on" : ""}`}
                  {...bindTap(() => openRecap(r.id))}
                >
                  {youScore > oppScore ? "W" : "L"} {youScore}–{oppScore} {TEAM_BY_ID[oppId]?.abbr}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button type="button" className="recap-done" {...bindTap(closeRecap)}>
        Continue
      </button>
    </div>
  );
}

function TitleBurst({ national }: { national: boolean }) {
  const bits = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div className="title-burst" aria-hidden>
      {bits.map((i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 8) * 0.08}s`,
            background: i % 3 === 0 ? "var(--color-ap-gold)" : i % 3 === 1 ? "var(--color-win)" : "var(--color-accent)",
          }}
        />
      ))}
      <p className="title-burst-line">{national ? "National champions" : "Conference champions"}</p>
      <p className="title-burst-sub">{national ? "Cut the nets." : "Won the conference final."}</p>
    </div>
  );
}
