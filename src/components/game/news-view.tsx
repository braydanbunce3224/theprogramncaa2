import { useState } from "react";
import { useGame } from "@/game/store";
import { bindTap } from "@/lib/tap";
import { outletLabel } from "@/game/brand";
import { presentNews } from "@/game/wire";
import type { NewsArticle } from "@/game/types";

function ArticleBody({ a, featured }: { a: NewsArticle; featured?: boolean }) {
  const { openRecap, openSearch, setView, state } = useGame();
  const grafs = a.grafs?.length ? a.grafs : [a.dek, a.text, a.headline].filter((g): g is string => Boolean(g));
  const story = state ? presentNews(a, state) : a;
  const shownGrafs = story.grafs?.length ? story.grafs : grafs;
  return (
    <article className={`wire-piece ${featured ? "is-feature" : ""}`}>
      <p className="wire-kicker">
        {outletLabel(a.outlet)} · {a.kicker || "Notebook"} · Week {a.week}
      </p>
      <h2 className={featured ? "wire-hed-lg" : "wire-hed"}>{a.headline || a.text || "No headline"}</h2>
      {story.dek ? <p className="wire-dek">{story.dek}</p> : null}
      <p className="wire-by">By {a.byline || "staff"}</p>
      <div className="wire-grafs">
        {shownGrafs.map((g, i) => (
          <p key={i}>{g}</p>
        ))}
      </div>
      {a.names && a.names.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.names.map((n) => (
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
      {a.resultId && (
        <button type="button" className="wire-recap" {...bindTap(() => openRecap(a.resultId!, "news"))}>
          Open the recap
        </button>
      )}
    </article>
  );
}

export function NewsView() {
  const { state } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state) return null;
  const items = state.news;
  if (!items.length) {
    return (
      <div className="wire-sheet">
        <p className="wire-mast">News</p>
        <h1 className="font-display text-3xl">News</h1>
        <p className="mt-2 text-sm text-muted">No stories yet. Play or sim a game.</p>
      </div>
    );
  }
  const feature = items[0]!;
  const rest = items.slice(1);
  const expanded = rest.find((a) => a.id === openId) ?? null;

  return (
    <div className="wire-sheet">
      <p className="wire-mast">News · {state.season}</p>
      <h1 className="font-display text-3xl">News</h1>
      <p className="mt-1 text-sm text-muted">Recaps and notes from around the country.</p>
      <ArticleBody a={feature} featured />
      {expanded && expanded.id !== feature.id && <ArticleBody a={expanded} />}
      {rest.length > 0 && (
        <div className="wire-list">
          <p className="wire-kicker">More stories</p>
          {rest.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`wire-row ${a.id === openId ? "is-on" : ""}`}
              {...bindTap(() => setOpenId(a.id === openId ? null : a.id))}
            >
              <span className="wire-row-k">{a.kicker}</span>
              <span className="wire-row-h">{a.headline}</span>
              <span className="wire-row-m">Week {a.week}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
