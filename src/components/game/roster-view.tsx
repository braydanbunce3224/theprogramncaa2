import { useState } from "react";
import { useGame } from "@/game/store";
import { SKILL_LABEL } from "@/game/develop";
import { teamChemistry } from "@/game/chemistry";
import { classLabel, canRedshirt, playedThisSeason, isOut, FOCUS_OPTS, PROMISE_OPTS, livePromises, traitOf, isStarter, captainOf, fatigueOf } from "@/game/engine";
import { bindTap } from "@/lib/tap";

export function RosterView() {
  const { state, pep, bumpMinutes, setMinutes, bumpUsage, redshirt, setFocus, promise, hold, openPlayer } = useGame();
  const [open, setOpen] = useState<string | null>(null);
  if (!state) return null;
  const roster = state.players.filter((p) => p.teamId === state.playerTeamId).sort((a, b) => b.ovr - a.ovr);
  const chem = teamChemistry(state, state.playerTeamId);
  const cap = captainOf(state);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl">Roster</h1>
        <p className="mt-1 text-sm text-muted">
          Set the minutes below. A game is 200 minutes to hand out.
        </p>
      </div>
      <MinutesBoard roster={roster} setMinutes={setMinutes} />
      {roster.length === 0 && (
        <p className="text-sm text-muted">No players on this file. Load another save or start a new job.</p>
      )}
      <div className="rounded-xl bg-elevated p-4 panel">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Chemistry</p>
        <p className="font-display mt-1 text-2xl">
          {chem.score} · {chem.label}
        </p>
        <p className="mt-1 text-xs text-muted">{chem.note}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Pillar label="Roles" value={chem.roles} />
          <Pillar label="Continuity" value={chem.continuity} />
          <Pillar label="Locker room" value={chem.locker} />
          <Pillar label="Trust" value={chem.trust} />
        </div>
        {chem.voice && (
          <p className="mt-3 text-xs text-muted">
            Voice: {chem.voice.first} {chem.voice.last}
            {chem.hog ? ` · hog: ${chem.hog.first}` : ""}
          </p>
        )}
      </div>
      <ul className="jersey-list">
        {roster.map((p) => {
          const room = p.potential - p.ovr;
          const on = open === p.id;
          const isVoice = chem.voice?.id === p.id;
          const out = isOut(p);
          const usage = p.usage != null && p.usage > 0 ? p.usage : null;
          const live = livePromises(state, p.id);
          const trait = traitOf(p);
          const starter = isStarter(state, p.id);
          const fat = fatigueOf(state, p.id);
          const tags = [
            cap?.id === p.id ? "Captain" : isVoice ? "Leader" : "",
            starter ? "Starter" : "",
            trait ?? "",
          ].filter(Boolean);
          const aria = [`${p.first} ${p.last}`, ...tags].join(", ");
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-label={aria}
                {...bindTap(() => setOpen(on ? null : p.id))}
                className={`jersey-card ${on ? "is-open" : ""}`}
              >
                <span className="jersey-num">{p.pos}</span>
                <span className="jersey-body">
                  <span className="jersey-name">{p.last.toUpperCase()}</span>
                  {tags.length > 0 && (
                    <span className="jersey-tags">
                      {tags.map((tag) => (
                        <span key={tag} className="jersey-tag">{tag}</span>
                      ))}
                    </span>
                  )}
                  <span className="jersey-meta">
                    {p.first} · {classLabel(p)}{p.height ? ` · ${p.height}` : ""}{p.country && p.country !== "US" ? ` · ${p.country}` : ""}{p.freakTag && p.freakTag !== trait ? ` · ${p.freakTag}` : ""}
                    {out ? " · out" : ` · ${p.mpg} min/g`}
                    {p.stats && p.stats.g > 0 ? ` · ${(p.stats.pts / p.stats.g).toFixed(1)} ppg` : ""}
                    {usage != null ? ` · ${usage} usage` : ""}
                    {p.injury && p.injury.weeksLeft > 0 ? ` · ${p.injury.part}` : ""}
                    {fat > 60 ? " · tired" : ""}
                  </span>
                </span>
                <span className="jersey-min" aria-label={out || p.redshirt ? "Not playing" : `${p.mpg} minutes`}>
                  <b>{out || p.redshirt ? "—" : p.mpg}</b>
                  <span>min</span>
                </span>
                <span className={`jersey-ovr ${p.morale >= 70 ? "is-hot" : p.morale < 50 ? "is-cold" : ""}`}>
                  {p.ovr}
                </span>
              </button>
              {on && (
                <div className="mt-2 rounded-xl bg-surface p-4 panel">
                  <p className="text-xs text-muted">
                    {p.ovr} overall · {p.potential} potential{room > 0 ? ` · +${room} upside` : " · at his ceiling"} · confidence {p.morale}
                    {p.focus && p.focus !== "balanced" ? ` · ${p.focus}` : ""}
                    {" · "}{p.seasonMinutes} min this year
                    {p.path === "juco" ? " · JUCO" : ""}
                    {p.injury && p.injury.weeksLeft > 0 ? ` · ${p.injury.part} (${p.injury.weeksLeft} week${p.injury.weeksLeft === 1 ? "" : "s"})` : ""}
                  </p>
                  {p.growth && p.growth.length > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      Growth: {p.growth.slice(-3).map((g) => g.note || `${g.season} ${g.ovr}`).join(" · ")}
                    </p>
                  )}
                  <div className="mt-3 flex flex-col gap-2">
                    {SKILL_LABEL.map((s) => {
                      const v = p.skills?.[s.id] ?? p.ovr;
                      return (
                        <div key={s.id}>
                          <div className="flex justify-between text-xs tracking-wide text-muted uppercase">
                            <span>{s.label}</span>
                            <span className="tabular-nums text-fg">{v}</span>
                          </div>
                          <div className="interest-bar mt-1">
                            <span style={{ width: `${v}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-xs tracking-[0.16em] text-muted uppercase">Skill work</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {FOCUS_OPTS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`min-h-10 rounded-lg px-2 text-xs font-semibold ${(p.focus ?? "balanced") === f.id ? "bg-accent text-accent-fg" : "bg-bg"}`}
                        {...bindTap(() => setFocus(p.id, f.id))}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs text-muted">Minutes</span>
                    <button type="button" className="min-h-11 min-w-11 rounded-lg bg-bg font-semibold" {...bindTap(() => bumpMinutes(p.id, -2))}>−</button>
                    <span className="tabular-nums font-semibold">{p.mpg}</span>
                    <button type="button" className="min-h-11 min-w-11 rounded-lg bg-bg font-semibold" {...bindTap(() => bumpMinutes(p.id, 2))}>+</button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted">Usage</span>
                    <button type="button" className="min-h-11 min-w-11 rounded-lg bg-bg font-semibold" {...bindTap(() => bumpUsage(p.id, -2))}>−</button>
                    <span className="tabular-nums font-semibold">{usage}</span>
                    <button type="button" className="min-h-11 min-w-11 rounded-lg bg-bg font-semibold" {...bindTap(() => bumpUsage(p.id, 2))}>+</button>
                  </div>
                  {(canRedshirt(state, p) || p.redshirt) && (
                    <button
                      type="button"
                      className="mt-3 min-h-12 w-full rounded-lg bg-elevated font-semibold"
                      {...bindTap(() => redshirt(p.id, !p.redshirt))}
                    >
                      {p.redshirt ? "End redshirt" : "Redshirt"}
                    </button>
                  )}
                  {!p.redshirt && !canRedshirt(state, p) && playedThisSeason(state, p) && state.phase !== "offseason" && (
                    <p className="mt-3 text-xs text-muted">Played this season — redshirt is closed.</p>
                  )}
                  <button type="button" className="mt-3 min-h-12 w-full rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(() => pep(p.id))}>
                    Check in
                  </button>
                  <button type="button" className="mt-2 min-h-12 w-full rounded-lg bg-elevated font-semibold" {...bindTap(() => openPlayer(p.id))}>
                    Full page
                  </button>
                  <button type="button" className="mt-2 min-h-12 w-full rounded-lg bg-elevated font-semibold" {...bindTap(() => hold(p.id))}>
                    Hold him to the film
                  </button>
                  <p className="mt-3 text-xs tracking-[0.16em] text-muted uppercase">Promises</p>
                  {live.length > 0 && (
                    <p className="mt-1 text-xs text-muted">{live.map((x) => x.text).join(" ")}</p>
                  )}
                  <div className="mt-2 flex flex-col gap-1">
                    {PROMISE_OPTS.filter((o) => !o.needNil || state.nilCap > 0).map((o) => (
                      <button
                        key={o.kind}
                        type="button"
                        className="min-h-11 w-full rounded-lg bg-bg text-sm font-semibold"
                        {...bindTap(() => promise(p.id, o.kind))}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MinutesBoard({
  roster,
  setMinutes,
}: {
  roster: { id: string; first: string; last: string; pos: string; year: number; mpg: number; redshirt?: boolean; injury?: { weeksLeft: number } | null }[];
  setMinutes: (id: string, mpg: number) => void;
}) {
  const playing = roster.filter((p) => !p.redshirt && !(p.injury && p.injury.weeksLeft > 0));
  const sitting = roster.filter((p) => p.redshirt || (p.injury && p.injury.weeksLeft > 0));
  const used = playing.reduce((n, p) => n + p.mpg, 0);
  const left = 200 - used;
  const ordered = [...playing].sort((a, b) => b.mpg - a.mpg || a.last.localeCompare(b.last));
  return (
    <div className="rounded-xl bg-elevated p-4 panel">
      <p className="text-xs tracking-[0.18em] text-muted uppercase">Minutes</p>
      <p className="font-display mt-1 text-2xl tabular-nums">
        {used} <span className="text-muted">/ 200</span>
      </p>
      <p className={`mt-1 text-xs ${left < 0 ? "text-loss" : "text-muted"}`}>
        {left === 0
          ? "The night adds up. Five players, 40 minutes."
          : left > 0
            ? `${left} minutes still open.`
            : `Rotation is ${Math.abs(left)} minutes over the 200-minute game limit.`}
      </p>
      <div className="min-stack mt-3" aria-hidden>
        {ordered.map((p) => (
          <i key={p.id} style={{ width: `${Math.max(0, (p.mpg / Math.max(used, 200)) * 100)}%` }} />
        ))}
      </div>
      <ul className="mt-2">
        {ordered.map((p) => (
          <li key={p.id} className="min-row">
            <span className="min-name">{p.last}</span>
            <span className="min-pos">{p.pos}</span>
            <span className="min-num">{p.mpg} min</span>
            <input
              type="range"
              min={0}
              max={38}
              step={1}
              value={p.mpg}
              aria-label={`${p.first} ${p.last} minutes`}
              onChange={(e) => setMinutes(p.id, Number(e.target.value))}
            />
          </li>
        ))}
        {sitting.map((p) => (
          <li key={p.id} className="min-row is-out">
            <span className="min-name">{p.last}</span>
            <span className="min-pos">{p.redshirt ? "RS" : "Out"}</span>
            <span className="min-num">—</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pillar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="interest-bar mt-1">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
