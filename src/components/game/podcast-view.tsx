import { useState } from "react";
import { useGame } from "@/game/store";
import { bindTap } from "@/lib/tap";
import { inkOn, teamOf } from "@/game/teams";
import { catalogOf, podcastTicker, showOf, showsFor } from "@/game/podcast";
import type { PodcastEpisode, PodcastShowId } from "@/game/types";

function EpisodeBody({ ep, featured }: { ep: PodcastEpisode; featured?: boolean }) {
  const { openRecap, openSearch, setView, state } = useGame();
  const show = showOf(ep.showId, state ?? undefined);
  return (
    <article className={`pod-ep ${featured ? "is-feature" : ""}`}>
      <p className="pod-kicker">
        {show.kicker} · {ep.runtime} · {ep.week === 0 ? "Camp" : `Week ${ep.week}`}
      </p>
      <h2 className={featured ? "pod-hed-lg" : "pod-hed"}>{ep.title}</h2>
      <p className="pod-dek">{ep.dek}</p>
      <p className="pod-by">{show.tagline}</p>
      <div className="pod-beats">
        {ep.beats.map((b, i) => {
          const same = i > 0 && ep.beats[i - 1]!.speaker === b.speaker;
          const who = b.speaker === "Trill Raff" ? "Trill" : b.speaker;
          return (
            <p key={`${ep.id}-${i}`} className={`pod-line${same ? " is-cont" : ""}`}>
              <span className="pod-speaker">{same ? "" : who}</span>
              <span className="pod-text">{b.line}</span>
            </p>
          );
        })}
      </div>
      {ep.names && ep.names.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ep.names.map((n) => (
            <button
              key={`${n.kind}-${n.id}`}
              type="button"
              className="min-h-11 rounded-full bg-elevated px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
              {...bindTap(() => {
                if (n.kind === "player" && state?.players.some((p) => p.id === n.id && p.teamId === state.playerTeamId)) {
                  setView("roster");
                  return;
                }
                if (n.kind === "recruit" || n.kind === "portal") {
                  setView("recruiting");
                  return;
                }
                openSearch(n.name);
              })}
            >
              {n.name}
            </button>
          ))}
        </div>
      )}
      {ep.resultId && (
        <button type="button" className="pod-recap" {...bindTap(() => openRecap(ep.resultId!, "podcasts"))}>
          Open the recap
        </button>
      )}
    </article>
  );
}

export function PodcastsView() {
  const { state, setView } = useGame();
  const kentucky = state?.playerTeamId === "kentucky";
  const [showId, setShowId] = useState<PodcastShowId>(kentucky ? "catican" : "lockedon");
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state) return null;
  const shows = showsFor(state);
  const activeId = shows.some((s) => s.id === showId) ? showId : shows[0]!.id;
  const show = showOf(activeId, state);
  const home = teamOf(show.homeId);
  const items = catalogOf(state, activeId);
  const feature = items[0];
  const rest = items.slice(1);
  const expanded = rest.find((a) => a.id === openId) ?? null;

  return (
    <div className="pod-sheet">
      <p className="pod-mast">{show.network} · {state.season}</p>
      <h1 className="font-display text-3xl">Podcasts</h1>
      <p className="mt-1 text-sm text-muted">
        {show.id === "catican" ? "Four friends. New one every week." : show.tagline}
      </p>
      {kentucky && (
        <button type="button" className="mt-3 min-h-11 self-start rounded-lg bg-elevated px-3 text-sm font-semibold" {...bindTap(() => setView("merch"))}>
          Shop The Catican
        </button>
      )}

      {shows.length > 1 && (
      <div className="pod-shows">
        {shows.map((s) => {
          const on = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              className={`pod-chip ${on ? "is-on" : ""}`}
              style={on ? { background: home.color, color: inkOn(home.color) } : undefined}
              {...bindTap(() => {
                setShowId(s.id);
                setOpenId(null);
              })}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      )}

      <p className="pod-ticker" aria-hidden>
        {podcastTicker(state)}
      </p>

      {!feature ? (
        <p className="mt-2 text-sm text-muted">No episode yet. Play a week.</p>
      ) : (
        <>
          <EpisodeBody ep={feature} featured />
          {expanded && expanded.id !== feature.id && <EpisodeBody ep={expanded} />}
          {rest.length > 0 && (
            <div className="pod-list">
              <p className="pod-kicker">Back catalog</p>
              {rest.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`pod-row ${a.id === openId ? "is-on" : ""}`}
                  {...bindTap(() => setOpenId(a.id === openId ? null : a.id))}
                >
                  <span className="pod-row-k">{a.runtime}</span>
                  <span className="pod-row-h">{a.title}</span>
                  <span className="pod-row-m">{a.week === 0 ? "Camp" : `Wk ${a.week}`}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
