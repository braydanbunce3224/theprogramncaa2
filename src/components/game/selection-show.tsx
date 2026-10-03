import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/game/store";
import { TEAM_BY_ID } from "@/game/teams";
import { NCAA_REGIONS, PAIR_64 } from "@/game/selection";
import { confName, marchCall, recOf } from "@/game/ranks";
import { settingsOf } from "@/game/engine";
import type { GameState, NcaaBid, NcaaRegion } from "@/game/types";
import { bindTap } from "@/lib/tap";

type Side = { seed: number; bids: NcaaBid[] };

type ShowCard =
  | { kind: "intro" }
  | { kind: "ff"; region: NcaaRegion; seed: number; teams: NcaaBid[]; plays: number }
  | { kind: "r64"; region: NcaaRegion; game: number; of: number; top: Side; bottom: Side }
  | { kind: "you" };

const SHOW_MS = 2400;

export function SelectionShow() {
  const { state, finishSelectionShow } = useGame();
  const field = state?.selection?.ncaa ?? [];
  const youId = state?.playerTeamId ?? "";
  const cards = useMemo(() => buildShow(field), [field]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const quiet = state ? Boolean(settingsOf(state).reducedMotion) : false;

  const card = cards[Math.min(i, cards.length - 1)] ?? cards[0];
  const yours = Boolean(card && cardHasYou(card, youId));

  useEffect(() => {
    if (!playing || quiet) return;
    if (!card || card.kind === "you" || yours) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setI((n) => Math.min(n + 1, cards.length - 1)), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [playing, quiet, card, yours, cards.length]);

  if (!state || !card) return null;

  function next() {
    if (i >= cards.length - 1) {
      finishSelectionShow();
      return;
    }
    setI(i + 1);
  }

  const progress = cards.length > 1 ? i / (cards.length - 1) : 1;
  const you = field.find((b) => b.teamId === youId);

  return (
    <div className={`app-frame sel-show ${quiet ? "is-quiet" : ""}`}>
      <div className="sel-bar" />
      <div className="app-scroll sel-inner">
        <p className="sel-kicker">Selection Sunday · {state.season}</p>
        <div className="sel-progress" aria-hidden>
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        {card.kind === "intro" && (
          <div className="sel-beat" key="intro">
            <h1 className="sel-title">The committee is walking the bracket out.</h1>
            <p className="sel-copy">
              Dayton first, then one first-round game at a time. Four regions. Your name comes up when it comes up.
            </p>
          </div>
        )}
        {card.kind === "ff" && <FirstFour key={`${card.region}-${card.seed}`} card={card} state={state} youId={youId} />}
        {card.kind === "r64" && <RoundGame key={`${card.region}-${card.top.seed}`} card={card} state={state} youId={youId} />}
        {card.kind === "you" && (
          <div className="sel-beat sel-envelope" key="you">
            <p className="sel-kicker">Your envelope</p>
            <h1 className="sel-title">
              {marchCall(state, youId)}
            </h1>
            <p className="sel-copy">
              {TEAM_BY_ID[youId]?.name} {recOf(state, youId)}
              {you ? ` · ${you.path === "auto" ? "auto bid" : "at-large"}${you.playIn ? " · First Four" : ""}` : ""}
            </p>
          </div>
        )}
      </div>
      <div className="sel-actions">
        <button type="button" className="sel-btn" {...bindTap(next)}>
          {card.kind === "intro" ? "Open the first envelope" : card.kind === "you" ? "See the bracket" : yours ? "That's us. Next game" : "Next game"}
        </button>
        {card.kind !== "you" && !quiet && (
          <button type="button" className="sel-skip" {...bindTap(() => setPlaying((p) => !p))}>
            {playing ? "Pause the show" : "Play the show"}
          </button>
        )}
        {card.kind !== "you" && (
          <button type="button" className="sel-skip" {...bindTap(finishSelectionShow)}>
            Skip to the bracket
          </button>
        )}
      </div>
    </div>
  );
}

function FirstFour({ card, state, youId }: { card: Extract<ShowCard, { kind: "ff" }>; state: GameState; youId: string }) {
  const you = card.teams.some((b) => b.teamId === youId);
  return (
    <div className="sel-beat">
      <p className="sel-kicker">First Four · Dayton</p>
      <h1 className="sel-title">
        {card.region} · {card.seed} seed
      </h1>
      <Matchup
        top={{ seed: card.seed, bids: [card.teams[0]!] }}
        bottom={{ seed: card.seed, bids: [card.teams[1]!] }}
        state={state}
        youId={youId}
      />
      <p className="sel-copy sel-note">
        Winner is the {card.seed} seed in the {card.region}. Plays the {card.plays}.
        {you ? " You're in that game." : ""}
      </p>
    </div>
  );
}

function RoundGame({ card, state, youId }: { card: Extract<ShowCard, { kind: "r64" }>; state: GameState; youId: string }) {
  const you = sideHasYou(card.top, youId) || sideHasYou(card.bottom, youId);
  return (
    <div className="sel-beat">
      <p className="sel-kicker">
        {card.region} · Game {card.game} of {card.of}
      </p>
      <h1 className="sel-title">
        {card.top.seed} vs {card.bottom.seed}
      </h1>
      <Matchup top={card.top} bottom={card.bottom} state={state} youId={youId} />
      {you && <p className="sel-you-flag">That's your game.</p>}
    </div>
  );
}

function Matchup({ top, bottom, state, youId }: { top: Side; bottom: Side; state: GameState; youId: string }) {
  return (
    <div className="sel-match">
      <SideRow side={top} state={state} youId={youId} />
      <p className="sel-vs">VS</p>
      <SideRow side={bottom} state={state} youId={youId} />
    </div>
  );
}

function SideRow({ side, state, youId }: { side: Side; state: GameState; youId: string }) {
  const you = sideHasYou(side, youId);
  const playIn = side.bids.length > 1;
  return (
    <div className={you ? "sel-row sel-row-you" : "sel-row"}>
      <span className="sel-num">{side.seed}</span>
      <div className="sel-side">
        {side.bids.map((b) => {
          const school = TEAM_BY_ID[b.teamId];
          const conf = state.teams[b.teamId]?.conference;
          return (
            <p key={b.teamId}>
              <b>{school?.name ?? b.teamId}</b>
              <span>
                {recOf(state, b.teamId)}
                {conf ? ` · ${confName(conf)}` : ""}
                {b.path === "auto" ? " · Auto" : " · At-large"}
              </span>
            </p>
          );
        })}
        {playIn && <span className="sel-ff">First Four winner</span>}
      </div>
    </div>
  );
}

function sideHasYou(side: Side, youId: string) {
  return side.bids.some((b) => b.teamId === youId);
}

function cardHasYou(card: ShowCard, youId: string) {
  if (card.kind === "ff") return card.teams.some((b) => b.teamId === youId);
  if (card.kind === "r64") return sideHasYou(card.top, youId) || sideHasYou(card.bottom, youId);
  return false;
}

function playsSeed(seed: number) {
  const row = PAIR_64.find(([hi, lo]) => hi === seed || lo === seed);
  if (!row) return seed;
  return row[0] === seed ? row[1] : row[0];
}

function buildShow(field: NcaaBid[]): ShowCard[] {
  const cards: ShowCard[] = [{ kind: "intro" }];
  const groups = new Map<string, NcaaBid[]>();
  for (const b of field) {
    if (!b.playIn) continue;
    const key = `${b.region}-${b.seed}`;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  const ff = [...groups.entries()].sort((a, b) => {
    const [ar, as] = a[0].split("-");
    const [br, bs] = b[0].split("-");
    const rd = NCAA_REGIONS.indexOf(ar as NcaaRegion) - NCAA_REGIONS.indexOf(br as NcaaRegion);
    return rd || Number(as) - Number(bs);
  });
  for (const [key, teams] of ff) {
    if (teams.length < 2) continue;
    const [region, seedText] = key.split("-");
    const seed = Number(seedText);
    cards.push({
      kind: "ff",
      region: region as NcaaRegion,
      seed,
      teams: teams.slice(0, 2),
      plays: playsSeed(seed),
    });
  }
  for (const region of NCAA_REGIONS) {
    let game = 0;
    for (const [hi, lo] of PAIR_64) {
      const top = field.filter((b) => b.region === region && b.seed === hi);
      const bottom = field.filter((b) => b.region === region && b.seed === lo);
      if (!top.length || !bottom.length) continue;
      game += 1;
      cards.push({
        kind: "r64",
        region,
        game,
        of: PAIR_64.length,
        top: { seed: hi, bids: top },
        bottom: { seed: lo, bids: bottom },
      });
    }
  }
  cards.push({ kind: "you" });
  return cards;
}
