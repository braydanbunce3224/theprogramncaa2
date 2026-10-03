import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { TEAM_BY_ID, TEAMS, GUESTS, teamOf } from "@/game/teams";
import { MTES, canAddGame, gamesInWeek, mteGameCount, resultFor, yourGames, gameQuad } from "@/game/engine";
import { MAX_GAMES, MAX_PER_WEEK, REGULAR_WEEKS } from "@/game/types";
import type { GameSlot, GameState, Site } from "@/game/types";
import { bindTap } from "@/lib/tap";
import { gameKindShort, siteWord } from "@/game/brand";
import { rivalryForSlot } from "@/game/rivalry";
import { netReleased, weekDateLabel } from "@/game/calendar";

const KIND: Record<GameSlot["kind"], string> = {
  conference: gameKindShort("conference"),
  noncon: gameKindShort("noncon"),
  mte: gameKindShort("mte"),
  "conf-tourney": gameKindShort("conf-tourney"),
  ncaa: gameKindShort("ncaa"),
  nit: gameKindShort("nit"),
  crown: gameKindShort("crown"),
};

function siteTag(g: GameSlot, you: string) {
  return siteWord(g, you);
}

function pickWeek(w: number, setWeek: (n: number) => void) {
  setWeek(w);
  requestAnimationFrame(() => {
    document.getElementById("sked-add")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function GameTile({
  g,
  state,
  locked,
  onDrop,
  onRecap,
}: {
  g: GameSlot;
  state: GameState;
  locked: boolean;
  onDrop: (id: string) => void;
  onRecap: (id: string) => void;
}) {
  const you = state.playerTeamId;
  const oppId = g.homeId === you ? g.awayId : g.homeId;
  const opp = teamOf(oppId);
  const res = resultFor(state, g);
  const youHome = g.homeId === you;
  const youScore = res ? (youHome ? res.homeScore : res.awayScore) : null;
  const oppScore = res ? (youHome ? res.awayScore : res.homeScore) : null;
  const won = youScore != null && oppScore != null ? youScore > oppScore : null;
  const where = siteTag(g, you);
  const rival = rivalryForSlot(g);
  const quad = locked && netReleased(state) ? gameQuad(state, g, you) : null;
  return (
    <div className={`cal-game ${g.declined ? "is-declined" : ""} ${won === true ? "is-win" : won === false ? "is-loss" : ""} ${res ? "is-final" : ""}`}>
      <div className="cal-game-top">
        <span className="cal-site">{where}</span>
        <span className="cal-opp">{opp?.abbr ?? opp?.name ?? "TBD"}</span>
        <span className="cal-kind">{g.cup ? `${g.cup} cup` : quad ? `Q${quad}` : rival ? rival.trophy : KIND[g.kind]}</span>
      </div>
      <p className="cal-name">{opp?.name ?? "Opponent"}</p>
      {g.declined ? (
        <p className="cal-score is-muted">Declined</p>
      ) : res && youScore != null && oppScore != null ? (
        <button type="button" className="cal-score cal-recap-btn" {...bindTap(() => onRecap(res.id))}>
          <span className={won ? "text-win" : "text-loss"}>{won ? "W" : "L"}</span>
          <span className="cal-nums">
            {youScore}–{oppScore}
          </span>
          <span className="cal-recap-hint">Recap</span>
        </button>
      ) : (
        <p className="cal-score is-muted">{locked ? "Not played" : "Upcoming"}</p>
      )}
      {!locked && g.kind !== "conference" && (
        <button type="button" className="cal-drop" onClick={() => onDrop(g.id)}>
          Drop
        </button>
      )}
    </div>
  );
}

export function ScheduleView() {
  const { state, addGame, drop, join, lock, openRecap, inviteCup } = useGame();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"name" | "rating">("rating");
  const [week, setWeek] = useState(1);
  const [site, setSite] = useState<Site>("home");
  const yours = useMemo(
    () => (state ? yourGames(state).sort((a, b) => a.week - b.week || a.id.localeCompare(b.id)) : []),
    [state],
  );
  const byWeek = useMemo(() => {
    const map = new Map<number, GameSlot[]>();
    for (const g of yours) {
      const list = map.get(g.week) ?? [];
      list.push(g);
      map.set(g.week, list);
    }
    return map;
  }, [yours]);
  const opps = useMemo(() => {
    if (!state) return [];
    const taken = new Set(yours.flatMap((g) => [g.homeId, g.awayId]));
    let list = TEAMS.filter((t) => t.id !== state.playerTeamId && !taken.has(t.id));
    const query = q.trim().toLowerCase();
    if (query) list = list.filter((t) => t.name.toLowerCase().includes(query) || t.city.toLowerCase().includes(query));
    if (sort === "rating") list = [...list].sort((a, b) => b.prestige - a.prestige);
    else list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list.slice(0, 40);
  }, [q, sort, yours, state]);
  if (!state) return null;
  const you = state.teams[state.playerTeamId];
  if (!you) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl">Missing team</h1>
        <p className="text-sm text-muted">This save has no office. Load another save or start a new job.</p>
      </div>
    );
  }
  const live = yours.filter((g) => !g.declined);
  const extraWeeks = [...byWeek.keys()].filter((w) => w > REGULAR_WEEKS).sort((a, b) => a - b);
  const weekCount = gamesInWeek(state, week).length;
  const locked = state.phase !== "preseason";
  const addErr = (id: string) => canAddGame(state, id, week, site);
  const finals = live.filter((g) => g.resultId).length;
  const openLeft = MAX_GAMES - live.length;

  const fillBlock = !locked && (
    <>
      <div>
        <h2 className="font-display text-2xl">Holiday events</h2>
        <p className="mt-1 text-xs text-muted">
          Classics count toward the 30. 8-team fields play 3, 4-team fields play 2 — that week, neutral. Joining takes the week; we'll bump non-con if we have to.
        </p>
        <ul className="mt-2 space-y-2">
          {MTES.map((m) => {
            const inIt = yours.some((g) => g.kind === "mte" && g.id.startsWith(`mte-${m.id}-`));
            const games = mteGameCount(m);
            const tooSmall = you.prestige < m.minPrestige;
            const hard = gamesInWeek(state, m.week).filter((g) => g.kind === "conference" || g.kind === "mte").length;
            const weekBlocked = hard + games > MAX_PER_WEEK && !inIt;
            const droppable = yours.filter((g) => !g.declined && g.kind === "noncon").length;
            const noRoom = live.length - droppable + games > MAX_GAMES && !inIt;
            return (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-elevated px-3 py-2">
                <span>
                  <span className="block font-semibold">{m.name}</span>
                  <span className="text-xs text-muted">
                    {m.site} · {weekDateLabel(state.season, m.week)} · {games} games · min {m.minPrestige}
                    {tooSmall ? " · rating short" : weekBlocked ? " · week taken" : noRoom ? " · no room in 30" : ""}
                  </span>
                </span>
                {inIt ? (
                  <span className="text-xs font-semibold text-win">In · counts in 30</span>
                ) : (
                  <button
                    type="button"
                    disabled={tooSmall || weekBlocked || noRoom}
                    {...bindTap(() => join(m.id))}
                    className="min-h-10 rounded-full bg-accent px-3 text-xs font-bold text-accent-fg disabled:opacity-40"
                  >
                    Join
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div id="sked-add">
        <h2 className="font-display text-2xl">Add a game</h2>
        <p className="mt-1 text-sm text-muted">
          Week {week} · {site === "home" ? "Home" : site === "away" ? "Away" : "Neutral"}
          {weekCount >= MAX_PER_WEEK ? " · this week is full" : ` · ${MAX_PER_WEEK - weekCount} open`}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={`h-10 rounded-full px-3 text-sm font-semibold ${sort === "rating" ? "bg-accent text-accent-fg" : "bg-elevated"}`} onClick={() => setSort("rating")}>
            Sort by rating
          </button>
          <button type="button" className={`h-10 rounded-full px-3 text-sm font-semibold ${sort === "name" ? "bg-accent text-accent-fg" : "bg-elevated"}`} onClick={() => setSort("name")}>
            Sort by name
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <select className="h-11 flex-1 rounded-lg border border-border bg-elevated px-2" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {Array.from({ length: REGULAR_WEEKS }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w} · {weekDateLabel(state.season, w)} ({gamesInWeek(state, w).length}/{MAX_PER_WEEK})
              </option>
            ))}
          </select>
          <select className="h-11 w-28 rounded-lg border border-border bg-elevated px-2" value={site} onChange={(e) => setSite(e.target.value as Site)}>
            <option value="home">Home</option>
            <option value="away">Away</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
        {weekCount >= MAX_PER_WEEK && <p className="mt-2 text-sm text-loss">Week {week} is full.</p>}
        <input className="mt-3 h-12 w-full rounded-lg border border-border bg-elevated px-3" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a school…" />
        <ul className="mt-2">
          {opps.map((t) => {
            const gap = t.prestige - you.prestige;
            const err = addErr(t.id);
            return (
              <li key={t.id} className="flex items-center gap-2 border-b border-border py-2">
                <span className="flex-1">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="text-xs text-muted">
                    Rating {t.prestige}
                    {gap > 8 ? " · may decline" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={Boolean(err)}
                  onClick={() => addGame(t.id, site, week)}
                  className="min-h-10 rounded-full bg-accent px-3 text-xs font-bold text-accent-fg disabled:opacity-40"
                >
                  Add
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-6">
          <h2 className="font-display text-2xl">Exhibition boards</h2>
          <p className="mt-1 text-sm text-muted">D2, D3, and NAIA guests play home cup games. They are not Division I and they do not join a conference.</p>
          {(["D2", "D3", "NAIA"] as const).map((div) => (
            <div key={div} className="mt-3">
              <p className="text-xs tracking-[0.18em] text-muted uppercase">{div}</p>
              <ul className="mt-1">
                {GUESTS.filter((g) => g.div === div).map((g) => (
                  <li key={g.id} className="flex items-center gap-2 border-b border-border py-2">
                    <span className="flex-1">
                      <span className="block font-semibold">{g.name}</span>
                      <span className="text-xs text-muted">{g.city} · {g.mascot}</span>
                    </span>
                    <button type="button" className="min-h-11 rounded-full bg-elevated px-3 text-xs font-bold" {...bindTap(() => inviteCup(g.id))}>
                      Invite
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-3xl">{locked ? "Schedule" : "Customize schedule"}</h1>
        <p className="mt-1 text-sm text-muted">
          {live.length}/{MAX_GAMES} games
          {live.some((g) => g.kind === "mte")
            ? ` · ${live.filter((g) => g.kind === "mte").length} classic`
            : ""}
          {" · "}
          {finals} final{finals === 1 ? "" : "s"}
          {finals ? " · tap a score for the recap" : ""}
          {!locked && openLeft > 0 ? ` · staff fills the other ${openLeft}` : ""}
        </p>
        {!locked && (
          <p className="mt-1 text-sm text-muted">Tap an open week, then pick a school. Or add from the list below.</p>
        )}
      </div>

      {!locked && (
        <button type="button" className="min-h-12 rounded-lg bg-accent font-semibold text-accent-fg" {...bindTap(lock)}>
          {live.length >= MAX_GAMES ? "Begin season" : `Begin season · staff fills ${openLeft}`}
        </button>
      )}

      <div className="cal-grid">
        {Array.from({ length: REGULAR_WEEKS }, (_, i) => i + 1).map((w) => {
          const games = byWeek.get(w) ?? [];
          const liveHere = games.filter((g) => !g.declined).length;
          const current = locked && state.week === w;
          const picking = !locked && week === w;
          const canSlot = !locked && liveHere < MAX_PER_WEEK;
          return (
            <section key={w} className={`cal-week ${current ? "is-now" : ""} ${picking ? "is-pick" : ""} ${games.length ? "" : "is-empty"}`}>
              <header className="cal-week-h">
                <span>Week {w} · {weekDateLabel(state.season, w)}</span>
                <span className="cal-week-n">{liveHere}</span>
              </header>
              {games.length ? (
                <>
                  {games.map((g) => (
                    <GameTile key={g.id} g={g} state={state} locked={locked} onDrop={drop} onRecap={(id) => openRecap(id, "schedule")} />
                  ))}
                  {canSlot && (
                    <button type="button" className="cal-add-week" {...bindTap(() => pickWeek(w, setWeek))}>
                      Add a game
                    </button>
                  )}
                </>
              ) : locked ? (
                <p className="cal-open">Off</p>
              ) : (
                <button type="button" className="cal-open-btn" {...bindTap(() => pickWeek(w, setWeek))}>
                  Add a game
                </button>
              )}
            </section>
          );
        })}
      </div>

      {extraWeeks.length > 0 && (
        <div>
          <h2 className="font-display text-2xl">Postseason</h2>
          <div className="cal-grid cal-grid-post mt-3">
            {extraWeeks.map((w) => (
              <section key={w} className={`cal-week ${state.week === w ? "is-now" : ""}`}>
                <header className="cal-week-h">
                  <span>Week {w} · {weekDateLabel(state.season, w)}</span>
                </header>
                {(byWeek.get(w) ?? []).map((g) => (
                  <GameTile key={g.id} g={g} state={state} locked={locked} onDrop={drop} onRecap={(id) => openRecap(id, "schedule")} />
                ))}
              </section>
            ))}
          </div>
        </div>
      )}

      {fillBlock}
    </div>
  );
}
