/** Season calendar. `season` is the fall year (2026 = 2026–27).
 * Week 1 is the Monday of the week that contains November 4.
 * The first NET is the first week whose Monday is in December.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function weekStart(season: number, week: number): Date {
  const anchor = Date.UTC(season, 10, 4);
  const dow = new Date(anchor).getUTCDay();
  const monday = anchor - ((dow + 6) % 7) * 86_400_000;
  return new Date(monday + (Math.max(1, week) - 1) * 7 * 86_400_000);
}

export function weekDateLabel(season: number, week: number): string {
  const d = weekStart(season, week);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** First regular-season week whose Monday falls in December. */
export function netReleaseWeek(season: number): number {
  for (let w = 1; w <= 22; w++) {
    if (weekStart(season, w).getUTCMonth() === 11) return w;
  }
  return 6;
}

export function netReleased(state: { season: number; week: number; phase: string }): boolean {
  if (state.phase === "preseason") return false;
  if (state.phase !== "regular") return true;
  return state.week >= netReleaseWeek(state.season);
}

export function netHoldLine(_season: number): string {
  return "The NET doesn't release until the first week of December.";
}
