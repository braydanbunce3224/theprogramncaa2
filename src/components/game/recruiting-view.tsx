import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { interestIn, intlLabel, isTargeted, lastFit, portalAfford, portalChance, portalInterest, portalOf, portalOpen, reasonLine, recruitStage, recruitingProgress, scholarshipsLeft, settingsOf, signChance, signGate, fogTape, heatMark, nationalBoard, FreakKinds, freakLine } from "@/game/engine";
import { circleLine, commitWord, pipelineLine, poachWatch, rivalRows, signingBlurb } from "@/game/sheet";
import { classShapeLine, leanMathLine } from "@/game/recruit-depth";
import { TEAM_BY_ID, teamOf } from "@/game/teams";
import { bindTap } from "@/lib/tap";
import type { Pos, Recruit, Transfer } from "@/game/types";

type Tab = "board" | "targets" | "juco" | "outliers" | "intl" | "portal" | "espn";

const POS_CHIPS: (Pos | "all")[] = ["all", "PG", "SG", "SF", "PF", "C"];

const STAGE: Record<ReturnType<typeof recruitStage>, string> = {
  signed: "Signed",
  verbal: "Verbal",
  close: "Ready to sign",
  leaning: "Leaning",
  offered: "Offered",
  visited: "Visited",
  scouted: "Scouted",
  board: "Available",
};

export function RecruitingView() {
  const { state, scout, offer, visit, sign, forceSign, dropRecruit, pitchNil, setAssisted, portalScout, portalOffer, portalVisit, portalSign } = useGame();
  const [tab, setTab] = useState<Tab>("board");
  const [sort, setSort] = useState<"stars" | "interest">("interest");
  const [pos, setPos] = useState<Pos | "all">("all");
  const [q, setQ] = useState("");
  const you = state?.playerTeamId ?? "";
  const rows = useMemo(() => {
    if (!state) return [];
    const query = q.trim().toLowerCase();
    if (tab === "espn") {
      let list = nationalBoard(state, 100);
      if (pos !== "all") list = list.filter((r) => r.pos === pos);
      if (query) {
        list = list.filter((r) => `${r.first} ${r.last}`.toLowerCase().includes(query) || r.pos.toLowerCase() === query);
      }
      return list;
    }
    let list = state.recruits.filter((r) => !r.committedTo || r.committedTo === you);
    if (!query) list = list.filter((r) => !r.dropped || r.committedTo === you);
    if (pos !== "all") list = list.filter((r) => r.pos === pos);
    if (tab === "targets") list = list.filter((r) => isTargeted(r, you));
    if (tab === "juco") list = list.filter((r) => r.path === "juco");
    if (tab === "outliers") list = list.filter((r) => r.freak);
    if (tab === "intl") list = list.filter((r) => r.country && r.country !== "US");
    if (tab === "board") list = list.filter((r) => r.path !== "juco");
    if (query) list = list.filter((r) => `${r.first} ${r.last}`.toLowerCase().includes(query) || r.pos.toLowerCase() === query);
    if (tab === "outliers" || sort === "stars") list = [...list].sort((a, b) => b.stars - a.stars || b.ovr - a.ovr);
    else list = [...list].sort((a, b) => targetRank(b, you) - targetRank(a, you) || b.stars - a.stars);
    return list;
  }, [state, sort, q, you, tab, pos]);
  const boardTotal = tab === "board" ? rows.length : 0;
  const shown = tab === "board" ? rows.slice(0, 60) : rows;
  const boardRanks = useMemo(() => {
    if (!state || tab !== "espn") return new Map<string, number>();
    return new Map(nationalBoard(state, 100).map((r, i) => [r.id, i + 1]));
  }, [state, tab]);

  const transfers = useMemo(() => {
    if (!state) return [];
    const portal = portalOf(state);
    let list = portal.transfers.filter((t) => !t.committedTo || t.committedTo === you);
    const query = q.trim().toLowerCase();
    if (pos !== "all") list = list.filter((t) => t.pos === pos);
    if (query) list = list.filter((t) => `${t.first} ${t.last}`.toLowerCase().includes(query) || t.pos.toLowerCase() === query);
    if (sort === "interest") list = [...list].sort((a, b) => portalInterest(b, you, state) - portalInterest(a, you, state) || b.ovr - a.ovr);
    else list = [...list].sort((a, b) => b.stars - a.stars || b.ovr - a.ovr);
    return list;
  }, [state, sort, q, you, pos]);

  if (!state) return null;
  const left = scholarshipsLeft(state);
  const prog = recruitingProgress(state);
  const portal = portalOf(state);
  const portOn = portalOpen(state);

  const showPortal = portal.window !== "none";
  const live = transfers.filter((t) => !t.committedTo).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl">Recruiting</h1>
        <p className="mt-1 text-sm text-muted">
          {state.recruitingHours} recruiting hours left this week
          {portOn ? ` · ${portal.hours} portal hours` : ""}
          {left <= 0 ? " · no scholarships left" : ` · ${left} scholarships left`}
          {state.cpuRecruit ? " · staff's working" : ""}
        </p>
        <p className="mt-1 text-xs text-muted">
          {prog.taken}/{prog.spots} spots filled.
          {" "}
          {left} scholarship{left === 1 ? "" : "s"} left.
          Other schools are in on the same names. An elite player rarely commits in week one.
          {prog.signed === 0 ? " Scout, offer, and visit before you ask." : ""}
        </p>
      </div>
      <ClassProgress prog={prog} />
      <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-border bg-elevated px-3 py-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-current"
          checked={Boolean(state.cpuRecruit)}
          onChange={(e) => setAssisted(e.target.checked)}
        />
        <span>
          <span className="block font-semibold">Assisted recruiting</span>
          <span className="text-xs text-muted">
            Staff uses leftover recruiting time each week. Portal hours are separate.
          </span>
        </span>
      </label>
      <div className="chip-row">
        {(
          [
            ["targets", `Targets${prog.targets ? ` ${prog.targets}` : ""}`],
            ["board", "Prospects"],
            ["juco", "JUCO"],
            ["outliers", "Outliers"],
            ["intl", "Intl"],
            ...(showPortal ? [["portal", portOn ? `Portal ${live}` : "Portal"] as const] : []),
            ["espn", "Top 100"],
          ] as const
        ).map(([id, label]) => (
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
      <div className="chip-row">
        {POS_CHIPS.map((id) => (
          <button
            key={id}
            type="button"
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${pos === id ? "bg-accent text-accent-fg" : "bg-elevated"}`}
            {...bindTap(() => setPos(id))}
          >
            {id === "all" ? "All" : id}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`min-h-11 rounded-full px-4 text-sm font-semibold ${sort === "interest" ? "bg-accent text-accent-fg" : "bg-elevated"}`} {...bindTap(() => setSort("interest"))}>
          Sort by interest
        </button>
        <button type="button" className={`min-h-11 rounded-full px-4 text-sm font-semibold ${sort === "stars" ? "bg-accent text-accent-fg" : "bg-elevated"}`} {...bindTap(() => setSort("stars"))}>
          Sort by stars
        </button>
      </div>
      <input className="h-12 rounded-lg border border-border bg-elevated px-3" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "portal" ? "Search the portal…" : "Search a recruit…"} />
      {tab === "targets" && rows.length === 0 && (
        <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
          Scout, offer, or visit a prospect. He'll show up here.
        </p>
      )}
      {tab === "espn" && (
        <p className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-muted">
          National board. Top 100. Commits stay on the list.
        </p>
      )}
      {tab === "outliers" && (
        <div className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-muted">
          <p>Unusual size. Tall point guards, shooting centers, rim protectors.</p>
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {FreakKinds.map((k) => (
              <li key={k.tag}>
                <span className="font-semibold text-fg">{k.tag}</span>
                {" — "}
                {k.line}
              </li>
            ))}
          </ul>
        </div>
      )}
      {tab === "juco" && rows.length === 0 && (
        <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
          No JUCO players left. They arrive ready to play, with two years left.
        </p>
      )}
      {tab === "outliers" && rows.length === 0 && (
        <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
          Nobody left in this group. A class usually has a few: tall guards, shooting bigs, lockdown wings.
        </p>
      )}
      {tab === "intl" && rows.length === 0 && (
        <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
          No international prospects left.
        </p>
      )}
      {tab === "portal" && (
        <PortalBoard
          stateWindow={portal.window}
          hours={portal.hours}
          transfers={transfers}
          you={you}
          left={left}
          onScout={portalScout}
          onOffer={portalOffer}
          onVisit={portalVisit}
          onSign={portalSign}
        />
      )}
      {tab === "board" && (
        <p className="text-xs text-muted">
          {boardTotal > 60
            ? `Showing 60 of ${boardTotal} still available. National board is the top 100.`
            : `Showing ${boardTotal} still available. National board is the top 100.`}
        </p>
      )}
      {tab !== "portal" && (
      <>
      {(() => {
        const sign = signingBlurb(state);
        return (
          <div className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm">
            <p>{pipelineLine(state)}</p>
            <p className="mt-2">{classShapeLine(state)}</p>
            {sign ? <p className="mt-2">{sign}</p> : <p className="mt-2 text-muted">{settingsOf(state).flipsOn ? "Nobody is signed. A verbal can still move until signing day." : "Nobody is signed yet."}</p>}
            <p className="mt-2 text-xs text-muted">
              {settingsOf(state).difficulty === "easy" || settingsOf(state).difficulty === "realistic"
                ? "Ratings are close. Scouting locks them in."
                : "Ratings are hidden until you scout. A weak staff can miss."}
            </p>
          </div>
        );
      })()}
      <ul className="flex flex-col gap-2">
        {shown.map((r, i) => {
          const interest = interestIn(r, you, state);
          const offered = r.offers.includes(you);
          const signed = r.committedTo === you;
          const signedElse = Boolean(r.committedTo && r.committedTo !== you);
          const schoolElse = signedElse ? TEAM_BY_ID[r.committedTo!] : null;
          const stage = recruitStage(r, you, state);
          const school = TEAM_BY_ID[you];
          const pipe = Boolean(r.state && school?.state && r.state === school.state);
          const nation = intlLabel(r.country);
          const god = settingsOf(state).godMode;
          const nilOn = settingsOf(state).nilOn && state.nilCap >= 10;
          const arrow = heatMark(r, you, state);
          const chance = signChance(r, state);
          const asked = r.signAsk?.season === state.season && r.signAsk.week === state.week;
          const gate = god ? null : signGate(offered, Boolean(asked));
          const verbalWindow = settingsOf(state).flipsOn && state.phase !== "offseason" && state.week < 14;
          const elsewhere = signedElse ? (recruitStage(r, r.committedTo!, state) === "verbal" ? "Verbal" : "Signed") : "";
          const rank = boardRanks.get(r.id) ?? 0;
          return (
            <li key={r.id} className="board-card">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="star-row" aria-label={`${r.stars} stars`}>
                    {Array.from({ length: 5 }, (_, s) => (
                      <span key={s} className={`star-pip ${s < r.stars ? "is-on" : ""}`} />
                    ))}
                  </div>
                  <p className="font-semibold">
                    {tab === "espn" && rank > 0 ? <span className="mr-2 text-xs text-muted">#{rank}</span> : null}
                    {r.last.toUpperCase()}, {r.first}
                  </p>
                  {(r.freak || r.flipped) && (
                    <p className="text-xs font-normal tracking-[0.12em] uppercase">
                      {r.freak ? <span className="text-subtle">{r.freakTag ?? "Outlier"}</span> : null}
                      {r.freak && r.flipped ? <span className="text-subtle"> · </span> : null}
                      {r.flipped ? <span className="text-loss">Flip</span> : null}
                    </p>
                  )}
                  {r.freak && tab === "outliers" ? (
                    <p className="text-xs text-muted">{freakLine(r.freakTag)}</p>
                  ) : null}
                  <p className="text-xs text-muted">
                    {r.pos}{r.height ? ` · ${r.height}` : ""} · {r.path === "juco" ? "JUCO · " : ""}{nation ?? r.state}
                    {pipe ? " · pipeline" : ""} · {fogTape(r)}
                    {r.scouted ? ` · wants ${topNeed(r.wants)}` : " · scout to see wants"}
                    {r.scouted && r.skills ? ` · shoot ${r.skills.shoot} / finish ${r.skills.finish} / def ${r.skills.defense} / IQ ${r.skills.iq}` : ""}
                    {signedElse ? ` · ${elsewhere.toLowerCase()} ${schoolElse?.name ?? "elsewhere"}` : ""}
                  </p>
                  <p className="mt-1 text-xs tracking-[0.12em] text-subtle uppercase">
                    {signedElse ? `${elsewhere} · ${schoolElse?.name ?? "elsewhere"}` : STAGE[stage]}
                    {!signed && !signedElse ? (gate ? ` · ${gate}` : ` · ${chance}% to ${verbalWindow ? "commit" : "sign"}`) : ""}
                  </p>
                </div>
                <span className="jersey-ovr">
                  {interest}
                  {arrow === "up" ? <span className="text-win"> ▲</span> : arrow === "down" ? <span className="text-loss"> ▼</span> : null}
                </span>
              </div>
              <div className="interest-bar mt-2" aria-label={`Interest ${interest}`}>
                <span style={{ width: `${interest}%` }} />
              </div>
              {(() => {
                const battle = rivalRows(r.interest, r.committedTo);
                const word = signed || signedElse ? "" : commitWord(settingsOf(state).flipsOn, Boolean(r.committedTo));
                return (
                  <div className="mt-2 text-xs text-muted">
                    <p>
                      {word ? `${word} · ` : ""}
                      {battle.lean ? `Leaning ${battle.lean}` : "No lean yet"}
                      {r.visits.includes(you) ? " · visit is in" : ""}
                    </p>
                    {r.scouted ? <p className="mt-1">{circleLine(r.wants)}</p> : null}
                    {!signed && !signedElse ? <p className="mt-1">{leanMathLine(r, state, interest)}</p> : null}
                    {battle.rows.length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {battle.rows.map((row) => (
                          <li key={row.id} className="flex items-center gap-2">
                            <span className="w-28 truncate">{row.name}</span>
                            <span className="interest-bar flex-1"><span style={{ width: `${row.n}%` }} /></span>
                            <span className="tabular-nums">{row.n}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
              {!signed && !signedElse && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" {...bindTap(() => scout(r.id))}>
                    Scout · 1h
                  </button>
                  <button
                    type="button"
                    disabled={left <= 0 && !offered}
                    className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] disabled:opacity-40"
                    {...bindTap(() => offer(r.id))}
                  >
                    {offered ? "Offered" : left <= 0 ? "No scholarships" : "Offer · 2h"}
                  </button>
                  <button type="button" className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" {...bindTap(() => visit(r.id))}>
                    Visit · 3h
                  </button>
                  {nilOn && (
                    <button type="button" className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" {...bindTap(() => pitchNil(r.id))}>
                      NIL bump
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={(!offered && !god) || Boolean(gate)}
                    className="min-h-11 rounded-full bg-accent px-3 text-xs font-bold text-accent-fg disabled:opacity-40"
                    {...bindTap(() => sign(r.id))}
                  >
                    {gate ? "Not yet" : verbalWindow ? `Ask · ${chance}%` : `Sign · ${chance}%`}
                  </button>
                  {god && (
                    <button type="button" className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold" {...bindTap(() => forceSign(r.id))}>
                      Force
                    </button>
                  )}
                  <button type="button" className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold" {...bindTap(() => dropRecruit(r.id))}>
                    Drop
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </>
      )}
    </div>
  );
}

function PortalBoard({
  stateWindow,
  hours,
  transfers,
  you,
  left,
  onScout,
  onOffer,
  onVisit,
  onSign,
}: {
  stateWindow: string;
  hours: number;
  transfers: Transfer[];
  you: string;
  left: number;
  onScout: (id: string) => void;
  onOffer: (id: string) => void;
  onVisit: (id: string) => void;
  onSign: (id: string) => void;
}) {
  const { state } = useGame();
  if (!state) return null;
  if (stateWindow === "none") {
    return (
      <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
        No portal in this era. Kids stay, or they go pro.
      </p>
    );
  }
  if (stateWindow !== "winter" && stateWindow !== "spring") {
    return (
      <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
        Portal is closed. It opens in the winter window, weeks 8–11, and again in the spring after the year ends.
      </p>
    );
  }
  if (transfers.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-elevated px-4 py-5 text-sm text-muted">
        The {stateWindow} portal is empty. Somebody signed them, or nobody walked.
      </p>
    );
  }
  return (
    <>
      <p className="text-sm text-muted">
        {stateWindow === "winter" ? "Winter window" : "Spring window"} · {hours} portal hours left · this does not use high school recruiting time
        {settingsOf(state).portalStrict === "tight" ? " · tight portal" : settingsOf(state).portalStrict === "open" ? " · open portal" : ""}
      </p>
      {poachWatch(state).length > 0 && (
        <div className="rounded-xl border border-border bg-elevated px-4 py-3 text-sm">
          <p className="text-xs tracking-[0.18em] text-muted uppercase">Poach watch</p>
          <ul className="mt-2 space-y-1">
            {poachWatch(state).map((p) => (
              <li key={p.id}><span className="font-semibold">{p.name}</span> · {p.line}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {transfers.map((t) => {
          const heat = portalInterest(t, you, state);
          const offered = t.offers.includes(you);
          const signed = t.committedTo === you;
          const from = TEAM_BY_ID[t.fromId];
          const chance = portalChance(state, t);
          const afford = portalAfford(state, t);
          const affordLine = afford === "fits" ? "NIL fits" : afford === "tight" ? "NIL tight" : afford === "over" ? "over the cap" : "";
          return (
            <li key={t.id} className="board-card">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="star-row" aria-label={`${t.stars} stars`}>
                    {Array.from({ length: 5 }, (_, s) => (
                      <span key={s} className={`star-pip ${s < t.stars ? "is-on" : ""}`} />
                    ))}
                  </div>
                  <p className="font-semibold">{t.last.toUpperCase()}, {t.first}</p>
                  {(t.fromId === you || t.boomerang) && (
                    <p className="text-xs font-normal tracking-[0.12em] text-subtle uppercase">
                      {t.fromId === you ? "Yours" : ""}
                      {t.fromId === you && t.boomerang ? " · " : ""}
                      {t.boomerang ? "Boomerang" : ""}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    {t.pos} · {t.year === 1 ? "Fr" : t.year === 2 ? "So" : t.year === 3 ? "Jr" : "Sr"}
                    {t.path === "juco" ? " · JUCO" : ""} · {t.yearsLeft} yr left · {fogTape(t)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {lastFit(t)}
                    {from ? ` · ${from.state}` : ""}
                    {t.scouted ? ` · ${reasonLine(t)}` : " · scout for why he left"}
                    {affordLine ? ` · ${affordLine}` : ""}
                  </p>
                  <p className="mt-1 text-xs tracking-[0.12em] text-subtle uppercase">
                    {signed ? "Signed" : offered ? (heat >= 68 ? "Close" : "Offered") : t.visits.includes(you) ? "Visited" : t.scouted ? "Scouted" : "Available"}
                    {!signed ? ` · ${chance}% to land` : ""}
                  </p>
                  {(() => {
                    const battle = rivalRows(t.interest, t.committedTo);
                    return battle.rows.length ? (
                      <p className="mt-1 text-xs text-muted">
                        Offers: {battle.rows.map((row) => `${row.name} ${row.n}`).join(" · ")}
                        {t.visits.length ? ` · visits ${t.visits.map((id) => TEAM_BY_ID[id]?.abbr ?? teamOf(id).abbr).join(", ")}` : ""}
                      </p>
                    ) : null;
                  })()}
                </div>
                <span className="jersey-ovr">{heat}</span>
              </div>
              <div className="interest-bar mt-2" aria-label={`Fit ${heat}`}>
                <span style={{ width: `${heat}%` }} />
              </div>
              {!signed && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" {...bindTap(() => onScout(t.id))}>
                    Scout · 1h
                  </button>
                  <button
                    type="button"
                    disabled={left <= 0 && !offered}
                    className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] disabled:opacity-40"
                    {...bindTap(() => onOffer(t.id))}
                  >
                    {offered ? "Offered" : left <= 0 ? "No scholarships" : "Offer · 2h"}
                  </button>
                  <button type="button" className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" {...bindTap(() => onVisit(t.id))}>
                    Visit · 2h
                  </button>
                  <button
                    type="button"
                    disabled={!offered}
                    className="min-h-11 rounded-full bg-accent px-3 text-xs font-bold text-accent-fg disabled:opacity-40"
                    {...bindTap(() => onSign(t.id))}
                  >
                    Sign
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ClassProgress({ prog }: { prog: ReturnType<typeof recruitingProgress> }) {
  const pct = (n: number) => `${(n / prog.spots) * 100}%`;
  return (
    <div className="rounded-xl bg-elevated p-4 panel">
      <p className="text-xs tracking-[0.18em] text-muted uppercase">Class progress</p>
      <p className="font-display mt-1 text-2xl">
        {prog.signed} signed · {prog.open} open
        {prog.portalIn ? ` · ${prog.portalIn} portal` : ""}
      </p>
      <div className="class-fill mt-3" aria-hidden>
        {prog.returning > 0 && <i className="ret" style={{ width: pct(prog.returning) }} />}
        {prog.signed > 0 && <i className="sig" style={{ width: pct(prog.signed) }} />}
        {prog.paper > 0 && <i className="pap" style={{ width: pct(prog.paper) }} />}
      </div>
      <p className="mt-2 text-xs text-muted">
        {prog.returning} returning · {prog.signed} signed · {prog.paper} paper out · {prog.left} scholarships left
      </p>
      <p className="mt-1 text-xs text-muted">
        {prog.close} close (68+) · {prog.leaning} leaning (48+) · {prog.visited} visited
        {prog.signedNames.length ? ` · ${prog.signedNames.join(", ")}` : ""}
      </p>
    </div>
  );
}

function targetRank(r: Recruit, you: string) {
  if (r.committedTo === you) return 200 + interestIn(r, you);
  return interestIn(r, you);
}

function topNeed(w: { home: number; minutes: number; scheme: number; academics: number; nil: number }) {
  const e: [string, number][] = [
    ["home", w.home],
    ["minutes", w.minutes],
    ["scheme", w.scheme],
    ["academics", w.academics],
    ["NIL", w.nil],
  ];
  e.sort((a, b) => b[1] - a[1]);
  return e[0]![0];
}
