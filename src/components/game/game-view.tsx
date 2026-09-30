import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { teamOf } from "@/game/teams";
import { clockLabel, crowdFill, liveYouOffense, offeredCalls, OFF_OPTS, DEF_OPTS } from "@/game/plays";
import { endgameMenu } from "@/game/liveControls";
import { boxTotals, madeLine, playedLines } from "@/game/box";
import { hangLine, mlLabel, spreadText } from "@/game/market";
import { gymName, gymOf } from "@/game/gym";
import { eraHasShotClock, rivalryLine, seriesVs, settingsOf, liveScout } from "@/game/engine";
import { honestWinPct } from "@/game/present";
import { playSfx } from "@/game/audio";
import { fatigueOf } from "@/game/program";
import { bindTap } from "@/lib/tap";
import { AppFrame } from "@/components/game/app-frame";
import { ncaaRoundLabel, NCAA_SHORT, siteWord } from "@/game/brand";
import type { DefPlay, GameSlot, GameState, LiveEvent, LiveGame, NcaaBid, OffPlay, RecapPlayer } from "@/game/types";

export function GameView() {
  const { state, runCall, runLate, simRest, simToEnd, leaveGame, lockPlan, takeTimeout, sitTrouble } = useGame();
  const live = state?.liveGame ?? undefined;
  const crowd = state && live ? crowdFill(state, live) : { home: 0.5, away: 0.2, packed: false, split: false };
  const heard = useRef("");
  const [bench, setBench] = useState(false);
  const [tightLog, setTightLog] = useState(false);

  useEffect(() => {
    if (!state || !live || !settingsOf(state).soundOn) return;
    const ev = live.log.find((e) => e.kind && e.kind !== "period") ?? live.log[0];
    const key = `${live.homeScore}-${live.awayScore}-${ev?.t}-${ev?.kind}-${ev?.made}`;
    if (!ev || key === heard.current) {
      if (live.done && heard.current !== "final") {
        heard.current = "final";
        playSfx("buzzer");
      }
      return;
    }
    heard.current = key;
    if (live.done) playSfx("buzzer");
    else if (ev.kind === "period" && /timeout/i.test(ev.text ?? "")) playSfx("timeout");
    else if (ev.kind === "three" || ev.kind === "two") playSfx(ev.made ? "swish" : "miss");
    else if (ev.kind === "to") playSfx("whistle");
  }, [state, live]);

  if (!state || !live) {
    return (
      <AppFrame>
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16">
        <p className="font-display text-3xl">Game's over</p>
        <button type="button" className="min-h-12 rounded-lg bg-accent px-6 font-semibold text-accent-fg" {...bindTap(leaveGame)}>
          Gym
        </button>
      </div>
      </AppFrame>
    );
  }
  const home = teamOf(live.homeId);
  const away = teamOf(live.awayId);
  const youHome = live.homeId === state.playerTeamId;
  const slot = state.schedule.find((g) => g.id === live.slotId);
  const bids = state.selection?.ncaa ?? [];
  const youOff = liveYouOffense(state);
  const last = live.log.find((e) => e.kind && e.kind !== "period") ?? live.log[0];
  const ht = live.half === 1 && live.clock <= 0 && !live.done;
  const calls = offeredCalls(state);

  if (!live.planned && !live.done) {
    return (
      <AppFrame
        footer={
          <div className="border-t border-border px-4 py-3" style={{ paddingBottom: "calc(0.75rem + var(--dock-pad))" }}>
            <button type="button" data-tip-off="1" className="min-h-12 w-full rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(lockPlan)}>
              Start game
            </button>
            <p className="mt-2 text-center text-xs text-muted">Then tap a play for each possession.</p>
            <button type="button" className="mt-2 min-h-11 w-full text-sm text-muted" {...bindTap(simRest)}>
              Sim rest of game
            </button>
            <button type="button" className="mt-1 min-h-11 w-full text-sm text-muted" {...bindTap(leaveGame)}>
              Back to gym
            </button>
          </div>
        }
      >
        <Pregame state={state} live={live} />
      </AppFrame>
    );
  }

  return (
    <AppFrame
      footer={
        live.done ? (
          <div className="px-4 py-3" style={{ paddingBottom: "calc(0.75rem + var(--dock-pad))" }}>
            <p className="font-display text-2xl">Final</p>
            <button type="button" className="mt-3 min-h-12 w-full rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(leaveGame)}>
              Read recap
            </button>
          </div>
        ) : (
          <div className="live-dock border-t border-border px-4 py-3" style={{ paddingBottom: "calc(0.75rem + var(--dock-pad))" }}>
            {live.foulAlert && (
              <p className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span>Foul trouble. {live.foulAlert.name} has {live.foulAlert.fouls} fouls.</span>
                <button type="button" className="min-h-11 shrink-0 rounded-lg bg-elevated px-3 text-sm font-semibold" {...bindTap(sitTrouble)}>
                  Substitute
                </button>
              </p>
            )}
            <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">
              {ht ? "Halftime" : youOff ? "Your ball" : "Their ball"}
            </p>
            <p className="text-sm">
              {ht
                ? "Change the plan if you want, then tap a play to start the half."
                : youOff
                  ? "Tap one play. That runs the next line of the play-by-play."
                  : "Tap a defense. Their trip shows up in the play-by-play."}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {calls.map((c) => (
                <button
                  key={String(c.id)}
                  type="button"
                  {...bindTap(() => runCall(c.side, c.id))}
                  className="min-h-14 rounded-xl border border-border bg-accent px-3 py-3 text-left text-sm font-semibold text-accent-fg"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <EndgameBar state={state} />
            <details className="live-more mt-2">
              <summary>Timeouts, sim, pace</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="min-h-11 rounded-lg bg-elevated text-sm font-semibold" {...bindTap(takeTimeout)}>
                  Timeout · {youHome ? live.timeoutsHome ?? 4 : live.timeoutsAway ?? 4}
                </button>
                <button type="button" className={`min-h-11 rounded-lg text-sm font-semibold ${bench ? "bg-accent text-accent-fg" : "bg-elevated"}`} {...bindTap(() => setBench((v) => !v))}>
                  Bench
                </button>
                <button type="button" className="min-h-11 text-sm text-muted" {...bindTap(simRest)}>
                  Sim rest
                </button>
                <button type="button" className="min-h-11 text-sm text-muted" {...bindTap(simToEnd)}>
                  Sim to end
                </button>
              </div>
              <div className="mt-2">
                <LiveTools live={live} />
              </div>
            </details>
          </div>
        )
      }
    >
      <div className="px-4 pt-6 pb-4">
      <div className="mx-auto flex w-full max-w-lg flex-col md:max-w-2xl">
        <GymBoard live={live} home={home} away={away} youHome={youHome} slot={slot} bids={bids} wp={honestWinPct(live, youHome)} site={siteWord(slot, state.playerTeamId)} />
        {!live.done && <FloorStrip state={state} live={live} />}
        {!live.done && (
          <div className="momentum" aria-hidden>
            <i style={{ width: `${Math.round(runHeat(live.log) * 100)}%` }} />
          </div>
        )}
        {!live.done && (
          <p className="mt-2 text-center text-xs text-muted">
            {eraHasShotClock(state.eraDecade) ? "30-second clock" : "No shot clock"}
          </p>
        )}

        <Gamecast
          live={live}
          homeColor={home.color}
          awayColor={away.color}
          homeAbbr={home.abbr}
          crowd={crowd}
        />

        {last && (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">Play-by-play</p>
              <button type="button" className="min-h-11 px-2 text-xs font-semibold text-accent" {...bindTap(() => setTightLog((v) => !v))}>
                {tightLog ? "Full" : "Tight"}
              </button>
            </div>
            {!live.done && (
              <p className="text-sm text-muted">This feed moves when you tap a play at the bottom.</p>
            )}
            <p className="text-sm leading-relaxed">
              <span className="text-xs text-muted" aria-hidden="true">{last.t} · </span>
              {cleanPlay(last.text)}
            </p>
            {last.impact && (
              <p className={`mt-2 text-sm font-semibold ${(last.pts ?? 0) > 0 ? "text-win" : "text-loss"}`}>
                {last.impact}
              </p>
            )}
            <p className="mt-1 text-xs tracking-[0.12em] text-subtle uppercase">{paCall(last)}</p>
          </div>
        )}

        <ul className={`mt-4 space-y-2 text-xs text-muted ${tightLog ? "pbp-tight" : ""}`}>
          {dedupedLog(live.log, last).slice(0, tightLog ? 4 : 10).map((e, i) => (
            <li key={`${e.t}-${i}`}>
              <span className="text-subtle" aria-hidden="true">{e.t} · </span>
              {cleanPlay(e.text)}
            </li>
          ))}
        </ul>
        <LiveBox home={live.homeLines} away={live.awayLines} homeName={home.abbr} awayName={away.abbr} final={live.done} />
        {bench && !live.done && <BenchPad state={state} live={live} />}
      </div>
      </div>
    </AppFrame>
  );
}

function Pregame({ state, live }: { state: GameState; live: LiveGame }) {
  const { setPlan, lockPlan } = useGame();
  const home = teamOf(live.homeId);
  const away = teamOf(live.awayId);
  const ht = state.teams[live.homeId];
  const at = state.teams[live.awayId];
  const slot = state.schedule.find((g) => g.id === live.slotId);
  const bids = state.selection?.ncaa ?? [];
  const line = slot ? hangLine(state, slot) : null;
  const youHome = live.homeId === state.playerTeamId;
  const series = seriesVs(state, live.homeId, live.awayId);
  const off = (live.planOff ?? state.gamePlan?.off ?? ["motion", "pnr", "spread"]) as OffPlay[];
  const def = (live.planDef ?? state.gamePlan?.def ?? ["man", "pack"]) as DefPlay[];
  const crowd = crowdFill(state, live);
  const place = gymOf(state, live.homeId);
  const gym = gymName(live.homeId);
  const streakBit = place
    ? place.streak > 0
      ? ` · W${place.streak}`
      : place.streak < 0
        ? ` · L${Math.abs(place.streak)}`
        : ""
    : "";

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="mx-auto flex w-full max-w-lg flex-col">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">
          {slot?.kind === "ncaa"
            ? [NCAA_SHORT, bids.find((b) => b.teamId === live.homeId)?.region, ncaaRoundLabel(slot.id)].filter(Boolean).join(" · ")
            : "Before tip"}
        </p>
        <h1 className="font-display mt-1 text-3xl">
          {slot?.kind === "ncaa" || siteWord(slot, state.playerTeamId) === "Neutral"
            ? `${seedMark(bids, away.id)}${away.abbr} vs ${seedMark(bids, home.id)}${home.abbr}`
            : `${away.abbr} at ${home.abbr}`}
        </h1>
        <div className="mt-4 rounded-xl border border-border bg-elevated p-3">
          <p className="text-xs tracking-[0.16em] text-muted uppercase">How to play</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm">
            <li>Leave the plan below, or change it.</li>
            <li>Tap Start game.</li>
            <li>Every possession, tap a play. The play-by-play runs that trip.</li>
          </ol>
          <button type="button" className="mt-3 min-h-12 w-full rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(lockPlan)}>
            Start game
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          {siteWord(slot, state.playerTeamId)} · {ht ? `${ht.wins}-${ht.losses}` : "—"} · {at ? `${at.wins}-${at.losses}` : "—"}
          {line ? ` · ${spreadText(line.homeSpread, home.abbr, away.abbr)} · O/U ${line.total} · ${youHome ? mlLabel(line.mlHome) : mlLabel(line.mlAway)}` : ""}
        </p>
        {series && (
          <p className="mt-1 text-xs text-muted">
            All-time {series.aWins}-{series.bWins}
            {series.last ? ` · last ${series.last}` : ""}
            {series.streak > 1 ? ` · ${home.abbr} ${series.streak} in a row` : series.streak < -1 ? ` · ${away.abbr} ${Math.abs(series.streak)} in a row` : ""}
          </p>
        )}
        {rivalryLine(state, live.homeId, live.awayId) && (
          <p className="mt-1 text-xs font-semibold text-accent">{rivalryLine(state, live.homeId, live.awayId)}</p>
        )}
        <p className="mt-2 text-xs text-muted">
          {crowd.split ? "Split crowd" : crowd.packed ? `${gym} is packed` : gym}
          {place ? ` · #${place.rank} gym · +${place.hca.toFixed(1)} HCA${streakBit}` : ` · ${Math.round(crowd.home * 100)}% house`}
        </p>

        <p className="mt-5 text-xs tracking-[0.16em] text-muted uppercase">Offense · 1st / 2nd / 3rd look</p>
        <div className="mt-2 flex flex-col gap-2">
          {off.slice(0, 3).map((id, i) => (
            <PlanRow
              key={`off-${i}`}
              label={i === 0 ? "1st" : i === 1 ? "2nd" : "3rd"}
              value={OFF_OPTS.find((o) => o.id === id)?.label ?? id}
              options={OFF_OPTS}
              onPick={(next) => setPlan("off", i, next)}
            />
          ))}
        </div>
        <p className="mt-5 text-xs tracking-[0.16em] text-muted uppercase">Defense · primary / change</p>
        <div className="mt-2 flex flex-col gap-2">
          {def.slice(0, 2).map((id, i) => (
            <PlanRow
              key={`def-${i}`}
              label={i === 0 ? "Base" : "Change"}
              value={DEF_OPTS.find((o) => o.id === id)?.label ?? id}
              options={DEF_OPTS.filter((o) => o.id !== "foul")}
              onPick={(next) => setPlan("def", i, next)}
            />
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          {youHome ? "Home floor. Start game when the plan looks right." : "Road gym. Start game when the plan looks right."}
        </p>
        <PregameScout />
      </div>
    </div>
  );
}

function PregameScout() {
  const { state, scoutOpp } = useGame();
  if (!state) return null;
  const card = liveScout(state);
  return (
    <div className="mt-5 rounded-xl border border-border bg-elevated p-3">
      <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Scout</p>
      {card ? (
        <>
          <p className="mt-1 font-semibold">{card.identity} · {card.pace}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {card.keys.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </>
      ) : (
        <button type="button" className="mt-2 min-h-11 w-full rounded-lg bg-bg text-sm font-semibold" {...bindTap(scoutOpp)}>
          Spend an hour to scout them
        </button>
      )}
    </div>
  );
}

function paCall(e: LiveEvent) {
  if (e.kind === "three" && e.made) return "From downtown.";
  if (e.kind === "three") return "No good from three.";
  if (e.kind === "two" && e.made) return "Got it.";
  if (e.kind === "two") return "Off the iron.";
  if (e.kind === "ft" && e.made) return "Front end is good.";
  if (e.kind === "ft") return "Missed the free throw.";
  if (e.kind === "to") return "Turnover.";
  return "";
}

function PlanRow<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string;
  options: { id: T; label: string }[];
  onPick: (id: T) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated p-3">
      <p className="text-[11px] tracking-widest text-muted uppercase">{label} · {value}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`min-h-10 rounded-lg px-2 text-xs font-semibold ${o.label === value ? "bg-accent text-accent-fg" : "bg-bg"}`}
            {...bindTap(() => onPick(o.id))}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function periodBits(half: number, clock: number) {
  const raw = clockLabel(half, clock);
  const [per, time] = raw.split(" ");
  const pretty = per === "H1" ? "1ST" : per === "H2" ? "2ND" : per ?? "1ST";
  return { pretty, time: time ?? "0:00" };
}

function cleanPlay(text: string | undefined) {
  return (text ?? "").replace(/\bassists himself\b/gi, "scores").replace(/\s+/g, " ").trim();
}

function dedupedLog(log: LiveEvent[], last?: LiveEvent) {
  const out: LiveEvent[] = [];
  let prev = cleanPlay(last?.text);
  for (const e of log) {
    if (e === last) continue;
    const text = cleanPlay(e.text);
    if (!text || text === prev) continue;
    prev = text;
    out.push(e);
  }
  return out;
}

function lateChip(id: LiveGame["lateChoice"]) {
  if (id === "twofor") return "2-for-1";
  if (id === "foul3") return "Foul up 3";
  if (id === "letplay") return "Don't foul";
  return "";
}

function seedMark(bids: NcaaBid[], teamId: string) {
  const b = bids.find((x) => x.teamId === teamId);
  return b ? `(${b.seed}) ` : "";
}

function tvRail(slot: GameSlot | undefined, bids: NcaaBid[]) {
  if (!slot) return null;
  if (slot.kind === "ncaa") {
    const region = bids.find((b) => b.teamId === slot.homeId)?.region;
    return [NCAA_SHORT, region, ncaaRoundLabel(slot.id)].filter(Boolean).join(" · ");
  }
  if (slot.kind === "nit") return ncaaRoundLabel(slot.id);
  if (slot.kind === "crown") return ncaaRoundLabel(slot.id);
  if (slot.kind === "conf-tourney") return "Conference tournament";
  return null;
}

function GymBoard({
  live,
  home,
  away,
  youHome,
  slot,
  bids,
  wp,
  site,
}: {
  live: LiveGame;
  home: ReturnType<typeof teamOf>;
  away: ReturnType<typeof teamOf>;
  youHome: boolean;
  slot?: GameSlot;
  bids: NcaaBid[];
  wp: number;
  site: "Home" | "Away" | "Neutral";
}) {
  const { pretty, time } = periodBits(live.half, live.clock);
  const hb = bids.find((b) => b.teamId === live.homeId);
  const ab = bids.find((b) => b.teamId === live.awayId);
  const ncaa = slot?.kind === "ncaa";
  const rail = tvRail(slot, bids);
  const youBall = (live.poss === "home") === youHome;
  const plan = OFF_OPTS.find((o) => o.id === live.offCall)?.label ?? live.offCall;
  const tactic = lateChip(live.lateChoice);
  const homeFouls = (live.homeLines ?? []).reduce((s, r) => s + (r.pf ?? 0), 0);
  const awayFouls = (live.awayLines ?? []).reduce((s, r) => s + (r.pf ?? 0), 0);
  return (
    <div className="gym-sticky">
      <div className={`gym-board${ncaa ? " is-ncaa" : ""}`} role="group" aria-label={live.done ? `Final. ${home.name} ${live.homeScore}, ${away.name} ${live.awayScore}` : undefined}>
        <div className={`gym-side ${youHome ? "is-you" : ""}`}>
          <p className="gym-tag">{ncaa && hb ? `${hb.seed}` : home.abbr}</p>
          <p className="gym-abbr">{home.abbr}</p>
          {live.done && <p className="gym-tag">{home.name}</p>}
          <p className="gym-score">{live.homeScore}</p>
          {live.poss === "home" && !live.done && <span className="gym-ball" aria-label="Has the ball" />}
        </div>
        <div className="gym-mid">
          <p className="gym-period">{live.done ? "Final" : pretty}</p>
          {!live.done && (
            <p className="gym-clock" aria-live="polite" aria-atomic="true">
              {time}
            </p>
          )}
        </div>
        <div className={`gym-side ${youHome ? "" : "is-you"}`}>
          <p className="gym-tag">{ncaa && ab ? `${ab.seed}` : away.abbr}</p>
          <p className="gym-abbr">{away.abbr}</p>
          {live.done && <p className="gym-tag">{away.name}</p>}
          <p className="gym-score">{live.awayScore}</p>
          {live.poss === "away" && !live.done && <span className="gym-ball" aria-label="Has the ball" />}
        </div>
      </div>
      {!live.done && (
        <p className="gym-meta">
          <span>{site}</span>
          <span>{youBall ? "Your ball" : "Their ball"}</span>
          <span className="gym-wp" aria-label={`Win probability ${wp} percent`}>{wp}% win</span>
          <span>T/O {live.timeoutsHome ?? 4}–{live.timeoutsAway ?? 4}</span>
          {(homeFouls + awayFouls) > 0 && <span>Fouls {homeFouls}–{awayFouls}</span>}
        </p>
      )}
      {!live.done && (
        <div className="bug-chips">
          <span className="bug-chip">{youBall ? "Ball" : "Defense"} · {plan}</span>
          {tactic && <span className="bug-chip is-hot">{tactic}</span>}
          {live.defCall === "foul" && !tactic && <span className="bug-chip is-hot">Foul</span>}
        </div>
      )}
      {live.sandbox && <p className="gym-test">Test game — not counted.</p>}
      {live.done && (
        <p className="gym-rail">{away.name} {live.awayScore}, {home.name} {live.homeScore} · Final · {site}</p>
      )}
      {rail && <p className="gym-rail">{rail}</p>}
    </div>
  );
}

function runHeat(log: LiveEvent[]): number {
  let pts = 0;
  for (const e of log) {
    if (!e.kind || e.kind === "period") continue;
    const scored = Boolean(e.made) && (e.pts ?? 0) > 0;
    if (e.poss === "away" && scored) break;
    if (e.poss === "home" && scored) pts += e.pts ?? 0;
  }
  if (pts <= 0) return 0;
  if (pts <= 4) return 0.18;
  if (pts <= 7) return 0.4;
  if (pts <= 11) return 0.68;
  if (pts <= 15) return 0.88;
  return 1;
}

function Gamecast({
  live,
  homeColor,
  awayColor,
  homeAbbr,
  crowd,
}: {
  live: LiveGame;
  homeColor: string;
  awayColor: string;
  homeAbbr: string;
  crowd: { home: number; away: number; packed: boolean; split: boolean };
}) {
  const marks: LiveEvent[] = (live.shots?.length
    ? live.shots.map((s, i) => ({
        t: String(i),
        text: "",
        homeScore: live.homeScore,
        awayScore: live.awayScore,
        kind: (s.three ? "three" : "two") as LiveEvent["kind"],
        made: s.made,
        x: s.x,
        y: s.y,
        poss: (s.home ? "home" : "away") as LiveEvent["poss"],
      }))
    : live.log.filter((e) => e.kind && e.kind !== "period" && e.x != null && e.y != null)
  ).slice(-18);
  const last = marks[marks.length - 1];
  const heat = runHeat(live.log);
  const house = heat >= 0.68
    ? "The building is up"
    : crowd.split
      ? "Split crowd"
      : crowd.packed
        ? "Packed house"
        : "Gamecast";
  return (
    <div className="gamecast">
      <svg viewBox="0 0 94 56" className="gamecast-floor" role="img" aria-label="Gamecast floor">
        <rect width="94" height="50" fill="var(--color-court)" />
        <rect x="1" y="1" width="92" height="48" fill="none" stroke="var(--color-lane)" strokeWidth="0.45" />
        <line x1="47" y1="1" x2="47" y2="49" stroke="var(--color-lane)" strokeWidth="0.35" />
        <circle cx="47" cy="25" r="6" fill="none" stroke="var(--color-lane)" strokeWidth="0.35" />
        <circle cx="47" cy="25" r="3.6" fill={homeColor} opacity="0.35" />
        <text x="47" y="26.4" textAnchor="middle" fontSize="2.4" fill="var(--color-lane)" fontFamily="Palatino, serif" fontWeight="700">
          {homeAbbr.slice(0, 4)}
        </text>
        <Key x={0} />
        <Key x={75} />
        <Arc cx={5.25} right={false} />
        <Arc cx={88.75} right />
        <Hoop cx={5.25} />
        <Hoop cx={88.75} />
        {marks.slice().reverse().map((e, i) => (
          <Mark key={`${e.t}-${i}`} e={e} homeColor={homeColor} awayColor={awayColor} dim={e !== last} />
        ))}
        <Crowd y={50.4} fill={Math.min(1, crowd.home + heat * 0.18)} color={homeColor} side="left" />
        <Crowd y={50.4} fill={crowd.away} color={awayColor} side="right" />
      </svg>
      <div className="gamecast-bar">
        <span data-crowd-heat={heat.toFixed(2)}>{house}</span>
        <span>
          {last?.kind === "three" ? "3PT" : last?.kind === "two" ? "2PT" : last?.kind === "ft" ? "FT" : last?.kind === "to" ? "TO" : "LIVE"}
          {last && last.kind !== "period" ? (last.made ? " · good" : last.kind === "to" ? "" : " · miss") : ""}
        </span>
      </div>
    </div>
  );
}

function Crowd({ y, fill, color, side }: { y: number; fill: number; color: string; side: "left" | "right" }) {
  const n = 18;
  const dots = Array.from({ length: n }, (_, i) => i);
  const lit = Math.round(n * fill);
  const start = side === "left" ? 3 : 49;
  return (
    <g>
      {dots.map((i) => (
        <rect
          key={`${side}-${i}`}
          x={start + i * 2.3}
          y={y}
          width="1.8"
          height="4.2"
          rx="0.3"
          fill={i < lit ? color : "rgba(242,241,236,0.12)"}
          opacity={i < lit ? 0.85 : 0.35}
        />
      ))}
    </g>
  );
}

function Key({ x }: { x: number }) {
  return (
    <g>
      <rect x={x + 1} y="16" width="18" height="18" fill="none" stroke="var(--color-lane)" strokeWidth="0.35" />
      <circle cx={x + 19} cy="25" r="6" fill="none" stroke="var(--color-lane)" strokeWidth="0.3" />
    </g>
  );
}

function Arc({ cx, right }: { cx: number; right: boolean }) {
  const s = right ? 1 : -1;
  return (
    <path
      d={`M ${cx + s * 3} 3.2 L ${cx + s * 3} 8 A 22.15 22.15 0 0 ${right ? 1 : 0} ${cx + s * 3} 42 L ${cx + s * 3} 46.8`}
      fill="none"
      stroke="var(--color-lane)"
      strokeWidth="0.3"
    />
  );
}

function Hoop({ cx }: { cx: number }) {
  return (
    <g>
      <line x1={cx < 47 ? 1 : 93} y1="17" x2={cx < 47 ? 1 : 93} y2="33" stroke="var(--color-lane)" strokeWidth="0.5" />
      <circle cx={cx} cy="25" r="0.9" fill="none" stroke="var(--color-gold)" strokeWidth="0.4" />
    </g>
  );
}

function Mark({ e, homeColor, awayColor, dim }: { e: LiveEvent; homeColor: string; awayColor: string; dim: boolean }) {
  const fill = e.poss === "away" ? awayColor : homeColor;
  const r = e.kind === "three" ? 1.35 : 1.1;
  if (e.kind === "to") {
    return (
      <g opacity={dim ? 0.35 : 1} transform={`translate(${e.x}, ${e.y})`}>
        <line x1={-1.2} y1={-1.2} x2={1.2} y2={1.2} stroke="#c48982" strokeWidth="0.45" />
        <line x1={1.2} y1={-1.2} x2={-1.2} y2={1.2} stroke="#c48982" strokeWidth="0.45" />
      </g>
    );
  }
  return (
    <circle
      cx={e.x}
      cy={e.y}
      r={r}
      fill={e.made ? fill : "none"}
      stroke={fill}
      strokeWidth="0.45"
      opacity={dim ? 0.4 : 1}
    />
  );
}

function EndgameBar({ state }: { state: GameState }) {
  const { runCall, runLate } = useGame();
  const items = endgameMenu(state);
  if (!items.length) return null;
  return (
    <div className="endgame-bar mt-3 rounded-xl border border-border bg-elevated p-3" role="group" aria-label="End of game">
      <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Finish</p>
      <div className="endgame-grid mt-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-late={item.id}
            className="min-h-11 w-full rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg"
            {...bindTap(() => {
              if (item.id === "twofor") runLate("twofor");
              else if (item.id === "letplay") runLate("letplay");
              else if (item.id === "foul3") runLate("foul3");
              else if (item.id === "hold") runCall("off", "delay");
              else runCall("def", "foul");
            })}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function liveLegs(season: number, minutes: number, half: number): "fresh" | "winded" | "tired" {
  const fromMinutes = minutes >= 28 ? 70 : half >= 2 && minutes >= 16 ? 50 : minutes >= 24 ? 45 : 0;
  const fat = Math.max(season, fromMinutes);
  if (fat > 60) return "tired";
  if (fat > 35) return "winded";
  return "fresh";
}

function FloorStrip({ state, live }: { state: GameState; live: LiveGame }) {
  const { subPlayer } = useGame();
  const you = state.playerTeamId;
  const home = live.homeId === you;
  if (!home && live.awayId !== you) return null;
  const lines = home ? live.homeLines : live.awayLines;
  const pinned = home ? live.homeOn : live.awayOn;
  const roster = state.players.filter((p) => p.teamId === you && !(p.injury && p.injury.weeksLeft > 0)).sort((a, b) => b.mpg - a.mpg);
  const seeded = pinned && pinned.length >= 5 ? pinned : roster.slice(0, 5).map((p) => p.id);
  const onIds: string[] = [];
  for (const id of seeded) {
    if ((lines?.find((l) => l.id === id)?.pf ?? 0) >= 5) continue;
    if (!onIds.includes(id)) onIds.push(id);
  }
  for (const p of roster) {
    if (onIds.length >= 5) break;
    if (onIds.includes(p.id)) continue;
    if ((lines?.find((l) => l.id === p.id)?.pf ?? 0) >= 5) continue;
    onIds.push(p.id);
  }
  const on = onIds.map((id) => roster.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const usages = on.map((p) => p.usage ?? 0);
  const showUse = usages.some((u) => u > 0) && new Set(usages).size > 1;
  return (
    <div className="mt-3">
      <p className="text-[11px] tracking-[0.16em] text-muted uppercase">On the floor · tap to sub · fouls</p>
      <div className="live-strip mt-1">
        {on.map((p) => {
          const fouls = lines?.find((l) => l.id === p.id)?.pf ?? 0;
          const played = lines?.find((l) => l.id === p.id)?.min ?? 0;
          const legs = liveLegs(fatigueOf(state, p.id), played, live.half);
          const hot = (live.half === 1 && fouls >= 2) || (live.half >= 2 && fouls >= 4);
          return (
            <button key={p.id} type="button" className={hot ? "is-on" : ""} {...bindTap(() => subPlayer(p.id))}>
              {p.last} · {fouls}F · {legs}{showUse && (p.usage ?? 0) > 0 ? ` · ${p.usage}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LiveTools({ live }: { live: LiveGame }) {
  const { setPace, setLook } = useGame();
  const pace = live.pace ?? "normal";
  const looks: OffPlay[] = ["motion", "pnr", "post", "spread", "iso", "push"];
  const label = (id: OffPlay) => OFF_OPTS.find((o) => o.id === id)?.label ?? id;
  return (
    <div>
      <div className="live-strip" role="group" aria-label="Pace">
        {(["slow", "normal", "fast"] as const).map((p) => (
          <button key={p} type="button" className={pace === p ? "is-on" : ""} {...bindTap(() => setPace(p))}>
            {p === "slow" ? "Slow down" : p === "fast" ? "Speed up" : "Normal"}
          </button>
        ))}
      </div>
      <div className="live-strip mt-1" role="group" aria-label="Offense">
        {looks.map((id) => (
          <button key={id} type="button" className={live.offCall === id ? "is-on" : ""} {...bindTap(() => setLook(id))}>
            {label(id)}
          </button>
        ))}
      </div>
    </div>
  );
}

function BenchPad({ state, live }: { state: GameState; live: LiveGame }) {
  const { subPlayer } = useGame();
  const you = state.playerTeamId;
  const home = live.homeId === you;
  const lines = home ? live.homeLines : live.awayLines;
  const pinned = home ? live.homeOn : live.awayOn;
  const roster = state.players
    .filter((p) => p.teamId === you && !(p.injury && p.injury.weeksLeft > 0))
    .sort((a, b) => b.mpg - a.mpg);
  const on = new Set((pinned && pinned.length >= 5 ? pinned : roster.slice(0, 5).map((p) => p.id)));
  return (
    <div className="mt-4 rounded-xl border border-border bg-elevated p-3">
      <p className="text-[11px] tracking-[0.16em] text-muted uppercase">Your five · tap to sub</p>
      <ul className="mt-2 flex flex-col gap-1">
        {roster.map((p) => {
          const row = lines?.find((l) => l.id === p.id);
          const fat = fatigueOf(state, p.id);
          const played = row?.min ?? 0;
          const legs = liveLegs(fat, played, live.half);
          const fouls = row?.pf ?? 0;
          const inGame = on.has(p.id);
          return (
            <li key={p.id}>
              <button type="button" className="flex min-h-11 w-full items-center gap-2 text-left text-sm" {...bindTap(() => subPlayer(p.id))}>
                <span className={`w-10 text-[11px] font-semibold uppercase ${inGame ? "text-win" : "text-subtle"}`}>{inGame ? "In" : "Out"}</span>
                <span className="min-w-0 flex-1 truncate">{p.first} {p.last}</span>
                <span className="tabular-nums text-xs text-muted">{fouls} fouls</span>
                <span className="w-14 text-right text-xs text-muted">{legs}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LiveBox({
  home,
  away,
  homeName,
  awayName,
  final,
}: {
  home?: RecapPlayer[];
  away?: RecapPlayer[];
  homeName: string;
  awayName: string;
  final?: boolean;
}) {
  const h = playedLines(home);
  const a = playedLines(away);
  if (!h.length && !a.length) return null;
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      <MiniBox title={homeName} rows={h} final={final} />
      <MiniBox title={awayName} rows={a} final={final} />
    </div>
  );
}

function MiniBox({ title, rows, final }: { title: string; rows: RecapPlayer[]; final?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!rows.length) return null;
  const team = boxTotals(rows);
  const share = [`${title}${final ? " final" : ""}`, ...[...rows, team].map((p) => `${p.name}  ${p.pts} pts  ${p.reb} reb  ${p.ast} ast`)].join("\n");
  return (
    <div className="recap-box">
      <div className="flex items-center justify-between gap-2">
        <p className="recap-box-h">{title} · {final ? "Final" : "live"}</p>
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
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
            <th>TO</th>
            <th>STL</th>
            <th>BLK</th>
            <th>PF</th>
            <th>FG</th>
            <th>3P</th>
            <th>FT</th>
          </tr>
        </thead>
        <tbody>
          {[...rows, team].map((p) => (
            <tr key={p.id}>
              <td className="recap-name">{p.name}</td>
              <td data-k="PTS">{p.pts}</td>
              <td data-k="REB">{p.reb}</td>
              <td data-k="AST">{p.ast}</td>
              <td data-k="TO">{p.to ?? 0}</td>
              <td data-k="STL">{p.stl ?? 0}</td>
              <td data-k="BLK">{p.blk ?? 0}</td>
              <td data-k="PF">{p.pf ?? 0}</td>
              <td data-k="FG">{madeLine(p.fgm, p.fga)}</td>
              <td data-k="3P">{madeLine(p.tpm, p.tpa)}</td>
              <td data-k="FT">{madeLine(p.ftm, p.fta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
