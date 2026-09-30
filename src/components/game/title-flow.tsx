import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { CAREER_MAX_PRESTIGE, careerEligible, CONFERENCES, TEAM_BY_ID, TEAMS, inkOn } from "@/game/teams";
import { conferenceInYear, leagueName } from "@/game/align";
import { hasAnySave } from "@/game/persist";
import { PressButton } from "@/components/ui/press-button";
import { packTitle } from "@/game/names";
import { DIFFICULTY_OPTS } from "@/game/engine";
import type { ConferenceId, View } from "@/game/types";
import titlePoster from "@/assets/landing-poster.jpg";
import { AppFrame } from "@/components/game/app-frame";
import { bindTap } from "@/lib/tap";
import { applyMenuGo } from "@/game/menu-go";
import { isMenuArmed, onMenuArmed, peekQueuedGo } from "@/game/menu-boot";

const ERAS: { decade: number; kicker: string; blurb: string; tags: string[] }[] = [
  {
    decade: 1960,
    kicker: "No three, no clock",
    blurb: "No three-point line and no shot clock. UCLA sets the standard. You win in the paint.",
    tags: ["No 3s", "No shot clock", "No NIL"],
  },
  {
    decade: 1970,
    kicker: "After Wooden",
    blurb: "UCLA's run ends and the field opens up. Still no three-point line. Players still don't get paid.",
    tags: ["No 3s", "No NIL", "Independents"],
  },
  {
    decade: 1980,
    kicker: "The three arrives",
    blurb: "The three-point line shows up in 1986. The Big East is on national TV. Still no NIL.",
    tags: ["3s from '86", "No NIL", "Big East TV"],
  },
  {
    decade: 1990,
    kicker: "July recruiting",
    blurb: "The three is just part of the game. You spend July on the road. Players still can't take money.",
    tags: ["3-point line", "No NIL", "July recruiting"],
  },
  {
    decade: 2000,
    kicker: "One-and-done",
    blurb: "Stars have to wait a year for the NBA, then they leave. Mid-majors can still crash the tournament.",
    tags: ["3-point line", "No NIL", "Freshman stars"],
  },
  {
    decade: 2010,
    kicker: "The portal opens",
    blurb: "Everybody shoots. In 2018 the transfer portal opens and rosters stop staying put.",
    tags: ["3-point line", "No NIL", "Portal in '18"],
  },
  {
    decade: 2020,
    kicker: "NIL and realignment",
    blurb: "Players can get paid. By 2024 the conferences have moved and the portal is a second signing period.",
    tags: ["3-point line", "NIL", "Portal + realignment"],
  },
];

function eraMeta(decade: number | null) {
  return ERAS.find((e) => e.decade === decade) ?? null;
}

export function TitleFlow() {
  const { view } = useGame();
  if (view === "create") return <CreateCoach />;
  if (view === "select") return <TeamSelect />;
  if (view === "eras") return <EraSelect />;
  return <TitleScreen />;
}

function NamesEntry({ from }: { from: View }) {
  const { openNames, namesStamp } = useGame();
  void namesStamp;
  return (
    <PressButton
      className="mt-3 min-h-12 w-full rounded-lg bg-elevated px-4 py-2 text-left font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
      onPress={() => openNames(from)}
    >
      Import team names
      <span className="mt-0.5 block text-xs font-normal text-muted">Active: {packTitle()}</span>
    </PressButton>
  );
}

function clearMenuHash() {
  if (typeof window === "undefined") return;
  if (location.hash.startsWith("#hh-")) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
}

function TitleBtn({
  go,
  className,
  children,
}: {
  go: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className={className} data-go={go} onClick={() => applyMenuGo(go)}>
      {children}
    </button>
  );
}

function TitleScreen() {
  const toast = useGame((s) => s.toast);
  const saves = useGame((s) => s.saves);
  const [hasSave, setHasSave] = useState(false);
  const [armed, setArmed] = useState(isMenuArmed);
  const [queued, setQueued] = useState<string | null>(null);
  useEffect(() => {
    setHasSave(hasAnySave());
  }, [saves]);
  useEffect(() => {
    setQueued(peekQueuedGo());
    return onMenuArmed(() => {
      setQueued(peekQueuedGo());
      setArmed(true);
    });
  }, []);
  const has = hasSave || saves.length > 0;
  const bootLine = queued === "career"
    ? "Career — one second."
    : queued === "dynasty"
      ? "Pick a school — one second."
      : queued === "eras"
        ? "Eras — one second."
        : queued === "continue"
          ? "Continue — one second."
          : queued === "saves"
            ? "Load game — one second."
            : queued === "hof"
              ? "Hall of Fame — one second."
              : "Loading";

  return (
    <div className={`title-screen${armed ? "" : " is-booting"}`}>
      <img src={titlePoster} alt="" className="title-poster" draggable={false} />
      <h1 className="sr-only">Dribble</h1>
      <nav className="title-menu" aria-label="Main menu" aria-busy={!armed}>
        <div className="title-boot" aria-hidden={armed}>
          <p className="title-boot-kicker" aria-live={armed ? "off" : "polite"}>
            {bootLine}
          </p>
          <span className="title-boot-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="Loading the menu">
            <span className="title-boot-fill" />
          </span>
        </div>
        <TitleBtn go="career" className={`title-btn title-btn-primary${queued === "career" ? " is-queued" : ""}`}>
          Career
        </TitleBtn>
        <TitleBtn go="dynasty" className={`title-btn title-btn-ghost${queued === "dynasty" ? " is-queued" : ""}`}>
          Pick a school
        </TitleBtn>
        <TitleBtn go="eras" className={`title-btn title-btn-ghost${queued === "eras" ? " is-queued" : ""}`}>
          Eras
        </TitleBtn>
        {has && (
          <TitleBtn go="continue" className={`title-btn title-btn-ghost${queued === "continue" ? " is-queued" : ""}`}>
            Continue
          </TitleBtn>
        )}
        <div className="title-menu-row">
          <TitleBtn go="saves" className={`title-btn title-btn-ghost${queued === "saves" ? " is-queued" : ""}`}>
            Load game
          </TitleBtn>
          <TitleBtn go="hof" className={`title-btn title-btn-ghost${queued === "hof" ? " is-queued" : ""}`}>
            Hall of Fame
          </TitleBtn>
        </div>
        {toast && <p className="mt-3 text-sm text-loss">{toast}</p>}
      </nav>
    </div>
  );
}

function EraSelect() {
  const { pickEra, setView } = useGame();
  return (
    <AppFrame>
      <div className="px-4 py-6 text-fg">
        <div className="mx-auto max-w-xl">
          <PressButton
            className="min-h-11 text-xs tracking-[0.18em] text-muted uppercase"
            onPress={() => {
              if (location.hash.startsWith("#hh-")) history.replaceState(null, "", `${location.pathname}${location.search}`);
              setView("title");
            }}
          >
            Back
          </PressButton>
          <h1 className="font-display mt-1 text-4xl">Eras</h1>
          <p className="mt-2 text-sm text-muted">
            Pick a decade. The rules, the money, and which programs are on top all change. Career and Pick a School stay in the present.
          </p>
          <NamesEntry from="eras" />
          <ul className="mt-6 flex flex-col gap-3">
            {ERAS.map((era) => (
              <li key={era.decade}>
                <PressButton
                  onPress={() => pickEra(era.decade)}
                  className="flex min-h-28 w-full touch-manipulation flex-col rounded-xl border border-border bg-elevated p-4 text-left"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-3xl leading-none">{era.decade}s</span>
                    <span className="text-[11px] tracking-[0.14em] text-accent uppercase">{era.kicker}</span>
                  </span>
                  <span className="mt-2 text-sm leading-snug text-muted">{era.blurb}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">
                    {era.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold tracking-wide text-fg/80 uppercase">
                        {tag}
                      </span>
                    ))}
                  </span>
                </PressButton>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppFrame>
  );
}

function CreateCoach() {
  const { draftCoach, setDraftCoach, draftDifficulty, setDraftDifficulty, setView, selectMode, eraDecade, toast } = useGame();
  const [q, setQ] = useState("");
  const [needName, setNeedName] = useState(false);
  const alma = draftCoach.almaMaterId ? TEAM_BY_ID[draftCoach.almaMaterId] : null;
  const named = draftCoach.first.trim().length > 0 && draftCoach.last.trim().length > 0;
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return TEAMS.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.city.toLowerCase().includes(query) ||
        t.abbr.toLowerCase().includes(query),
    ).slice(0, 12);
  }, [q]);
  const nextLabel = selectMode === "career" ? "Choose first job" : "Pick a school";
  const backTo = selectMode === "eras" ? "eras" : "title";

  return (
    <AppFrame>
      <div className="px-4 py-6 text-fg">
        <div className="mx-auto max-w-xl">
          <PressButton
            className="min-h-11 text-xs tracking-[0.18em] text-muted uppercase"
            onPress={() => {
              if (backTo === "title") clearMenuHash();
              setView(backTo);
            }}
          >
            Back
          </PressButton>
          <h1 className="font-display mt-1 text-4xl">Create a coach</h1>
          <p className="mt-2 text-sm text-muted">
            {selectMode === "career"
              ? "First and last before they hang the picture. First jobs are the smaller programs. Alma mater is optional."
              : selectMode === "eras" && eraDecade
                ? `First and last. You're walking into the ${eraDecade}s — ${eraMeta(eraDecade)?.kicker ?? "a different game"}. Alma mater still helps when that job opens.`
                : "First and last. Age and alma mater are optional. That school reaches further when the job opens."}
          </p>
          <NamesEntry from="create" />
          {toast && <p className="mt-3 text-sm text-loss">{toast}</p>}
          {needName && <p className="mt-3 text-sm text-loss">Give me a first and last. They'll put it on the chair.</p>}
          <label className="mt-6 block text-[11px] tracking-[0.16em] text-subtle uppercase">First name</label>
          <input
            className="mt-2 h-12 w-full rounded-lg border border-border bg-elevated px-3 text-fg"
            value={draftCoach.first}
            onChange={(e) => {
              setNeedName(false);
              setDraftCoach({ first: e.target.value.slice(0, 18) });
            }}
            placeholder="First"
          />
          <label className="mt-4 block text-[11px] tracking-[0.16em] text-subtle uppercase">Last name</label>
          <input
            className="mt-2 h-12 w-full rounded-lg border border-border bg-elevated px-3 text-fg"
            value={draftCoach.last}
            onChange={(e) => {
              setNeedName(false);
              setDraftCoach({ last: e.target.value.slice(0, 20) });
            }}
            placeholder="Last"
          />
          <p className="mt-6 text-[11px] tracking-[0.16em] text-subtle uppercase">Difficulty</p>
          <div className="mt-2 flex flex-col gap-2">
            {DIFFICULTY_OPTS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`min-h-12 rounded-lg px-3 py-2 text-left ${draftDifficulty === d.id ? "bg-accent text-accent-fg" : "bg-elevated"}`}
                {...bindTap(() => setDraftDifficulty(d.id))}
              >
                <span className="block font-semibold">{d.label}</span>
                <span className={`block text-xs ${draftDifficulty === d.id ? "text-accent-fg/80" : "text-muted"}`}>{d.hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-[11px] tracking-[0.16em] text-subtle uppercase">Age</p>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" className="h-12 w-14 rounded-lg bg-elevated" {...bindTap(() => setDraftCoach({ age: Math.max(28, draftCoach.age - 1) }))}>
              −
            </button>
            <span className="font-display min-w-16 text-center text-3xl">{draftCoach.age}</span>
            <button type="button" className="h-12 w-14 rounded-lg bg-elevated" {...bindTap(() => setDraftCoach({ age: Math.min(64, draftCoach.age + 1) }))}>
              +
            </button>
          </div>

          <p className="mt-6 text-[11px] tracking-[0.16em] text-subtle uppercase">Alma mater</p>
          <p className="mt-1 text-sm text-muted">Optional. Search to pick. They will reach further when that job opens.</p>
          {alma && (
            <p className="mt-2 text-sm text-accent">
              {alma.name} · {alma.mascot}
              <button type="button" className="ml-3 text-xs text-muted underline" {...bindTap(() => setDraftCoach({ almaMaterId: "" }))}>
                Clear
              </button>
            </p>
          )}
          <input
            className="mt-2 h-12 w-full rounded-lg border border-border bg-elevated px-3 text-fg"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Kentucky, Gonzaga, Albany…"
          />
          <ul className="mt-2">
            {list.map((t) => (
              <li key={t.id} className="border-b border-border">
                <PressButton
                  onPress={() => {
                    setDraftCoach({ almaMaterId: t.id });
                    setQ("");
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                  <span className="flex-1">
                    <span className="block font-semibold">{t.name}</span>
                    <span className="text-xs text-muted">{t.city} · rating {t.prestige}</span>
                  </span>
                </PressButton>
              </li>
            ))}
          </ul>
          <PressButton
            className={`mt-5 min-h-14 w-full touch-manipulation rounded-lg px-5 font-semibold ${named ? "bg-accent text-accent-fg" : "bg-elevated text-muted"}`}
            onPress={() => {
              if (!named) {
                setNeedName(true);
                return;
              }
              setView("select");
            }}
          >
            {nextLabel}
          </PressButton>
        </div>
      </div>
    </AppFrame>
  );
}

function TeamSelect() {
  const { selectedTeamId, pickTeam, startDynasty, setView, selectMode, eraDecade, draftCoach, toast, namesStamp } = useGame();
  const career = selectMode === "career";
  const [q, setQ] = useState("");
  const [conf, setConf] = useState<string>("ALL");
  const boardCount = TEAMS.length;
  const pool = useMemo(() => {
    void namesStamp;
    return career ? TEAMS.filter(careerEligible) : TEAMS.slice();
  }, [career, namesStamp, boardCount]);
  const year = selectMode === "eras" && eraDecade != null ? eraDecade : 2026;
  const list = useMemo(() => {
    const base = conf === "ALL" ? pool : pool.filter((t) => conferenceInYear(t.id, year) === conf);
    const query = q.trim().toLowerCase();
    const filtered = query
      ? base.filter((t) => t.name.toLowerCase().includes(query) || t.mascot.toLowerCase().includes(query) || t.city.toLowerCase().includes(query))
      : base;
    return [...filtered].sort((a, b) => (career ? a.prestige - b.prestige : b.prestige - a.prestige));
  }, [conf, q, pool, career, year]);
  const shown = list;
  const picked = selectedTeamId ? TEAM_BY_ID[selectedTeamId] : null;
  const alma = draftCoach.almaMaterId ? TEAM_BY_ID[draftCoach.almaMaterId] : null;
  const backTo = career || selectMode === "eras" || selectMode === "dynasty" ? "create" : "title";
  const pickedLeague = picked ? leagueName(conferenceInYear(picked.id, year), year) : "";

  return (
    <AppFrame
      footer={
        picked ? (
          <div className="border-t border-border bg-elevated px-4 py-3" style={{ paddingBottom: "calc(0.75rem + var(--dock-pad))" }}>
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{career ? "Career" : "Dynasty"}</p>
            <p className="font-display mt-1 text-2xl">{picked.name}</p>
            <p className="mt-1 text-sm text-muted">{picked.mascot} · {pickedLeague} · rating {picked.prestige}</p>
            <PressButton
              className="mt-3 min-h-14 w-full touch-manipulation rounded-lg bg-accent font-semibold text-accent-fg"
              onPress={() => startDynasty(picked.id)}
            >
              Take this job
            </PressButton>
            <PressButton className="mt-2 min-h-11 w-full text-sm text-muted" onPress={() => pickTeam(null)}>
              Pick a different school
            </PressButton>
          </div>
        ) : undefined
      }
    >
      <div className="px-4 py-6 text-fg">
        <div className="mx-auto max-w-xl">
          <PressButton
            className="min-h-11 text-xs tracking-[0.18em] text-muted uppercase"
            onPress={() => {
              if (backTo === "title") clearMenuHash();
              setView(backTo);
            }}
          >
            Back
          </PressButton>
          <h1 className="font-display mt-1 text-4xl">{career ? "First job" : eraDecade ? `${eraDecade}s · ${eraMeta(eraDecade)?.kicker ?? "job"}` : "Take the job"}</h1>
          <p className="mt-2 text-sm text-muted">
            {career
              ? `Career starts lower. Pick a school for any program. ${pool.length} jobs, rating ${CAREER_MAX_PRESTIGE} and under.`
              : eraDecade
                ? eraMeta(eraDecade)?.blurb ?? "Tap a school, then take the job."
                : `Every Division I school is here. ${boardCount} programs. Tap one, then take the job.`}
            {alma ? ` Alma mater: ${alma.name}.` : ""}
          </p>
          <NamesEntry from="select" />
          {!career && (
            <PressButton className="mt-2 min-h-11 text-sm text-accent underline" onPress={() => setView("create")}>
              Edit coach
            </PressButton>
          )}
          {toast && <p className="mt-3 text-sm text-loss">{toast}</p>}
          {!career && <AddSchool />}
          {career && pool.length === 0 && <p className="mt-4 text-sm text-loss">No eligible jobs. Go back and pick a school instead.</p>}
          <input className="mt-4 h-12 w-full rounded-lg border border-border bg-elevated px-3" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Albany, Vermont…" />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            <Chip on={conf === "ALL"} onClick={() => setConf("ALL")} label="All" />
            {CONFERENCES.filter((c) => pool.some((t) => conferenceInYear(t.id, year) === c.id)).map((c) => (
              <Chip key={c.id} on={conf === c.id} onClick={() => setConf(c.id)} label={c.short} />
            ))}
          </div>
          <ul className="mt-2 space-y-2">
            {shown.map((t) => (
              <li key={t.id}>
                <PressButton
                  onPress={() => pickTeam(t.id)}
                  className={`school-card ${selectedTeamId === t.id ? "is-on" : ""}`}
                >
                  <span className="school-abbr" style={{ background: t.color, color: inkOn(t.color) }}>
                    {t.abbr.slice(0, 4)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">{t.name}</span>
                    <span className="text-xs text-muted">{t.mascot} · {t.city} · {leagueName(conferenceInYear(t.id, year), year)}</span>
                  </span>
                  <span className="text-[11px] font-bold tracking-wider text-gold uppercase">
                    {selectedTeamId === t.id ? "Yours" : "Job"}
                  </span>
                </PressButton>
              </li>
            ))}
          </ul>
          {list.length > shown.length && (
            <p className="mt-3 pb-8 text-sm text-muted">
              Showing {shown.length} of {list.length} schools. Search or pick a league to see the rest.
            </p>
          )}
          {list.length <= shown.length && list.length > 0 && (
            <p className="mt-3 pb-8 text-sm text-muted">
              {list.length} of {career ? pool.length : boardCount} schools.
            </p>
          )}
        </div>
      </div>
    </AppFrame>
  );
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" {...bindTap(onClick)} className={`chip-lane ${on ? "is-on" : ""}`}>
      {label}
    </button>
  );
}

function AddSchool() {
  const createSchool = useGame((s) => s.createSchool);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Test U");
  const [mascot, setMascot] = useState("Trials");
  const [abbr, setAbbr] = useState("TST");
  const [color, setColor] = useState("#0E6B4F");
  const [city, setCity] = useState("Testville");
  const [conf, setConf] = useState<ConferenceId>("HOR");
  if (!open) {
    return (
      <button type="button" className="mt-3 min-h-11 text-sm font-semibold text-accent" {...bindTap(() => setOpen(true))}>
        Add a school
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-border bg-elevated p-3">
      <p className="text-xs tracking-[0.16em] text-muted uppercase">New Division I school</p>
      <p className="mt-1 text-sm text-muted">It shows up in this list, then on the schedule and standings when you take a job. Career still starts at mid and low majors.</p>
      <input className="mt-2 h-12 w-full rounded-lg border border-border bg-bg px-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="School name" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input className="h-12 rounded-lg border border-border bg-bg px-3" value={mascot} onChange={(e) => setMascot(e.target.value)} placeholder="Mascot" />
        <input className="h-12 rounded-lg border border-border bg-bg px-3" value={abbr} onChange={(e) => setAbbr(e.target.value)} placeholder="Abbr" />
      </div>
      <input className="mt-2 h-12 w-full rounded-lg border border-border bg-bg px-3" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
      <div className="mt-2 flex items-center gap-2">
        <input className="h-12 w-16 rounded-lg border border-border bg-bg" type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="School color" />
        <select className="h-12 flex-1 rounded-lg border border-border bg-bg px-2" value={conf} onChange={(e) => setConf(e.target.value as ConferenceId)}>
          {CONFERENCES.filter((c) => c.id !== "IND").map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="mt-3 min-h-12 w-full rounded-lg bg-accent font-semibold text-accent-fg"
        {...bindTap(() => {
          createSchool({ name, mascot, abbr, color, city, stateName: "US", conference: conf });
          setOpen(false);
        })}
      >
        Put {name.trim() || "Test U"} on the board
      </button>
    </div>
  );
}
