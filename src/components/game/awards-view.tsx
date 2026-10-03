import { useGame } from "@/game/store";
import { awardLine, awardRace } from "@/game/engine";
import { TEAM_BY_ID } from "@/game/teams";
import { bindTap } from "@/lib/tap";

export function AwardsView() {
  const { state, setView } = useGame();
  if (!state) return null;
  const all = (state.awards ?? []).slice().sort((a, b) => b.season - a.season);
  const year = all.filter((a) => a.season === state.season);
  const yours = all.filter((a) => a.yours);
  const poy = year.find((a) => a.kind === "poy");
  const aa = year.filter((a) => a.kind === "all-american");
  const conf = year.filter((a) => a.kind === "all-conf" && a.yours);
  const race = awardRace(state, 8);
  const potw = state.potw ?? [];

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="min-h-11 self-start text-sm font-semibold text-accent" {...bindTap(() => setView("hub"))}>
        ← Gym
      </button>
      <div>
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Awards</p>
        <h1 className="font-display mt-1 text-3xl">Awards</h1>
        <p className="mt-1 text-sm text-muted">
          {year.length ? `${state.season} lists are in. They use points, boards, assists, and wins — not a random name.` : "Watch list only until the year closes. Nobody has won it yet."}
        </p>
      </div>
      {state.watch && state.watch.length > 0 && (
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Preseason watch</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {state.watch.map((w, i) => (
              <li key={`${w.teamId}-${w.name}`} className={`flex justify-between gap-2 ${w.yours ? "font-semibold" : ""}`}>
                <span>
                  {i + 1}. {w.name}
                  {w.yours ? " · you" : ""}
                </span>
                <span className="text-xs text-muted">{w.pos} · {TEAM_BY_ID[w.teamId]?.abbr ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {race.length > 0 && !poy && (
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">National watch list</p>
          <p className="mt-1 text-xs text-muted">Projection from points, rebounds, and assists. Not a winner.</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {race.map((r, i) => (
              <li key={`${r.name}-${r.teamId}`} className={`flex justify-between gap-2 ${r.yours ? "font-semibold" : ""}`}>
                <span>
                  {i + 1}. {r.name}
                  {r.yours ? " · you" : ""}
                </span>
                <span className="text-xs text-muted tabular-nums">{r.ppg.toFixed(1)} PPG · {TEAM_BY_ID[r.teamId]?.abbr ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {potw[0] && (
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Player of the week</p>
          <p className="font-display mt-1 text-2xl">{potw[0].name}</p>
          <p className="text-xs text-muted">
            Week {potw[0].week} · {potw[0].line}
            {potw[0].yours ? " · yours" : ""}
          </p>
          {potw.length > 1 && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {potw.slice(1, 6).map((p) => (
                <li key={`${p.season}-${p.week}`}>
                  Wk {p.week} · {p.name} · {p.line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {poy && (
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">National Player of the Year</p>
          <p className="font-display mt-1 text-2xl">{poy.name}</p>
          <p className="text-xs text-muted">{poy.yours ? "Yours." : poy.pos} · season award, not a projection</p>
        </div>
      )}
      {aa.length > 0 && (
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">All-Americans</p>
          <ul className="mt-2 space-y-1 text-sm">
            {aa.map((a) => (
              <li key={`${a.playerId}-${a.team}`} className={a.yours ? "font-semibold" : ""}>
                {a.team} · {a.name}
                {a.yours ? " · you" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {conf.length > 0 && (
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Your all-conference</p>
          <ul className="mt-2 space-y-1 text-sm">
            {conf.map((a) => (
              <li key={`${a.playerId}-${a.team}`}>{a.team} · {a.name}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Your awards</p>
        {yours.length === 0 && <p className="mt-2 text-sm text-muted">None yet. Win, and the lists find you.</p>}
        <ul className="mt-2 space-y-1.5 text-sm">
          {yours.slice(0, 24).map((a) => (
            <li key={`${a.season}-${a.kind}-${a.playerId}-${a.team}`} className="flex justify-between gap-2">
              <span>{awardLine(a)}</span>
              <span className="text-muted tabular-nums">{a.season}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
