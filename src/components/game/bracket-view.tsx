import { useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { TEAM_BY_ID } from "@/game/teams";
import { NCAA_REGIONS, PAIR_64 } from "@/game/selection";
import { bubbleLists, cbsField, espnField, recOf, teamLabel, apPoll, netRanks, type BracketOutlet } from "@/game/ranks";
import type { GameState, NcaaBid, NcaaRegion } from "@/game/types";
import { bindTap } from "@/lib/tap";
import { ncaaRoundLabel } from "@/game/brand";

export function BracketView() {
  const { state } = useGame();
  const [tab, setTab] = useState<BracketOutlet>("espn");
  if (!state) return null;
  const locked = Boolean(state.selection?.ncaa.length);
  const you = state.playerTeamId;
  const nextNcaa = state.schedule.find((g) => g.kind === "ncaa" && !g.resultId && (g.homeId === you || g.awayId === you));
  const anyNcaa = state.schedule.find((g) => g.kind === "ncaa" && !g.resultId);
  const round = nextNcaa ? ncaaRoundLabel(nextNcaa.id) : anyNcaa ? ncaaRoundLabel(anyNcaa.id) : "";
  const lede = !locked
    ? "Projection. Not a locked bracket. This is the field if the tournament started today."
    : state.phase === "ncaa"
      ? `Locked bracket. ${round || "NCAA tournament"}.`
      : "Locked bracket. Official field after Selection Sunday.";
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 overflow-x-clip">
      <div>
        <h1 className="font-display text-3xl">Bracket</h1>
        <p className="mt-1 min-w-0 text-sm text-muted">
          {lede}
        </p>
      </div>
      <div className="chip-row">
        {([
          ["espn", "Bracketology"],
          ["cbs", "Field of 68"],
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
      {tab === "espn" ? <EspnBoard /> : <CbsBoard />}
    </div>
  );
}

function regionTeams(field: NcaaBid[], region: NcaaRegion) {
  return field.filter((b) => b.region === region);
}

function seedTeams(rows: NcaaBid[], seed: number) {
  return rows.filter((b) => b.seed === seed);
}

function EspnBoard() {
  const { state } = useGame();
  const [region, setRegion] = useState<NcaaRegion>("East");
  const field = useMemo(() => (state ? espnField(state) : []), [state]);
  const bubble = useMemo(() => {
    if (!state) return null;
    return bubbleLists(state, field, apPoll(state));
  }, [state, field]);
  if (!state || !bubble) return null;
  const you = state.playerTeamId;
  const rows = regionTeams(field, region);
  const sixtyEight = field.slice().sort((a, b) => a.seed - b.seed || a.region.localeCompare(b.region));
  return (
    <div className="rank-espn">
      <div className="espn-top">
        <span className="espn-mark">BRACKETOLOGY</span>
        <span className="espn-title">BRACKET</span>
        <span className="espn-by">
          {state.selection?.ncaa.length
            ? state.phase === "ncaa"
              ? `Locked bracket · ${state.season}`
              : `Locked field · ${state.season}`
            : `Projection · ${state.season}`}
        </span>
      </div>
      <div className="chip-row espn-regions">
        {NCAA_REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={region === r ? "on" : ""}
            {...bindTap(() => setRegion(r))}
          >
            {r}
          </button>
        ))}
      </div>
      <section className="espn-region">
        <h2>{region.toUpperCase()} REGION</h2>
        {PAIR_64.map(([hi, lo]) => {
          const a = seedTeams(rows, hi);
          const b = seedTeams(rows, lo);
          return (
            <div key={`${region}-${hi}`} className="espn-pair">
              <EspnGame seed={hi} bids={a} you={you} state={state} />
              <EspnGame seed={lo} bids={b} you={you} state={state} />
            </div>
          );
        })}
      </section>
      <div className="espn-bubble">
        <div>
          <h3>LAST FOUR IN</h3>
          {bubble.lastFourIn.map((id) => <p key={id}>{teamLabel(id)} {recOf(state, id)}</p>)}
        </div>
        <div>
          <h3>FIRST FOUR OUT</h3>
          {bubble.firstFourOut.map((id) => <p key={id}>{teamLabel(id)} {recOf(state, id)}</p>)}
        </div>
        <div>
          <h3>NEXT FOUR OUT</h3>
          {bubble.nextFourOut.map((id) => <p key={id}>{teamLabel(id)} {recOf(state, id)}</p>)}
        </div>
      </div>
      <details className="espn-field">
        <summary>Field of 68</summary>
        <ul>
          {sixtyEight.map((b) => (
            <li key={`${b.region}-${b.teamId}`}>
              <span>{b.seed}</span> {TEAM_BY_ID[b.teamId]?.name ?? b.teamId} {recOf(state, b.teamId)}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function EspnGame({ seed, bids, you, state }: { seed: number; bids: NcaaBid[]; you: string; state: GameState }) {
  const auto = bids.some((x) => x.path === "auto");
  const mine = bids.some((x) => x.teamId === you);
  return (
    <div className={`espn-game ${mine ? "you" : ""}`}>
      <span className="seed">{seed}</span>
      <span className={`name ${auto ? "auto" : ""}`}>
        {bids.length ? bids.map((b) => (
          <span key={b.teamId} className="block">
            {TEAM_BY_ID[b.teamId]?.name ?? b.teamId}
            <span className="rec"> {recOf(state, b.teamId)}</span>
          </span>
        )) : "—"}
      </span>
    </div>
  );
}

function CbsBoard() {
  const { state } = useGame();
  const [region, setRegion] = useState<NcaaRegion | "all">("East");
  const field = useMemo(() => (state ? cbsField(state) : []), [state]);
  const bubble = useMemo(() => {
    if (!state) return null;
    return bubbleLists(state, field, netRanks(state));
  }, [state, field]);
  if (!state || !bubble) return null;
  const you = state.playerTeamId;
  return (
    <div className="rank-cbs">
      <div className="cbs-top">
        <p className="cbs-mark">FIELD OF 68</p>
        <p className="cbs-title">NCAA Tournament Bracket</p>
        <p className="cbs-by">{state.selection?.ncaa.length ? `Locked field · ${state.season}` : `Projection · ${state.season} field of 68`}</p>
      </div>
      <div className="chip-row cbs-regions">
        <button type="button" className={region === "all" ? "on" : ""} {...bindTap(() => setRegion("all"))}>
          Seed lines
        </button>
        {NCAA_REGIONS.map((r) => (
          <button key={r} type="button" className={region === r ? "on" : ""} {...bindTap(() => setRegion(r))}>
            {r}
          </button>
        ))}
      </div>
      {region === "all" ? (
        Array.from({ length: 16 }, (_, i) => i + 1).map((seed) => (
          <section key={seed} className="cbs-line">
            <h3>{seed}-line</h3>
            <div className="cbs-line-grid">
              {NCAA_REGIONS.map((r) => {
                const teams = seedTeams(regionTeams(field, r), seed);
                const mine = teams.some((b) => b.teamId === you);
                return (
                  <div key={r} className={`cbs-cell ${mine ? "you" : ""}`}>
                    <span className="reg">{r}</span>
                    {teams.length ? teams.map((b) => (
                      <span key={b.teamId} className="block">
                        <span className="cbs-name">{TEAM_BY_ID[b.teamId]?.name}</span>
                        <span className="cbs-rec">{recOf(state, b.teamId)}{b.path === "auto" ? " · AUTO" : ""}{b.playIn ? " · FF" : ""}</span>
                      </span>
                    )) : <span className="cbs-name">—</span>}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <section className="cbs-line">
          <h3>{region} region</h3>
          {PAIR_64.map(([hi, lo]) => {
            const a = seedTeams(regionTeams(field, region), hi);
            const b = seedTeams(regionTeams(field, region), lo);
            return (
              <div key={`${region}-${hi}`} className="cbs-pair">
                <CbsGame seed={hi} bids={a} you={you} state={state} />
                <CbsGame seed={lo} bids={b} you={you} state={state} />
              </div>
            );
          })}
        </section>
      )}
      <div className="cbs-bubble">
        <div>
          <h3>LAST FOUR IN</h3>
          {bubble.lastFourIn.map((id) => <p key={id}>{teamLabel(id)} {recOf(state, id)}</p>)}
        </div>
        <div>
          <h3>FIRST FOUR OUT</h3>
          {bubble.firstFourOut.map((id) => <p key={id}>{teamLabel(id)} {recOf(state, id)}</p>)}
        </div>
        <div>
          <h3>NEXT FOUR OUT</h3>
          {bubble.nextFourOut.map((id) => <p key={id}>{teamLabel(id)} {recOf(state, id)}</p>)}
        </div>
      </div>
    </div>
  );
}

function CbsGame({ seed, bids, you, state }: { seed: number; bids: NcaaBid[]; you: string; state: GameState }) {
  const mine = bids.some((x) => x.teamId === you);
  return (
    <div className={`cbs-game ${mine ? "you" : ""}`}>
      <span className="seed-num">{seed}</span>
      <span>
        {bids.length ? bids.map((b) => (
          <span key={b.teamId} className="block">
            <span className="cbs-name">{TEAM_BY_ID[b.teamId]?.name}</span>
            <span className="cbs-rec">{recOf(state, b.teamId)}{b.path === "auto" ? " · AUTO" : ""}{b.playIn ? " · FF" : ""}</span>
          </span>
        )) : <span className="cbs-name">—</span>}
      </span>
    </div>
  );
}
