import { useMemo, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { CONFERENCES, TEAM_BY_ID, TEAMS, teamOf } from "@/game/teams";
import { leagueName } from "@/game/align";
import { DIFFICULTY_OPTS, settingsOf } from "@/game/engine";
import { SAVE_VERSION } from "@/game/types";
import { CHANGELOG, bugReport, challengeCode, downloadText, hostRoom, readRoom, writeChallengeSeed, writeRoom } from "@/game/sheet";
import { bindTap } from "@/lib/tap";
import type { ConferenceId, Difficulty, GameState, LeagueSettings } from "@/game/types";

export function SettingsView() {
  const { state, patchLeague, moveTeam, setView, exportLeague, importLeague, forceEndgame, forceTwoFor } = useGame();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  if (!state) return null;
  const s = settingsOf(state);
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return TEAMS.slice(0, 8);
    return TEAMS.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.abbr.toLowerCase().includes(query) ||
        t.id.includes(query) ||
        t.city.toLowerCase().includes(query),
    ).slice(0, 16);
  }, [q]);
  const chosen = pick ? TEAM_BY_ID[pick] : null;
  const live = chosen ? state.teams[chosen.id] : null;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" className="min-h-11 self-start text-sm font-semibold text-accent" {...bindTap(() => setView("hub"))}>
        ← Gym
      </button>
      <div>
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Options</p>
        <h1 className="font-display mt-1 text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Display, accessibility, the league, and your save.</p>
      </div>

      <p className="text-xs tracking-[0.18em] text-muted uppercase">League</p>
      <DevAudit />

      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Difficulty</p>
        <ul className="mt-3 flex flex-col gap-2">
          {DIFFICULTY_OPTS.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={`min-h-14 w-full rounded-lg px-3 py-2 text-left ${s.difficulty === d.id ? "bg-accent text-accent-fg" : "bg-bg"}`}
                {...bindTap(() => patchLeague({ difficulty: d.id as Difficulty }))}
              >
                <span className="block font-semibold">{d.label}</span>
                <span className={`block text-xs ${s.difficulty === d.id ? "text-accent-fg/80" : "text-muted"}`}>{d.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Toggle
        on={s.nilOn}
        title="NIL"
        hint="Donors, raises, and the pool. You can still turn it off in older eras."
        onToggle={(v) => patchLeague({ nilOn: v })}
      />
      <Toggle
        on={s.flipsOn}
        title="Flips and decommits"
        hint="Pledges can walk. Visits can steal them back."
        onToggle={(v) => patchLeague({ flipsOn: v })}
      />
      <p className="text-xs tracking-[0.18em] text-muted uppercase">Display</p>
      <Toggle
        on={s.teamColor}
        title="Team color"
        hint="The menus pick up your school's color."
        onToggle={(v) => patchLeague({ teamColor: v })}
      />
      <Toggle
        on={s.soundOn !== false}
        title="Gym sound"
        hint="Crowd, net, buzzer. First tap on the page unlocks it."
        onToggle={(v) => patchLeague({ soundOn: v })}
      />
      <p className="text-xs tracking-[0.18em] text-muted uppercase">Accessibility</p>
      <Toggle
        on={Boolean(s.reducedMotion)}
        title="Reduce motion"
        hint="Cuts the extra animation. The game still plays."
        onToggle={(v) => patchLeague({ reducedMotion: v })}
      />
      <Toggle
        on={Boolean(s.largerType)}
        title="Larger type"
        hint="Bigger text in the office. Easier under gym lights."
        onToggle={(v) => patchLeague({ largerType: v })}
      />
      <Toggle
        on={s.haptics !== false}
        title="Haptics"
        hint="A light tap on buttons. Silence it if you don't want the buzz."
        onToggle={(v) => patchLeague({ haptics: v })}
      />
      <Toggle
        on={s.godMode}
        title="God Mode"
        hint="Force a pledge. Move a program. Jump jobs. Force a win once."
        onToggle={(v) => patchLeague({ godMode: v, forceWin: v ? s.forceWin : false })}
      />
      {s.godMode && (
        <Toggle
          on={s.forceWin}
          title="Force the next win"
          hint="You win the next game you sim. One time."
          onToggle={(v) => patchLeague({ forceWin: v })}
        />
      )}
      {s.godMode && (
        <div className="sandbox-warn rounded-xl border border-loss/50 bg-elevated p-4">
          <p className="text-xs tracking-[0.18em] text-loss uppercase">Dev / sandbox</p>
          <p className="mt-1 text-sm">These jumps do not write a Career win, an archive, or a box. Leave the game and the record stays put.</p>
          <button type="button" className="mt-3 min-h-12 w-full rounded-lg bg-bg px-3 text-sm font-semibold" {...bindTap(forceEndgame)}>
            Force endgame: up 3, 0:08, opponent ball
          </button>
          <button type="button" className="mt-2 min-h-12 w-full rounded-lg bg-bg px-3 text-sm font-semibold" {...bindTap(forceTwoFor)}>
            Force 2-for-1: your ball, 0:36, ahead
          </button>
        </div>
      )}

      {s.godMode && (
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Realignment</p>
          <p className="mt-1 text-sm text-muted">Offseason or preseason. Conferences that are full swap a team the other way.</p>
          <input
            className="mt-3 h-12 w-full rounded-lg border border-border bg-bg px-3"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a program…"
          />
          <ul className="mt-2">
            {list.map((t) => {
              const rt = state.teams[t.id];
              return (
                <li key={t.id} className="border-t border-border first:border-t-0">
                  <button
                    type="button"
                    className={`flex min-h-12 w-full items-center justify-between gap-2 text-left text-sm ${pick === t.id ? "text-accent" : ""}`}
                    {...bindTap(() => setPick(t.id))}
                  >
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-xs text-muted">{leagueName((rt?.conference ?? t.conference) as ConferenceId, state.season)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {chosen && live && (
            <div className="mt-3">
              <p className="text-xs text-muted">
                {chosen.name} is in the {leagueName(live.conference, state.season)}. Tap a conference.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONFERENCES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={c.id === live.conference}
                    className="min-h-11 rounded-full bg-bg px-3 text-xs font-semibold disabled:opacity-40"
                    {...bindTap(() => moveTeam(chosen.id, c.id as ConferenceId))}
                  >
                    {c.short}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs tracking-[0.18em] text-muted uppercase">Data</p>
      <Commissioner state={state} patchLeague={patchLeague} exportLeague={exportLeague} importLeague={importLeague} />
      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Price</p>
        <h2 className="font-display mt-1 text-2xl">Free forever</h2>
        <p className="mt-1 text-sm text-muted">
          100% free D-I coaching sim — no IAP required. No ads. No energy gates. No loot boxes. Career, Pick a school, and live coaching stay open.
        </p>
        <a
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent"
          href="https://www.buymeacoffee.com"
          target="_blank"
          rel="noreferrer"
        >
          Optional tip · Buy me a coffee
        </a>
      </div>
      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">About</p>
        <h2 className="font-display mt-1 text-2xl">Dribble</h2>
        <p className="mt-1 text-sm text-muted">
          Championship build {SAVE_VERSION}. Install it from the browser menu. It resumes the last save on this device, including offline.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <a href="/ARCHITECTURE.md" className="flex min-h-11 items-center rounded-lg bg-bg px-3 text-sm font-semibold text-accent">
            Architecture
          </a>
          <a href="/privacy.html" className="flex min-h-11 items-center rounded-lg bg-bg px-3 text-sm font-semibold text-accent">
            Privacy
          </a>
        </div>
      </div>
    </div>
  );
}

function devOn() {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("dev") === "1";
    if (q) sessionStorage.setItem("dribble-dev", "1");
    return q || sessionStorage.getItem("dribble-dev") === "1";
  } catch {
    return false;
  }
}

function DevAudit() {
  const dev = devOn();
  const { forceEndgame, forceTwoFor } = useGame();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!dev) return null;
  return (
    <div className="sandbox-warn rounded-xl border border-loss/50 bg-elevated p-4" data-sim-test="1">
      <p className="text-xs tracking-[0.18em] text-loss uppercase">Dev / sandbox</p>
      <p className="mt-1 text-sm">Sim test and the endgame jumps do not change Career wins, Archives, or awards. They are not part of the season.</p>
      {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("dev") === "1" && (
        <p className="mt-1 text-xs text-muted">Live buttons: liveControls.ts. Possessions: plays.ts onePoss. Quick-sim: sim.ts simContest.</p>
      )}
      <button
        type="button"
        className="mt-2 min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold"
        disabled={busy}
        {...bindTap(() => {
          setBusy(true);
          setText("Simulating 100 games on each engine…");
          setTimeout(async () => {
            const { runAudit, auditGaps } = await import("@/game/audit");
            const out = runAudit(100);
            const show = (label: string, block: typeof out.live) => {
              const row = (k: keyof typeof block.stats) => {
                const v = block.stats[k];
                const pct = k === "fg" || k === "tp" || k === "ft";
                const n = (x: number) => (pct ? `${(x * 100).toFixed(1)}%` : x.toFixed(1));
                return `${k.padEnd(6)} ${n(v.avg).padStart(7)}  ± ${n(v.sd).padStart(6)}   ${n(v.min)}–${n(v.max)}`;
              };
              const keys = ["pts", "fg", "tpa", "tp", "fta", "ft", "ast", "to", "stl", "blk", "reb", "pf", "poss", "margin"] as const;
              const b = block.buckets;
              return [
                `${label}  n=${block.games}`,
                ...keys.map((k) => row(k)),
                `margin  1–7 ${(b.close * 100).toFixed(0)}%   8–14 ${(b.mid * 100).toFixed(0)}%   15–19 ${(b.big * 100).toFixed(0)}%   20+ ${(b.blow * 100).toFixed(0)}%`,
              ].join("\n");
            };
            const gaps = auditGaps(out.live, out.sim);
            setText(`${show("LIVE", out.live)}\n\n${show("SIM", out.sim)}\n\n${gaps.length ? `Gaps:\n${gaps.join("\n")}` : "No large gap between the engines."}`);
            setBusy(false);
          }, 30);
        })}
      >
        Sim test
      </button>
      <button type="button" className="mt-2 min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold" {...bindTap(forceEndgame)}>
        Force endgame: up 3, 0:08, opponent ball
      </button>
      <button type="button" className="mt-2 min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold" {...bindTap(forceTwoFor)}>
        Force 2-for-1: your ball, 0:36, ahead
      </button>
      {text && <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-muted">{text}</pre>}
    </div>
  );
}

function Commissioner({
  state,
  patchLeague,
  exportLeague,
  importLeague,
}: {
  state: GameState;
  patchLeague: (p: Partial<LeagueSettings>) => void;
  exportLeague: () => string;
  importLeague: (raw: string) => void;
}) {
  const s = settingsOf(state);
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(s.customLeague?.name ?? "");
  const [q, setQ] = useState("");
  const [seed, setSeed] = useState("");
  const [note, setNote] = useState("");
  const [room, setRoom] = useState("");
  const [join, setJoin] = useState("");
  const members = s.customLeague?.teams ?? [];
  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2) return [];
    return TEAMS.filter((t) => t.name.toLowerCase().includes(query) || t.abbr.toLowerCase().includes(query)).slice(0, 6);
  }, [q]);
  const table = members.map((id) => {
    const t = state.teams[id];
    return { id, name: teamOf(id).name, w: t?.wins ?? 0, l: t?.losses ?? 0 };
  }).sort((a, b) => b.w - a.w || a.l - b.l);

  return (
    <>
      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Portal rules</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["open", "normal", "tight"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`min-h-11 rounded-full px-3 text-sm font-semibold ${s.portalStrict === id ? "bg-accent text-accent-fg" : "bg-bg"}`}
              {...bindTap(() => patchLeague({ portalStrict: id }))}
            >
              {id === "open" ? "Open" : id === "tight" ? "Tight" : "Normal"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Open: more players enter and your odds go up. Tight: fewer leave. NIL follows the era you picked.</p>
      </div>

      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Custom league</p>
        <p className="mt-1 text-sm text-muted">A separate standings table. It does not change the real conferences. Realignment still follows the era.</p>
        <input className="mt-3 h-12 w-full rounded-lg border border-border bg-bg px-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="League name" />
        <input className="mt-2 h-12 w-full rounded-lg border border-border bg-bg px-3" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a school…" />
        <ul className="mt-2">
          {hits.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="min-h-11 w-full text-left text-sm font-semibold"
                {...bindTap(() => {
                  const teams = members.includes(t.id) ? members : [...members, t.id].slice(0, 12);
                  patchLeague({ customLeague: { name: name.trim() || "Custom", teams } });
                  setQ("");
                })}
              >
                {t.name}
              </button>
            </li>
          ))}
        </ul>
        {table.length > 0 && (
          <ul className="mt-2 text-sm">
            {table.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 border-t border-border py-2">
                <span>{row.name}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-muted">{row.w}-{row.l}</span>
                  <button type="button" className="min-h-11 text-xs font-semibold text-loss" {...bindTap(() => patchLeague({ customLeague: { name: name.trim() || s.customLeague?.name || "Custom", teams: members.filter((id) => id !== row.id) } }))}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-accent" {...bindTap(() => patchLeague({ customLeague: { name: name.trim() || "Custom", teams: members } }))}>
          Save name
        </button>
      </div>

      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Commissioner</p>
        <p className="mt-1 text-sm text-muted">God Mode edits ratings on a player page and can force a win or move a program. Roster CSV is on the stats page. This is the full save.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold" {...bindTap(() => downloadText(`dribble-${state.season}.json`, exportLeague(), "application/json"))}>
            Export save
          </button>
          <button type="button" className="min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold" {...bindTap(() => file.current?.click())}>
            Import save
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => importLeague(String(reader.result ?? ""));
              reader.readAsText(f);
            }}
          />
        </div>
        <p className="mt-3 text-xs text-muted">Challenge code {challengeCode(state)}. Paste a seed to share the same world on the next new dynasty.</p>
        <div className="mt-2 flex gap-2">
          <input className="h-12 flex-1 rounded-lg border border-border bg-bg px-3" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Seed" />
          <button type="button" className="min-h-12 rounded-lg bg-bg px-3 text-sm font-semibold" {...bindTap(() => { writeChallengeSeed(Number(seed) || 0); setNote(seed ? "Next new dynasty uses that seed." : "Challenge seed cleared."); })}>
            Set
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-muted">{note}</p>}
        <p className="mt-4 text-xs tracking-[0.18em] text-muted uppercase">Commissioner room</p>
        <p className="mt-1 text-sm text-muted">
          A short code stores this league file on the device. Someone on this browser can join it read-only by pasting the code. Copy the file if they are on another phone.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold"
            {...bindTap(() => {
              const code = hostRoom("");
              const file = writeRoom(code, exportLeague());
              setRoom(code);
              setNote(`Room ${code} is up. They join with that code on this device, or with the copied file.`);
              void navigator.clipboard?.writeText(file);
            })}
          >
            Host a room
          </button>
          {room && <span className="inline-flex min-h-11 items-center font-display text-2xl">{room}</span>}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="h-12 flex-1 rounded-lg border border-border bg-bg px-3" value={join} onChange={(e) => setJoin(e.target.value.toUpperCase().slice(0, 6))} placeholder="Room code" />
          <button
            type="button"
            className="min-h-12 rounded-lg bg-bg px-3 text-sm font-semibold"
            {...bindTap(() => {
              const file = readRoom(join);
              if (!file) {
                setNote("No league file under that code on this device.");
                return;
              }
              importLeague(file);
              setNote(`Joined ${join}.`);
            })}
          >
            Join
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">What's new</p>
        <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{CHANGELOG}</pre>
        <button
          type="button"
          className="mt-3 min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold"
          {...bindTap(() => {
            const text = bugReport(state);
            void navigator.clipboard?.writeText(text).then(() => setNote("Bug report copied. Paste it wherever you talk hoops.")).catch(() => setNote(text));
          })}
        >
          Copy bug report
        </button>
        <p className="mt-2 text-xs text-muted">No official Discord is bundled. Paste the copied report into yours. Saves stay on this device and migrate with the build number.</p>
      </div>
    </>
  );
}

function Toggle({
  on,
  title,
  hint,
  onToggle,
}: {
  on: boolean;
  title: string;
  hint: string;
  onToggle: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-border bg-elevated px-3 py-3">
      <input type="checkbox" className="mt-1 size-5 shrink-0 accent-current" checked={on} onChange={(e) => onToggle(e.target.checked)} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}
