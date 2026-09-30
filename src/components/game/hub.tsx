import { useState } from "react";
import { useGame } from "@/game/store";
import { carouselWaiting } from "@/game/carousel";
import { TEAM_BY_ID, teamOf } from "@/game/teams";
import { identityName, nextYourGame, recruitingProgress, unreadMail, draftWaiting, portalOpen, portalOf, campWaiting, campOf, yourAwards, goatLine, gameOfDay, awardRace, settingsOf, seriesVs, runLabel, staffTease, facilityTease, liveScout, resumeOf, practiceOf, injuredOf, teamLoad, coachRecord } from "@/game/engine";
import { teamChemistry } from "@/game/chemistry";
import { contractLine, contractProgress } from "@/game/contract";
import { complianceLabel, complianceNote } from "@/game/compliance";
import { tapeLine, teamTape } from "@/game/analytics";
import { hangLine, mlLabel, spreadText } from "@/game/market";
import { COACH_AXES } from "@/game/develop";
import { bindTap } from "@/lib/tap";
import { CBI, NCAA, NIT, gameKindShort, phaseLabel, outletLabel, siteWord } from "@/game/brand";
import { leagueName } from "@/game/align";
import { burnerTease } from "@/game/burner";
import { podcastTease } from "@/game/podcast";
import { gymTease } from "@/game/gym";
import { rivalryTease } from "@/game/rivalry";
import { downloadText, seasonReport } from "@/game/sheet";
import { siteRecordLine } from "@/game/present";
import { netHoldLine, netReleased, weekDateLabel } from "@/game/calendar";

export function Hub() {
  const { state, simWeek, simGame, simSeason, stopSeason, seasonRun, playGame, setView, nextSeason, spendSkill, saveNow, setAssisted, openContract, openRecap } = useGame();
  const [cardOn, setCardOn] = useState(false);
  if (!state) return null;
  const t = state.teams[state.playerTeamId];
  const school = teamOf(state.playerTeamId);
  if (!t) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl">Missing team</h1>
        <p className="text-sm text-muted">This save has no gym. Load another save or start a new job.</p>
      </div>
    );
  }
  const next = nextYourGame(state);
  const opp = next ? TEAM_BY_ID[next.homeId === state.playerTeamId ? next.awayId : next.homeId] : null;
  const tipThisWeek = Boolean(next && next.week === state.week);
  const off = state.phase === "offseason";
  const carouselOpen = carouselWaiting(state);
  const stayWaiting = draftWaiting(state);
  const campOpen = campWaiting(state);
  const boardWaiting = Boolean(
    off && state.contractReview && !state.contractReview.resolved && (state.contractReview.decision === "fire" || state.contractReview.decision === "extend"),
  );
  const rec = coachRecord(state);

  return (
    <div className="flex flex-col gap-4">
      <div className="scoreboard">
        <p className="scoreboard-kicker">
          {identityName(state.identity)} · {phaseLabel(state.phase, state.week)}
          {state.phase === "regular" ? ` · ${weekDateLabel(state.season, state.week)}` : ""} · {state.season}
        </p>
        <h1 className="scoreboard-name">{school.name}</h1>
        <p className="scoreboard-next">What’s new: Polish — school count, Archives copy, Settings cleanup, live fatigue labels.</p>
        <div className="scoreboard-leds">
          <div className="led">
            <span>Job</span>
            <b>{rec.jobW}-{rec.jobL}</b>
          </div>
          <div className="led">
            <span>Career</span>
            <b>{rec.careerW}-{rec.careerL}</b>
          </div>
          <div className="led">
            <span>{t.confW + t.confL > 0 ? "Conf" : "W"}</span>
            <b>{t.confW + t.confL > 0 ? `${t.confW}-${t.confL}` : t.wins}</b>
          </div>
        </div>
        <p className="scoreboard-next">
          {leagueName(t.conference, state.season)} · rating {t.prestige}
          {state.identity.almaMaterId && state.identity.almaMaterId !== state.playerTeamId
            ? ` · alma mater ${TEAM_BY_ID[state.identity.almaMaterId]?.name}`
            : ""}
        </p>
        <p className="scoreboard-next">
          {siteRecordLine(state)}
          {state.history.titles ? ` · ${state.history.titles} national title${state.history.titles === 1 ? "" : "s"}` : ""}
          {state.history.finalFour ? ` · ${state.history.finalFour} F4` : ""}
          {" · "}
          {goatLine(state)}
        </p>
      </div>

      <div className="mood-row">
        <Stat label="AD" value={state.adHeat} />
        <Stat label="Fans" value={state.fanMood} />
        <Stat label="Donors" value={state.donorMood} />
      </div>

      {next && opp && (
        <div className="tip-card">
          <p className="tip-kicker">Next tip</p>
          <p className="font-display mt-1 text-3xl leading-none">{opp.name}</p>
          <p className="mt-1 text-sm text-muted">
            {siteWord(next, state.playerTeamId)} · {opp.abbr} · Week {next.week} · {gameKindShort(next.kind)}
          </p>
          {(() => {
            const vs = seriesVs(state, state.playerTeamId, opp.id);
            if (!vs) return null;
            const streak = vs.streak === 0 ? "" : vs.streak > 1 ? ` · ${vs.streak} in a row` : vs.streak < -1 ? ` · ${Math.abs(vs.streak)} losses` : "";
            return (
              <p className="mt-1 text-xs text-muted">
                Series {vs.aWins}-{vs.bWins}
                {vs.last ? ` · last ${vs.last}` : ""}
                {streak}
              </p>
            );
          })()}
        </div>
      )}

      <div className="gym-actions">
        {off ? (
          <button
            type="button"
            className="span-2 min-h-12 rounded-lg bg-accent font-semibold text-accent-fg"
            {...bindTap(carouselOpen ? () => setView("carousel") : stayWaiting ? () => setView("draft") : campOpen ? () => setView("camp") : boardWaiting ? openContract : nextSeason)}
          >
            {carouselOpen ? "Coaching carousel" : stayWaiting ? "Players leaving" : campOpen ? "Training camp" : boardWaiting ? "The AD's waiting" : "Next season"}
          </button>
        ) : state.phase === "preseason" ? (
          <button type="button" className="span-2 min-h-12 rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(() => setView("schedule"))}>
            Customize schedule
          </button>
        ) : (
          <>
            {tipThisWeek ? (
              <>
                <button type="button" className="span-2 min-h-12 rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(playGame)} disabled={seasonRun?.active}>
                  Play tonight
                </button>
                <p className="span-2 text-sm text-muted">
                  Live play-by-play. Tap Start game, then tap a play every time you have the ball. Sim skips all of that.
                </p>
                <button type="button" className="span-2 min-h-12 rounded-lg bg-elevated font-semibold" {...bindTap(simGame)} disabled={seasonRun?.active}>
                  Sim this game
                </button>
              </>
            ) : (
              <p className="span-2 text-sm text-muted">{next ? `Next tip is week ${next.week}. Bye this week.` : "No game on the board this week."}</p>
            )}
            <button type="button" className="span-2 min-h-12 rounded-lg bg-elevated font-semibold" {...bindTap(simWeek)} disabled={seasonRun?.active}>
              Sim week
            </button>
            {seasonRun?.active ? (
              <button type="button" className="span-2 min-h-12 rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(stopSeason)}>
                Stop sim
              </button>
            ) : (
              <button type="button" className="span-2 min-h-12 rounded-lg bg-elevated font-semibold" {...bindTap(simSeason)}>
                Sim season
              </button>
            )}
          </>
        )}
        <button type="button" className="min-h-12 rounded-lg bg-elevated font-semibold" {...bindTap(() => setView("inbox"))}>
          Inbox{unreadMail(state) ? ` (${unreadMail(state)})` : ""}
        </button>
        <button type="button" className="min-h-12 rounded-lg bg-elevated font-semibold" {...bindTap(() => saveNow())}>
          Save now
        </button>
        <button type="button" className="span-2 min-h-12 rounded-lg bg-elevated font-semibold" {...bindTap(() => setView("saves"))}>
          Load game
        </button>
      </div>

      {seasonRun && (
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs tracking-[0.16em] text-muted uppercase">{seasonRun.active ? "Simulating the year" : "Season sim"}</p>
          <p className="font-display mt-1 text-2xl">
            {phaseLabel(state.phase, state.week)}
            {state.phase === "regular" ? ` · ${weekDateLabel(state.season, state.week)}` : ""} · {t.wins}-{t.losses}
          </p>
          {seasonRun.active && (
            <button type="button" className="mt-3 min-h-12 rounded-lg bg-accent px-4 font-semibold text-accent-fg" {...bindTap(stopSeason)}>
              Stop sim
            </button>
          )}
          {seasonRun.lines.length > 0 && (
            <ul className="mt-3">
              {seasonRun.lines.map((line) => (
                <li key={line.id} className="border-t border-border first:border-t-0">
                  <button
                    type="button"
                    className={`min-h-11 w-full text-left text-sm ${line.win ? "text-win" : "text-loss"}`}
                    {...bindTap(() => {
                      if (seasonRun.active) stopSeason();
                      openRecap(line.id, "hub");
                    })}
                  >
                    {line.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="min-h-12 rounded-lg bg-elevated font-semibold" {...bindTap(() => setView("archives"))}>
          Archives
        </button>
        <button type="button" className="min-h-12 rounded-lg bg-elevated font-semibold" {...bindTap(() => setCardOn((v) => !v))}>
          Resume
        </button>
      </div>
      {cardOn && <SeasonCard />}

      {state.phase === "selection" && state.selection && !state.selection.revealed && (
        <div className="tip-card">
          <p className="tip-kicker">Selection Day</p>
          <p className="font-display mt-1 text-2xl">The field is in.</p>
          <button type="button" className="mt-3 min-h-11 rounded-lg bg-accent px-3 font-semibold text-accent-fg" {...bindTap(() => setView("selection"))}>
            Watch Selection Day
          </button>
        </div>
      )}
      {state.phase === "selection" && state.selection?.revealed && (
        <div className="tip-card">
          <p className="tip-kicker">Selection Day</p>
          <p className="font-display mt-1 text-2xl">
            {(() => {
              const bid = state.selection.ncaa.find((b) => b.teamId === state.playerTeamId);
              if (bid) return `${bid.seed} seed · ${bid.region}${bid.playIn ? " · Play-in" : ""}`;
              if (state.selection.nit.includes(state.playerTeamId)) return `${NIT} bid`;
              if (state.selection.crown.includes(state.playerTeamId)) return CBI;
              return "Home for March";
            })()}
          </p>
          <button type="button" className="mt-3 min-h-11 rounded-lg bg-accent px-3 font-semibold text-accent-fg" {...bindTap(() => setView("bracketology"))}>
            Open bracketology
          </button>
        </div>
      )}
      {(state.phase === "ncaa" || state.phase === "nit" || state.phase === "crown" || state.phase === "conference") && (
        <p className="text-sm text-muted">
          {state.phase === "conference" ? "Conference tournament." : state.phase === "ncaa" ? `${NCAA}.` : state.phase === "nit" ? `${NIT}.` : `${CBI}.`}
        </p>
      )}

      {off && <LastRunBanner />}

      {off && state.offseasonReport && (
        <div className="rounded-xl bg-elevated p-4 panel">
          <p className="text-xs tracking-widest text-muted uppercase">Development report</p>
          <p className="font-display mt-1 text-2xl">{state.season} film</p>
          <ul className="mt-3 space-y-1 text-sm">
            {state.offseasonReport.grew.length === 0 && <li className="text-muted">No big jumps this summer.</li>}
            {state.offseasonReport.grew.map((g) => (
              <li key={g.id}>
                {g.name}{" "}
                <span className={g.after > g.before ? "text-win" : "text-loss"}>
                  {g.before} → {g.after}
                </span>
              </li>
            ))}
          </ul>
          {state.offseasonReport.graduated.length > 0 && (
            <p className="mt-3 text-xs text-muted">Out: {state.offseasonReport.graduated.map((g) => g.name).join(", ")}</p>
          )}
          {campOpen && (
            <button type="button" className="mt-3 min-h-11 w-full rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(() => setView("camp"))}>
              Open camp · {campOf(state).points} pts
            </button>
          )}
        </div>
      )}

      <div className="desk-grid">
        <p className="desk-section">The program</p>
        <WatchStrip />
        <ChemistryStrip />
        <ResumeStrip />
        <ProgramStrip />
        <ScoutStrip />
        <ContractStrip />
        <GotdStrip />
        <PotwStrip />
        <RaceStrip />
        <CardStrip />
        <AwardsStrip />
        <ComplianceStrip />
        <AnalyticsStrip />
        <MarketStrip />
        <PlacesStrip />
        <RecordsStrip />
      </div>

      <details
        className="wire-fold"
        ref={(node) => {
          if (!node || node.dataset.wired) return;
          node.dataset.wired = "1";
          node.open = state.history.log.length > 0;
        }}
      >
        <summary>News · stories, podcasts, the Burner</summary>
        <div className="desk-grid">
          <NewsStrip />
          <PodcastStrip />
          <BurnerStrip />
        </div>
      </details>

      <NilStrip />

      {!off && <RecruitingCard />}
      <PortalStrip />

      {!off && (
        <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl bg-elevated px-3 py-3 panel">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-current"
            checked={Boolean(state.cpuRecruit)}
            onChange={(e) => setAssisted(e.target.checked)}
          />
          <span>
            <span className="block font-semibold">Assisted recruiting</span>
          </span>
        </label>
      )}
      {off && portalOpen(state) && (
        <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl bg-elevated px-3 py-3 panel">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-current"
            checked={Boolean(state.cpuRecruit)}
            onChange={(e) => setAssisted(e.target.checked)}
          />
          <span>
            <span className="block font-semibold">Assisted portal</span>
          </span>
        </label>
      )}

      <div className="rounded-xl bg-elevated p-4 panel">
        <p className="text-xs tracking-widest text-muted uppercase">Coach skills · {state.skillPoints ?? 0} pts</p>
        <div className="mt-3 flex flex-col gap-2">
          {COACH_AXES.map((a) => {
            const v = state.coachSkills?.[a.id] ?? 48;
            return (
              <button
                key={a.id}
                type="button"
                disabled={!state.skillPoints}
                {...bindTap(() => spendSkill(a.id))}
                className="rounded-lg bg-bg px-3 py-2 text-left disabled:opacity-60"
              >
                <span className="flex justify-between text-sm font-semibold">
                  <span>{a.label}</span>
                  <span className="tabular-nums">{v}</span>
                </span>
                <span className="interest-bar mt-1 block">
                  <span style={{ width: `${v}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {state.history.log.length > 0 && (
        <div className="rounded-xl bg-elevated p-4 panel">
          <p className="text-xs tracking-widest text-muted uppercase">Banner room</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {state.history.log.slice().reverse().slice(0, 12).map((y) => (
              <li key={y.season} className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{y.season}</span>
                <span className="tabular-nums text-muted">
                  {y.wins}-{y.losses}
                  {y.confTitle ? " · conference" : ""}
                  {y.run ? ` · ${runLabel(y.run)}` : y.ncaaBid ? ` · ${NCAA}` : ""}
                  {y.title && y.run !== "title" ? " · title" : ""}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-3 min-h-11 text-sm font-semibold text-accent" {...bindTap(() => setView("hof"))}>
            Hall of Fame
          </button>
        </div>
      )}

      {state.retired && (
        <div className="rounded-xl bg-elevated p-4 panel">
          <p className="text-xs tracking-widest text-muted uppercase">Retired</p>
          <p className="font-display mt-1 text-2xl">{goatLine(state)}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="mood-cell">
      <p>{label}</p>
      <p>{value}</p>
    </div>
  );
}

function LastRunBanner() {
  const { state } = useGame();
  if (!state) return null;
  const last = state.history.log[state.history.log.length - 1];
  if (!last?.run || last.season !== state.season) return null;
  const label = runLabel(last.run);
  if (!label) return null;
  return (
    <div className="tip-card">
      <p className="tip-kicker">{last.run === "title" ? "Champions" : "March"}</p>
      <p className="font-display mt-1 text-3xl">{label}</p>
      <p className="mt-1 text-sm text-muted">
        {last.wins}-{last.losses}
        {last.confTitle ? " · conference title" : ""}
        {last.poy ? ` · ${last.poy} POY` : ""}
      </p>
    </div>
  );
}

function WatchStrip() {
  const { state, setView } = useGame();
  if (!state?.watch?.length) return null;
  const yours = state.watch.find((w) => w.yours) ?? state.watch[0]!;
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("awards"))}>
      <p className="desk-kicker">Watch list</p>
      <p className="desk-head">{yours.name}</p>
      <p className="desk-note">
        {yours.yours ? "Yours · " : ""}
        {state.watch.length} names on the preseason board
      </p>
    </button>
  );
}

function RecruitingCard() {
  const { state, setView } = useGame();
  if (!state) return null;
  const p = recruitingProgress(state);
  const pct = (n: number) => `${(n / p.spots) * 100}%`;
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(() => setView("recruiting"))}
    >
      <p className="desk-kicker">Class</p>
      <p className="desk-head">
        {p.signed} signed · {p.open} open
      </p>
      <div className="class-fill mt-2" aria-hidden>
        {p.returning > 0 && <i className="ret" style={{ width: pct(p.returning) }} />}
        {p.signed > 0 && <i className="sig" style={{ width: pct(p.signed) }} />}
        {p.paper > 0 && <i className="pap" style={{ width: pct(p.paper) }} />}
      </div>
      <p className="desk-note">
        {p.close} close · {p.leaning} leaning · {p.left} scholarships left
      </p>
    </button>
  );
}

function PortalStrip() {
  const { state, setView } = useGame();
  if (!state || !portalOpen(state)) return null;
  const p = portalOf(state);
  const live = p.transfers.filter((t) => !t.committedTo);
  const yours = live.filter((t) => t.fromId === state.playerTeamId).length;
  const signed = p.transfers.filter((t) => t.committedTo === state.playerTeamId).length;
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(() => setView("recruiting"))}
    >
      <p className="desk-kicker">{p.window === "winter" ? "Winter portal" : "Spring portal"}</p>
      <p className="desk-head">
        {live.length} names · {p.hours}h
      </p>
      <p className="desk-note">
        {yours ? `${yours} of yours in the portal. ` : "None of yours entered. "}
        {signed ? `${signed} signed here.` : "Uses its own hours."}
      </p>
    </button>
  );
}

function ChemistryStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const c = teamChemistry(state, state.playerTeamId);
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(() => setView("roster"))}
    >
      <p className="desk-kicker">Chemistry</p>
      <p className="desk-head">
        {c.score} · {c.label}
      </p>
      <p className="desk-note">{c.note}</p>
    </button>
  );
}

function ResumeStrip() {
  const { state, openRanks } = useGame();
  if (!state || state.phase === "preseason" || state.phase === "offseason") return null;
  const r = resumeOf(state);
  const tag = r.path === "auto" ? "Auto bid" : r.path === "at-large" ? `In as a ${r.seed}` : r.path === "bubble" ? "On the bubble" : r.path === "nit" ? "NIT" : "Outside the field";
  return (
    <button type="button" className="desk-tile" {...bindTap(() => openRanks("bubble"))}>
      <p className="desk-kicker">Résumé</p>
      <p className="desk-head">{tag}</p>
      <p className="desk-note">
        {netReleased(state) ? `NET ${r.net}` : "NET not out"} · KP {r.kenpom}
        {netReleased(state) ? ` · Q1 ${r.q1}` : ""}
        {netReleased(state) && r.quadNext ? ` · next Q${r.quadNext}` : ""} · {netReleased(state) ? r.need : netHoldLine(state.season)}
      </p>
    </button>
  );
}

function ProgramStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const staff = staffTease(state);
  const fac = facilityTease(state);
  const plan = practiceOf(state);
  const hurt = injuredOf(state);
  const load = teamLoad(state);
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("program"))}>
      <p className="desk-kicker">Program</p>
      <p className="desk-head">{staff.head}</p>
      <p className="desk-note">
        {fac.note} · {plan}
        {hurt.length ? ` · ${hurt.length} injured` : ""}
        {load.tired ? ` · ${load.tired} tired` : ""}
      </p>
    </button>
  );
}

function ScoutStrip() {
  const { state, setView, scoutOpp } = useGame();
  if (!state || state.phase === "preseason" || state.phase === "offseason") return null;
  const card = liveScout(state);
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(() => (card ? setView("analytics") : scoutOpp()))}
    >
      <p className="desk-kicker">Scout</p>
      <p className="desk-head">{card ? card.identity : "Scout opponent"}</p>
      <p className="desk-note">{card ? card.keys[0] : "Use a recruiting hour to scout the next opponent."}</p>
    </button>
  );
}

function ContractStrip() {
  const { state, openContract } = useGame();
  if (!state?.contract) return null;
  const review = state.contractReview;
  const live = contractProgress(state);
  const open = live.filter((r) => !r.met).length;
  const title = review && !review.resolved
    ? review.decision === "fire"
      ? "You're out"
      : review.decision === "extend"
      ? "They want you back"
        : "The AD called"
    : `${state.contract.remaining} yr left`;
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(openContract)}
    >
      <p className="desk-kicker">Contract</p>
      <p className="desk-head">{title}</p>
      <p className="desk-note">
        {review && !review.resolved ? review.letter : contractLine(state.contract)}
        {!review && open > 0 ? ` · ${open} clause${open === 1 ? "" : "s"} still open` : ""}
      </p>
    </button>
  );
}

function CardStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const card = state.reportCard;
  const exp = state.expectations;
  if (card) {
    return (
      <button type="button" className="desk-tile" {...bindTap(() => setView("contract"))}>
        <p className="desk-kicker">Season review</p>
        <p className="desk-head">{card.overall} · {card.season}</p>
        <p className="desk-note">{card.letter}</p>
      </button>
    );
  }
  if (!exp) return null;
  const need = state.contract?.clauses.find((c) => c.kind === "wins")?.target;
  const gap = need == null ? null : need - exp.wins;
  return (
    <div className="desk-tile">
      <p className="desk-kicker">Expectations</p>
      <p className="desk-head">{exp.wins} projected{need != null ? ` · ${need} required` : ""}</p>
      <p className="desk-note">
        {need == null
          ? exp.note
          : gap > 0
            ? `Roster projection: ${exp.wins} wins. Contract requirement: ${need}. That's ${gap} above this roster.`
            : gap < 0
              ? `Roster projection: ${exp.wins} wins. Contract requirement: ${need}. This roster is ${-gap} ahead of the job.`
              : `Roster projection: ${exp.wins} wins. That matches the contract.`}
        {exp.ncaa ? " A bid is in range." : ""}
      </p>
    </div>
  );
}

function AwardsStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const mine = yourAwards(state);
  const last = (state.awards ?? []).filter((a) => a.kind === "poy").slice(-1)[0];
  if (!mine.length && !last) return null;
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("awards"))}>
      <p className="desk-kicker">Awards</p>
      <p className="desk-head">{mine.length ? `${mine.length} honor${mine.length === 1 ? "" : "s"}` : last ? last.name : "Lists"}</p>
      <p className="desk-note">{mine[0] ? `${mine[0].name} · ${mine[0].kind}` : last ? `National player of the year · ${last.season}` : "No awards yet."}</p>
    </button>
  );
}

function ComplianceStrip() {
  const { state, setView } = useGame();
  if (!state?.compliance) return null;
  const c = state.compliance;
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(() => setView("compliance"))}
    >
      <p className="desk-kicker">Compliance</p>
      <p className="desk-head">
        APR {c.apr} · {complianceLabel(c)}
      </p>
      <p className="desk-note">{complianceNote(state)}</p>
    </button>
  );
}

function AnalyticsStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const tape = teamTape(state, state.playerTeamId);
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(() => setView("analytics"))}
    >
      <p className="desk-kicker">Stats</p>
      <p className="desk-head">
        {tape.kp ? `${tape.kp.adjEM >= 0 ? "+" : ""}${tape.kp.adjEM.toFixed(1)} AdjEM` : "Advanced"}
      </p>
      <p className="desk-note">{tapeLine(tape)}</p>
    </button>
  );
}

function MarketStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const next = nextYourGame(state);
  const line = next ? hangLine(state, next) : null;
  const home = line ? TEAM_BY_ID[line.homeId] : null;
  const away = line ? TEAM_BY_ID[line.awayId] : null;
  const fav = line && home && away ? spreadText(line.homeSpread, home.abbr, away.abbr) : null;
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(() => setView("market"))}
    >
      <p className="desk-kicker">Betting odds</p>
      <p className="desk-head">
        {fav && line ? `${fav} · ${mlLabel(line.mlHome)} / ${mlLabel(line.mlAway)}` : "Lines"}
      </p>
      <p className="desk-note">{line ? `O/U ${line.total} · ${Math.round(line.pHome * 100)}% home` : "Spread, moneyline, total"}</p>
    </button>
  );
}

function NewsStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const a = state.news[0];
  return (
    <button
      type="button"
      className="desk-tile"
      {...bindTap(() => setView("news"))}
    >
      <p className="desk-kicker">{a?.kicker === "Takes" ? "Takes" : "News"}</p>
      <p className="desk-head">{a?.headline ?? "No stories yet"}</p>
      <p className="desk-note">{a ? `${outletLabel(a.outlet)} · ${a.kicker}` : "Nothing new."}</p>
    </button>
  );
}

function PodcastStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const tease = podcastTease(state);
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("podcasts"))}>
      <p className="desk-kicker">Podcasts</p>
      <p className="desk-head">{tease.head}</p>
      <p className="desk-note">{tease.note}</p>
    </button>
  );
}

function PlacesStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const tease = gymTease(state);
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("places"))}>
      <p className="desk-kicker">Toughest places</p>
      <p className="desk-head">{tease.head}</p>
      <p className="desk-note">{tease.note}</p>
    </button>
  );
}

function RecordsStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const tease = rivalryTease(state);
  const book = state.recordBook;
  const line = book && book.allW + book.allL > 0 ? `This job ${book.allW}-${book.allL}` : tease.note;
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("records"))}>
      <p className="desk-kicker">Record book</p>
      <p className="desk-head">{tease.head}</p>
      <p className="desk-note">{line}</p>
    </button>
  );
}

function BurnerStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const tease = burnerTease(state);
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("burner"))}>
      <p className="desk-kicker">The Burner</p>
      <p className="desk-head">{tease.head}</p>
      <p className="desk-note">{tease.note}</p>
    </button>
  );
}

function NilStrip() {
  const { state, answerNil, setView } = useGame();
  if (!state || !settingsOf(state).nilOn) return null;
  const open = (state.nilAsks ?? []).filter((a) => !a.resolved);
  const donor = (state.donors ?? [])[0];
  if (!open.length && !donor) return null;
  return (
    <div className="rounded-xl bg-elevated p-4 panel">
      <p className="desk-kicker">NIL</p>
      <p className="font-display mt-1 text-2xl">Pool {state.nilCap}</p>
      {donor && (
        <p className="mt-1 text-xs text-muted">
          {donor.name} moved {donor.gift >= 0 ? "+" : ""}
          {donor.gift}. Cap sits at {state.nilCap}.
        </p>
      )}
      {open.map((a) => (
        <div key={a.playerId} className="mt-3">
          <p className="text-sm font-semibold">
            {a.name} wants {a.ask}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className="min-h-11 rounded-lg bg-accent text-sm font-semibold text-accent-fg" {...bindTap(() => answerNil(a.playerId, true))}>
              Pay it
            </button>
            <button type="button" className="min-h-11 rounded-lg bg-bg text-sm font-semibold" {...bindTap(() => answerNil(a.playerId, false))}>
              Pass
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="mt-3 min-h-11 text-sm font-semibold text-accent" {...bindTap(() => setView("settings"))}>
        NIL settings
      </button>
    </div>
  );
}

function GotdStrip() {
  const { state, setView } = useGame();
  if (!state || state.phase === "preseason" || state.phase === "offseason") return null;
  const g = gameOfDay(state);
  if (!g) return null;
  const home = TEAM_BY_ID[g.homeId];
  const away = TEAM_BY_ID[g.awayId];
  const res = state.results.find((r) => r.slotId === g.id);
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("news"))}>
      <p className="desk-kicker">Game of the week</p>
      <p className="desk-head">
        {away?.abbr ?? "AWAY"} at {home?.abbr ?? "HOME"}
      </p>
      <p className="desk-note">
        {res ? `${res.awayScore}–${res.homeScore} final` : `Week ${g.week} · national TV`}
      </p>
    </button>
  );
}

function PotwStrip() {
  const { state, setView } = useGame();
  if (!state) return null;
  const p = (state.potw ?? [])[0];
  if (!p) return null;
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("awards"))}>
      <p className="desk-kicker">Player of the week</p>
      <p className="desk-head">{p.name}</p>
      <p className="desk-note">
        {p.line}
        {p.yours ? " · yours" : ` · ${TEAM_BY_ID[p.teamId]?.abbr ?? ""}`}
      </p>
    </button>
  );
}

function RaceStrip() {
  const { state, setView } = useGame();
  if (!state || state.phase === "preseason" || state.phase === "offseason") return null;
  const race = awardRace(state, 3);
  if (!race.length) return null;
  const lead = race[0]!;
  return (
    <button type="button" className="desk-tile" {...bindTap(() => setView("awards"))}>
      <p className="desk-kicker">Watch list</p>
      <p className="desk-head">{lead.name}</p>
      <p className="desk-note">
        {lead.ppg.toFixed(1)} PPG · projection
        {lead.yours ? " · yours" : ` · ${TEAM_BY_ID[lead.teamId]?.abbr ?? ""}`}
      </p>
    </button>
  );
}

function SeasonCard() {
  const { state } = useGame();
  const [note, setNote] = useState("");
  if (!state) return null;
  const md = seasonReport(state);
  return (
    <div className="rounded-xl border border-border bg-elevated p-4">
      <p className="text-xs tracking-[0.18em] text-muted uppercase">Resume</p>
      <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{md}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg"
          {...bindTap(() => {
            void navigator.clipboard?.writeText(md).then(() => setNote("Copied. Paste it anywhere.")).catch(() => setNote(md));
          })}
        >
          Copy
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg bg-bg px-3 text-sm font-semibold"
          {...bindTap(() => downloadText(`dribble-${state.season}-resume.md`, md, "text/markdown"))}
        >
          Download
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}

