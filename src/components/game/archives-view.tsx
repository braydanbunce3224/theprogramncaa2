import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { teamOf } from "@/game/teams";
import { leagueName } from "@/game/align";
import { bookLines } from "@/game/engine";
import { bindTap } from "@/lib/tap";
import type { ConferenceId, SeasonLog } from "@/game/types";

export function ArchivesView() {
  const { state, setView } = useGame();
  const [season, setSeason] = useState<number | null>(null);
  const [conf, setConf] = useState<string>("YOURS");
  const [school, setSchool] = useState("");
  if (!state) return null;
  const log = state.history.log ?? [];
  const year = season ?? log[log.length - 1]?.season ?? null;
  const row = log.find((y) => y.season === year) ?? null;
  const confs = row?.standings?.map((s) => s.conf) ?? [];
  const yours = state.teams[state.playerTeamId]?.conference;
  const confId = conf === "YOURS" ? yours : conf;
  const table = row?.standings?.find((s) => s.conf === confId);
  const q = school.trim().toLowerCase();
  const boxes = (row?.boxes ?? []).filter((b) => {
    if (!q) return true;
    return b.home.toLowerCase().includes(q) || b.away.toLowerCase().includes(q);
  });
  const champ = row?.championId ? teamOf(row.championId) : null;
  const legends = (state.legends ?? []).filter((g) => !q || g.name.toLowerCase().includes(q) || teamOf(g.teamId).name.toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="min-h-11 self-start text-sm font-semibold text-accent" {...bindTap(() => setView("hub"))}>
        ← Gym
      </button>
      <div>
        <p className="text-xs tracking-[0.18em] text-muted uppercase">The building</p>
        <h1 className="font-display mt-1 text-3xl">Archives</h1>
        <p className="mt-1 text-sm text-muted">
          Prior seasons stay here after the calendar rolls. Champions, awards, standings, box scores, retired numbers.
        </p>
      </div>
      {!row && state.results.length > 0 && (
        <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
          This season’s boxes live on the gym / recap. Archives fill when the calendar rolls (champions, awards, standings, boxes).
        </p>
      )}
      {!row && state.results.length === 0 && (
        <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
          No games yet. Finish a season and the champions, awards, standings, and box scores stay here.
        </p>
      )}
      {log.length > 0 && (
        <div className="chip-row">
          {log.map((y) => (
            <button
              key={y.season}
              type="button"
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${year === y.season ? "bg-accent text-accent-fg" : "bg-elevated"}`}
              {...bindTap(() => setSeason(y.season))}
            >
              {y.season}
            </button>
          ))}
        </div>
      )}
      {row && <YearCard row={row} champName={champ?.name ?? "—"} />}
      {row && (
        <>
          <label className="block text-sm">
            <span className="text-xs tracking-[0.14em] text-muted uppercase">School filter</span>
            <input
              className="mt-1 h-12 w-full rounded-lg border border-border bg-elevated px-3"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="Filter a school…"
            />
          </label>
          <div>
            <p className="text-xs tracking-[0.18em] text-muted uppercase">Conference standings</p>
            <div className="chip-row mt-2">
              <button type="button" className={`min-h-11 rounded-full px-3 text-sm font-semibold ${conf === "YOURS" ? "bg-accent text-accent-fg" : "bg-elevated"}`} {...bindTap(() => setConf("YOURS"))}>
                Yours
              </button>
              {confs.filter((id) => id !== yours).slice(0, 12).map((id) => (
                <button key={id} type="button" className={`min-h-11 rounded-full px-3 text-sm font-semibold ${conf === id ? "bg-accent text-accent-fg" : "bg-elevated"}`} {...bindTap(() => setConf(id))}>
                  {leagueName(id as ConferenceId, row.season)}
                </button>
              ))}
            </div>
            {table ? (
              <ol className="mt-2 rounded-xl border border-border bg-elevated">
                {table.rows.filter((r) => !q || teamOf(r.id).name.toLowerCase().includes(q)).map((r, i) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm first:border-t-0">
                    <span>{i + 1}. {teamOf(r.id).name}</span>
                    <span className="tabular-nums text-muted">{r.w}-{r.l}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">No table for that league.</p>
            )}
          </div>
          <div>
            <p className="text-xs tracking-[0.18em] text-muted uppercase">Box scores</p>
            {boxes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No box from that filter. Clear the school name.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {boxes.map((b) => (
                  <li key={b.id} className="rounded-xl border border-border bg-elevated px-3 py-3">
                    <p className="text-xs text-muted">Week {b.week}</p>
                    <p className="font-semibold">{b.away} {b.awayScore} @ {b.home} {b.homeScore}</p>
                    {b.line && <p className="mt-1 text-sm text-muted">{b.line}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!!row.leaders?.length && (
            <div>
              <p className="text-xs tracking-[0.18em] text-muted uppercase">Scoring leaders</p>
              <ul className="mt-2 rounded-xl border border-border bg-elevated">
                {row.leaders.filter((p) => !q || p.name.toLowerCase().includes(q) || teamOf(p.teamId).name.toLowerCase().includes(q)).map((p) => (
                  <li key={p.name} className="flex justify-between gap-2 border-t border-border px-3 py-2 text-sm first:border-t-0">
                    <span>{p.name} · {teamOf(p.teamId).abbr}</span>
                    <span className="tabular-nums">{p.pts} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div>
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Retired numbers</p>
        {legends.length === 0 ? (
          <p className="mt-2 text-sm text-muted">A retired number is a national award, 1,800 career points, or an 86-overall senior who scored — not every senior.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {legends.map((g) => (
              <li key={`${g.season}-${g.number}-${g.name}`} className="rounded-xl border border-border bg-elevated px-3 py-3">
                <p className="font-display text-2xl">{g.number} · {g.name}</p>
                <p className="text-sm text-muted">{teamOf(g.teamId).name} · {g.season} · {g.note}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AllTime />
    </div>
  );
}

function YearCard({ row, champName }: { row: SeasonLog; champName: string }) {
  const awards = row.awards ?? [];
  return (
    <div className="rounded-xl border border-border bg-elevated p-4">
      <p className="text-xs tracking-[0.18em] text-muted uppercase">{row.season}</p>
      <p className="font-display mt-1 text-3xl">{row.wins}–{row.losses}</p>
      <p className="text-sm text-muted">
        You went {row.wins}-{row.losses}, {row.confW}-{row.confL} in conference.
        {row.title ? " You won the national title." : row.championId ? ` ${champName} won the national title.` : " No national champion is recorded for this year."}
        {row.confTitle ? " Conference champions." : ""}
        {!row.title && row.ncaaBid ? " NCAA bid." : ""}
      </p>
      {row.summary && <p className="mt-2 text-sm">{row.summary}</p>}
      {awards.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {awards.slice(0, 12).map((a) => (
            <li key={`${a.kind}-${a.name}`}>{a.name} · {a.kind} · {teamOf(a.teamId).abbr}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Awards post when the season closes.</p>
      )}
    </div>
  );
}

function AllTime() {
  const { state } = useGame();
  const lines = useMemo(() => (state ? bookLines(state).lines : []), [state]);
  if (!lines.length) return null;
  return (
    <div>
      <p className="text-xs tracking-[0.18em] text-muted uppercase">All-time · this job</p>
      <ul className="mt-2 rounded-xl border border-border bg-elevated">
        {lines.map((r) => (
          <li key={r.k} className="flex justify-between gap-3 border-t border-border px-3 py-2 text-sm first:border-t-0">
            <span className="text-muted">{r.k}</span>
            <span className="text-right font-semibold">{r.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
