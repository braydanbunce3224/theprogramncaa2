import { Fragment, useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { TEAM_BY_ID } from "@/game/teams";
import { leagueName } from "@/game/align";
import { apPoll, kenpom, netCutoff, netRanks, netBoardLine, recOf, teamLabel, resumeOf, remainingSos, bubbleLists, espnField, teamSheet, type RankKind, type SheetGame } from "@/game/ranks";
import { netHoldLine, netReleased } from "@/game/calendar";
import { toughestPlaces } from "@/game/gym";
import { bindTap } from "@/lib/tap";

export function RanksView({ start }: { start?: RankKind } = {}) {
  const { state, view, ranksTab, focusTeamId } = useGame();
  const [tab, setTab] = useState<RankKind>(start ?? ranksTab ?? (view === "places" ? "places" : "league"));
  const [q, setQ] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(focusTeamId);
  if (!state) return null;
  const openSheet = (id: string) => {
    setSheetId(id);
    setQ("");
    setTab("sheet");
  };
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="font-display text-3xl">{tab === "places" ? "Toughest places" : "Ranks"}</h1>
        <p className="mt-1 text-sm text-muted">
          {tab === "places"
            ? "Historical home court, then whatever this dynasty actually does in those gyms."
            : tab === "sheet"
              ? netReleased(state)
                ? "NET team sheet. Quadrants and opponent rank refresh after every game."
                : netHoldLine(state.season)
              : "Conference standings, NET, KenPom, the AP Poll, the bubble, and the gyms."}
        </p>
      </div>
      <div className="chip-row">
        {([
          ["league", "Conference"],
          ["net", "NET"],
          ["sheet", "Sheet"],
          ["kenpom", "KenPom"],
          ["ap", "AP Poll"],
          ["bubble", "Bubble"],
          ["places", "Places"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${tab === id ? "bg-accent text-accent-fg" : "bg-elevated"}`}
            {...bindTap(() => setTab(id))}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        className="h-11 rounded-lg border border-border bg-elevated px-3 text-sm"
        placeholder={tab === "places" ? "Find a gym" : tab === "sheet" ? "Open a school" : "Find a team"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {tab === "league" && <LeagueBoard q={q} />}
      {tab === "net" && <NetBoard q={q} onSheet={openSheet} />}
      {tab === "sheet" && <TeamSheetBoard q={q} sheetId={sheetId} onPick={openSheet} />}
      {tab === "kenpom" && <KenpomBoard q={q} />}
      {tab === "ap" && <ApBoard q={q} />}
      {tab === "bubble" && <BubbleBoard q={q} />}
      {tab === "places" && <PlacesBoard q={q} />}
    </div>
  );
}

function TeamCell({ id, mascot }: { id: string; mascot?: boolean }) {
  const { openTeam } = useGame();
  return (
    <button type="button" className="text-left font-semibold" {...bindTap(() => openTeam(id))}>
      {teamLabel(id, mascot)}
    </button>
  );
}

function matchQ(id: string, q: string) {
  if (!q.trim()) return true;
  const t = TEAM_BY_ID[id];
  const s = q.trim().toLowerCase();
  return Boolean(t && (`${t.name} ${t.mascot} ${t.abbr} ${t.conference}`).toLowerCase().includes(s));
}

function LeagueBoard({ q }: { q: string }) {
  const { state } = useGame();
  const you = state?.playerTeamId;
  const confId = you && state ? state.teams[you]?.conference : undefined;
  const rows = useMemo(() => {
    if (!state || !confId) return [];
    return Object.values(state.teams)
      .filter((t) => t.conference === confId)
      .sort((a, b) => b.confW - a.confW || b.wins - a.wins || b.confL - a.confL);
  }, [state, confId]);
  if (!state || !confId) return null;
  const shown = rows.filter((t) => matchQ(t.id, q));
  const league = leagueName(confId, state.season);
  return (
    <div className="rank-board rank-bo">
      <div className="bo-top">
        <p className="bo-brand">{league}</p>
        <p className="bo-sub">{confId === "IND" ? "No conference games · at-large in March" : `Conference standings · ${rows.length} schools · Week ${state.week}`}</p>
      </div>
      <div className="rank-scroller">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Conf</th>
              <th>Overall</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} className={t.id === you ? "you" : undefined}>
                <td>{rows.indexOf(t) + 1}</td>
                <td><TeamCell id={t.id} /></td>
                <td className="tabular-nums">{t.confW}-{t.confL}</td>
                <td className="tabular-nums">{recOf(state, t.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NetBoard({ q, onSheet }: { q: string; onSheet: (id: string) => void }) {
  const { state } = useGame();
  const rows = useMemo(() => (state && netReleased(state) ? netRanks(state) : []), [state]);
  if (!state) return null;
  if (!netReleased(state)) {
    return (
      <div className="rank-board rank-bo">
        <div className="bo-top">
          <p className="bo-brand">NET Rankings</p>
          <p className="bo-sub">{netHoldLine(state.season)}</p>
        </div>
      </div>
    );
  }
  const you = state.playerTeamId;
  const cut = netCutoff(rows);
  const shown = rows.filter((r) => matchQ(r.id, q));
  return (
    <div className="rank-board rank-bo">
      <div className="bo-top">
        <p className="bo-brand">NET Rankings</p>
        <p className="bo-sub">{netBoardLine(state)}</p>
      </div>
      <div className="rank-scroller">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Record</th>
            <th>Q1</th>
            <th>Q2</th>
            <th>Q3</th>
            <th>Q4</th>
            <th>Non-D1</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <Fragment key={r.id}>
              {r.rank === cut + 1 && !q.trim() && (
                <tr className="bo-cut">
                  <td colSpan={8}>NCAA Tournament cutoff · last at-large is NET {cut}</td>
                </tr>
              )}
              <tr id={`net-${r.id}`} className={r.id === you ? "you" : undefined}>
                <td className="tabular-nums">
                  {r.rank}
                  {r.prevRank !== r.rank && (
                    <span className={`prev ${r.prevRank > r.rank ? "up" : "down"}`}>
                      {r.prevRank} {r.prevRank > r.rank ? "▲" : "▼"}
                    </span>
                  )}
                </td>
                <td>
                  <TeamCell id={r.id} mascot />
                  <button type="button" className="ml-2 text-xs font-semibold text-accent" {...bindTap(() => onSheet(r.id))}>
                    Sheet
                  </button>
                </td>
                <td className="tabular-nums">{r.wins}-{r.losses}</td>
                <td className="tabular-nums">{r.q1w}-{r.q1l}</td>
                <td className="tabular-nums">{r.q2w}-{r.q2l}</td>
                <td className="tabular-nums">{r.q3w}-{r.q3l}</td>
                <td className="tabular-nums">{r.q4w}-{r.q4l}</td>
                <td className="tabular-nums">{r.nonD1w}-{r.nonD1l}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function KenpomBoard({ q }: { q: string }) {
  const { state } = useGame();
  const rows = useMemo(() => (state ? kenpom(state) : []), [state]);
  if (!state) return null;
  const you = state.playerTeamId;
  const shown = rows.filter((r) => matchQ(r.id, q));
  const em = (n: number, d = 2) => `${n > 0 ? "+" : ""}${n.toFixed(d)}`;
  const luck = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(3)}`;
  return (
    <div className="rank-board rank-kp">
      <div className="kp-top">
        <p className="kp-brand">KenPom</p>
      </div>
      <p className="kp-title">{state.season} Adjusted college basketball ratings</p>
      <p className="kp-meta">
        Adjusted to average D-I on a neutral floor. Recent games weighted more. Through week {state.week} ({state.results.length} games) · {rows.length} teams
      </p>
      <div className="rank-scroller">
      <table>
        <thead>
          <tr>
            <th>Rk</th>
            <th>Team</th>
            <th>Conf</th>
            <th className="num">W-L</th>
            <th className="num">AdjEM</th>
            <th className="num">AdjO</th>
            <th className="num">AdjD</th>
            <th className="num">AdjT</th>
            <th className="num">Luck</th>
            <th className="num">SOS</th>
            <th className="num">OppO</th>
            <th className="num">OppD</th>
            <th className="num">NCSOS</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} id={`kp-${r.id}`} className={r.id === you ? "you" : undefined}>
              <td className="tabular-nums">{r.rank}</td>
              <td className="kp-name"><TeamCell id={r.id} /></td>
              <td>{r.conf}</td>
              <td className="num tabular-nums">{r.wins}-{r.losses}</td>
              <td className="num tabular-nums">{em(r.adjEM)}</td>
              <td className="num tabular-nums">{r.adjO.toFixed(1)}<span className="sub">{r.adjORank}</span></td>
              <td className="num tabular-nums">{r.adjD.toFixed(1)}<span className="sub">{r.adjDRank}</span></td>
              <td className="num tabular-nums">{r.adjT.toFixed(1)}<span className="sub">{r.adjTRank}</span></td>
              <td className="num tabular-nums">{luck(r.luck)}<span className="sub">{r.luckRank}</span></td>
              <td className="num tabular-nums">{em(r.sosEM)}<span className="sub">{r.sosRank}</span></td>
              <td className="num tabular-nums">{r.oppO.toFixed(1)}<span className="sub">{r.oppORank}</span></td>
              <td className="num tabular-nums">{r.oppD.toFixed(1)}<span className="sub">{r.oppDRank}</span></td>
              <td className="num tabular-nums">{em(r.ncsos)}<span className="sub">{r.ncsosRank}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function ApBoard({ q }: { q: string }) {
  const { state } = useGame();
  const rows = useMemo(() => (state ? apPoll(state) : []), [state]);
  if (!state) return null;
  const you = state.playerTeamId;
  const shown = rows.filter((r) => matchQ(r.id, q));
  return (
    <div className="rank-board rank-ap">
      <div className="flex items-end justify-between px-3 pt-3 pb-2">
        <p className="text-xs font-bold tracking-[0.22em] text-ap-gold">AP POLL</p>
        <p className="text-xs text-ap-fg/70">Men's basketball · {rows.length} teams</p>
      </div>
      <div className="rank-scroller">
      <table>
        <thead>
          <tr>
            <th>Rk</th>
            <th>Team</th>
            <th>Rec</th>
            <th>Pts</th>
            <th>1st</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <Fragment key={r.id}>
              {r.rank === 26 && !q.trim() && (
                <tr className="ap-cut">
                  <td colSpan={5}>Others receiving votes</td>
                </tr>
              )}
              {r.rank === 41 && !q.trim() && (
                <tr className="ap-cut">
                  <td colSpan={5}>Unranked ballot</td>
                </tr>
              )}
              <tr id={`ap-${r.id}`} className={r.id === you ? "you" : undefined}>
                <td className="tabular-nums">{r.rank}</td>
                <td className="font-semibold"><TeamCell id={r.id} /></td>
                <td className="tabular-nums">{recOf(state, r.id)}</td>
                <td className="tabular-nums">{r.points || "—"}</td>
                <td className="tabular-nums">{r.first || "—"}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function BubbleBoard({ q }: { q: string }) {
  const { state } = useGame();
  if (!state) return null;
  const you = state.playerTeamId;
  const card = resumeOf(state);
  const sos = remainingSos(state);
  const netLive = netReleased(state);
  const net = netLive ? netRanks(state) : [];
  const field = espnField(state);
  const lists = bubbleLists(state, field, netLive ? net : kenpom(state));
  const shown = net.filter((r) => matchQ(r.id, q)).slice(0, 80);
  const pathLine = card.path === "auto" ? "Auto bid" : card.path === "at-large" ? `At-large · ${card.seed} seed` : card.path === "bubble" ? "On the bubble" : card.path === "nit" ? "NIT range" : "Out of the picture";
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Your résumé</p>
        <p className="font-display mt-1 text-2xl">{pathLine}</p>
        <p className="mt-1 text-sm text-muted">{card.need}</p>
        <p className="mt-2 text-xs text-muted">
          {netLive ? `NET ${card.net}` : "NET not out"} · KenPom {card.kenpom}
          {card.ap && card.ap <= 25 ? ` · AP ${card.ap}` : ""} · SOS {card.sosRank}
        </p>
        <p className="mt-1 text-xs text-muted">
          {netLive
            ? `Q1 ${card.q1} · Q2 ${card.q2} · Q3 ${card.q3} · Q4 ${card.q4}${sos.n ? ` · left ${sos.n} (Q1 ${sos.q1} · Q2 ${sos.q2})` : ""}`
            : netHoldLine(state.season)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <BubbleCol title="Last four in" ids={lists.lastFourIn} stateYou={you} />
        <BubbleCol title="First four out" ids={lists.firstFourOut} stateYou={you} />
        <BubbleCol title="Next four out" ids={lists.nextFourOut} stateYou={you} />
      </div>
      <div className="rank-board rank-bo">
        <div className="bo-top">
          <p className="bo-brand">Bubble board</p>
          <p className="bo-sub">{netLive ? `NET order · last four in live near the cutoff · Week ${state.week}` : netHoldLine(state.season)}</p>
        </div>
        <div className="rank-scroller">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Record</th>
                <th>Q1</th>
                <th>Q2</th>
                <th>Q4</th>
              </tr>
            </thead>
            <tbody>
              {netLive ? shown.map((r) => (
                <tr key={r.id} className={r.id === you ? "you" : undefined}>
                  <td className="tabular-nums">{r.rank}</td>
                  <td><TeamCell id={r.id} /></td>
                  <td className="tabular-nums">{r.wins}-{r.losses}</td>
                  <td className="tabular-nums">{r.q1w}-{r.q1l}</td>
                  <td className="tabular-nums">{r.q2w}-{r.q2l}</td>
                  <td className="tabular-nums">{r.q4w}-{r.q4l}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6}>No NET board yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BubbleCol({ title, ids, stateYou }: { title: string; ids: string[]; stateYou: string }) {
  return (
    <div className="rounded-xl border border-border bg-elevated p-3">
      <p className="text-[11px] tracking-[0.16em] text-muted uppercase">{title}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {ids.length ? ids.map((id) => (
          <li key={id} className={id === stateYou ? "font-semibold text-accent" : ""}>
            <TeamCell id={id} />
          </li>
        )) : <li className="text-xs text-muted">Too early.</li>}
      </ul>
    </div>
  );
}

function streakMark(n: number) {
  if (n > 0) return `W${n}`;
  if (n < 0) return `L${Math.abs(n)}`;
  return "—";
}

function PlacesBoard({ q }: { q: string }) {
  const { state } = useGame();
  const rows = useMemo(() => (state ? toughestPlaces(state) : []), [state]);
  if (!state) return null;
  const you = state.playerTeamId;
  const s = q.trim().toLowerCase();
  const shown = s
    ? rows.filter((r) => `${r.gym} ${r.school} ${r.abbr}`.toLowerCase().includes(s))
    : rows;
  const homeGames = rows.reduce((n, r) => n + r.seasonW + r.seasonL, 0);
  return (
    <div className="rank-board rank-places">
      <div className="places-top">
        <p className="places-brand">Toughest places to play</p>
        <p className="places-sub">
          Historical home court, then this dynasty's actual nights in the gym · {state.season} · week {state.week} · {homeGames} home games in
        </p>
      </div>
      <div className="rank-scroller">
        <table>
          <thead>
            <tr>
              <th>Rk</th>
              <th>Gym</th>
              <th>School</th>
              <th className="num">Streak</th>
              <th className="num">Season</th>
              <th className="num">Career</th>
              <th className="num">HCA</th>
              <th className="num">Marg</th>
              <th>Last</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} id={`gym-${r.id}`} className={r.id === you ? "you" : undefined}>
                <td className="tabular-nums">{r.rank}</td>
                <td>
                  <span className="places-gym">{r.gym}</span>
                  <span className="places-note">{r.note}</span>
                </td>
                <td>{r.school}</td>
                <td className={`num tabular-nums ${r.streak > 0 ? "is-hot" : r.streak < 0 ? "is-cold" : ""}`}>
                  {streakMark(r.streak)}
                </td>
                <td className="num tabular-nums">
                  {r.seasonW}-{r.seasonL}
                </td>
                <td className="num tabular-nums">
                  {r.careerW}-{r.careerL}
                </td>
                <td className="num tabular-nums">+{r.hca.toFixed(1)}</td>
                <td className="num tabular-nums">
                  {r.seasonW + r.seasonL > 0
                    ? `${r.margin >= 0 ? "+" : ""}${r.margin.toFixed(1)}`
                    : r.careerW + r.careerL > 0
                      ? `${r.careerMargin >= 0 ? "+" : ""}${r.careerMargin.toFixed(1)}`
                      : "—"}
                </td>
                <td className="tabular-nums">{r.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SheetRow({ g, onPick }: { g: SheetGame; onPick: (id: string) => void }) {
  const mark = g.left ? "·" : g.won ? "W" : "L";
  return (
    <li className={`sheet-row ${g.left ? "is-left" : g.won ? "is-win" : "is-loss"}`}>
      <span className="sheet-wl">{mark}</span>
      <span className="tabular-nums">Wk {g.week}</span>
      <span className="sheet-loc">{g.loc}</span>
      <span className="tabular-nums sheet-rk">{g.rank}</span>
      <button type="button" className="sheet-opp" {...bindTap(() => onPick(g.oppId))}>
        {teamLabel(g.oppId)}
      </button>
      <span className="tabular-nums sheet-score">{g.left ? "left" : `${g.mine}–${g.theirs}`}</span>
    </li>
  );
}

function TeamSheetBoard({ q, sheetId, onPick }: { q: string; sheetId: string | null; onPick: (id: string) => void }) {
  const { state } = useGame();
  const hits = state && q.trim()
    ? Object.keys(state.teams).filter((id) => !state.teams[id]?.guest && matchQ(id, q)).slice(0, 8)
    : [];
  const id = hits.length === 1
    ? hits[0]!
    : sheetId && state?.teams[sheetId] && !state.teams[sheetId]?.guest
      ? sheetId
      : state?.playerTeamId ?? "";
  const sheet = useMemo(() => (state && id ? teamSheet(state, id) : null), [state, id]);
  if (!state || !sheet) return null;
  const school = TEAM_BY_ID[sheet.id];
  const t = state.teams[sheet.id];
  const live = netReleased(state);
  const moved = sheet.prev - sheet.net;
  return (
    <div className="flex flex-col gap-3">
      {hits.length > 1 && (
        <div className="chip-row">
          {hits.map((hid) => (
            <button key={hid} type="button" className="min-h-11 rounded-full bg-elevated px-4 text-sm font-semibold" {...bindTap(() => onPick(hid))}>
              {teamLabel(hid)}
            </button>
          ))}
        </div>
      )}
      <div className="rank-board rank-bo">
        <div className="bo-top">
          <p className="bo-brand">NET team sheet</p>
          <p className="bo-sub">
            {school?.city}, {school?.state} · {t ? leagueName(t.conference, state.season) : ""} · updates after every game
          </p>
        </div>
        <div className="sheet-head">
          <div>
            <h2 className="font-display text-3xl">{school?.name}</h2>
            <p className="text-sm text-muted">{school?.mascot}</p>
          </div>
          <div className="sheet-net">
            <p className="text-[11px] tracking-[0.16em] text-muted uppercase">NET</p>
            <p className="font-display text-4xl tabular-nums">{live ? sheet.net : "—"}</p>
            {live && moved !== 0 && (
              <p className={`text-xs font-semibold ${moved > 0 ? "sheet-up" : "sheet-down"}`}>
                {moved > 0 ? `▲ ${moved}` : `▼ ${Math.abs(moved)}`} from {sheet.prev}
              </p>
            )}
          </div>
        </div>
        <dl className="sheet-metrics">
          <div><dt>KenPom</dt><dd>{sheet.kenpom}</dd></div>
          <div><dt>Record</dt><dd>{sheet.record}</dd></div>
          <div><dt>Home</dt><dd>{sheet.home}</dd></div>
          <div><dt>Away</dt><dd>{sheet.away}</dd></div>
          <div><dt>Neutral</dt><dd>{sheet.neutral}</dd></div>
          <div><dt>Opp avg rank</dt><dd>{sheet.oppAvg || "—"}</dd></div>
          <div><dt>Avg win</dt><dd>{sheet.winAvg || "—"}</dd></div>
          <div><dt>Avg loss</dt><dd>{sheet.lossAvg || "—"}</dd></div>
          <div><dt>SOS</dt><dd>{sheet.sos}</dd></div>
          <div><dt>OOC SOS</dt><dd>{sheet.oocSos}</dd></div>
        </dl>
        <p className="sheet-note">{live ? `${netBoardLine(state)} Quadrants use that full sample, and the opponent rank moves after every result.` : netHoldLine(state.season)}</p>
      </div>
      {live && sheet.quads.map((quad) => (
        <section key={quad.q} className={`sheet-quad sheet-q${quad.q}`}>
          <header>
            <h3>{quad.title} <span className="tabular-nums">{quad.record}</span></h3>
            <p>{quad.cuts}</p>
          </header>
          <p className="sheet-split">
            Home {quad.home} · Away {quad.away} · Neutral {quad.neutral} · OOC {quad.ooc} · Left {quad.left}
          </p>
          {quad.games.length || quad.upcoming.length ? (
            <ul>
              {quad.games.map((g, i) => <SheetRow key={`${g.oppId}-${g.week}-${i}`} g={g} onPick={onPick} />)}
              {quad.upcoming.map((g, i) => <SheetRow key={`up-${g.oppId}-${g.week}-${i}`} g={g} onPick={onPick} />)}
            </ul>
          ) : (
            <p className="sheet-empty">No games</p>
          )}
        </section>
      ))}
    </div>
  );
}
