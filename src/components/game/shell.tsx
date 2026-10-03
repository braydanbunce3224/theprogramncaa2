import { useState, type CSSProperties } from "react";
import {
  Award,
  CalendarDays,
  ClipboardList,
  Ellipsis,
  FileText,
  Scale,
  Flame,
  LayoutGrid,
  ListOrdered,
  Mail,
  Newspaper,
  Trophy,
  Users,
  Activity,
  TrendingUp,
  GraduationCap,
  Dumbbell,
  Search,
  Settings,
  Headphones,
  ShoppingBag,
  Landmark,
  BookOpen,
  School,
  Library,
} from "lucide-react";
import { useGame } from "@/game/store";
import { inkOn, teamOf } from "@/game/teams";
import { unreadMail, settingsOf } from "@/game/engine";
import type { View } from "@/game/types";
import { bindTap } from "@/lib/tap";

function BallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c2.4 3.2 3.4 6 3.4 9s-1 5.8-3.4 9M12 3C9.6 6.2 8.6 9 8.6 12s1 5.8 3.4 9M3.5 9.2h17M3.5 14.8h17" />
    </svg>
  );
}

const PRIMARY: { id: View; label: string; icon: typeof LayoutGrid }[] = [
  { id: "hub", label: "Gym", icon: BallIcon as typeof LayoutGrid },
  { id: "roster", label: "Roster", icon: Users },
  { id: "schedule", label: "Games", icon: CalendarDays },
  { id: "recruiting", label: "Recruit", icon: ClipboardList },
];

const MORE: { id: View; label: string; icon: typeof LayoutGrid; hint: string }[] = [
  { id: "search", label: "Search", icon: Search, hint: "Find a player, recruit, or coach" },
  { id: "program", label: "Program", icon: School, hint: "Staff, facilities, practice, and your lineup" },
  { id: "inbox", label: "Inbox", icon: Mail, hint: "AD, boosters, and fans" },
  { id: "news", label: "News", icon: Newspaper, hint: "Stories from this week's games" },
  { id: "podcasts", label: "Podcasts", icon: Headphones, hint: "Locked On your school" },
  { id: "merch", label: "Catican merch", icon: ShoppingBag, hint: "Tees and a hoodie from the show" },
  { id: "burner", label: "The Burner", icon: Flame, hint: "Coaching rumors and portal talk" },
  { id: "standings", label: "Ranks", icon: ListOrdered, hint: "Conference standings, NET, KenPom, and the AP poll" },
  { id: "places", label: "Toughest places", icon: Landmark, hint: "Home-court rankings" },
  { id: "records", label: "Record book", icon: BookOpen, hint: "Program records and national leaders" },
  { id: "archives", label: "Archives", icon: Library, hint: "Past seasons, champions, and box scores" },
  { id: "analytics", label: "Stats", icon: Activity, hint: "Efficiency, splits, and your next matchup" },
  { id: "market", label: "Betting odds", icon: TrendingUp, hint: "Spreads, totals, and moneylines" },
  { id: "bracketology", label: "Bracket", icon: Trophy, hint: "Projection until Selection Sunday, then the locked field" },
  { id: "contract", label: "Contract", icon: FileText, hint: "Years left and open jobs" },
  { id: "draft", label: "Draft", icon: GraduationCap, hint: "Who stays and who goes pro" },
  { id: "camp", label: "Camp", icon: Dumbbell, hint: "Offseason development" },
  { id: "awards", label: "Awards", icon: Award, hint: "Player of the Week and All-Americans" },
  { id: "compliance", label: "Compliance", icon: Scale, hint: "APR, NIL, and NCAA status" },
  { id: "hof", label: "Hall of Fame", icon: Award, hint: "Banners from every job on this device" },
  { id: "saves", label: "Load game", icon: ClipboardList, hint: "Saves on this device" },
  { id: "settings", label: "Settings", icon: Settings, hint: "Difficulty, NIL, and display" },
];

const MORE_VIEWS = new Set<View>(["inbox", "standings", "places", "records", "leaders", "bracketology", "news", "podcasts", "merch", "bracket", "team", "saves", "selection", "names", "hof", "contract", "compliance", "analytics", "market", "draft", "camp", "awards", "settings", "search", "burner", "program", "player", "archives"]);

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, view, setView, leaveToTitle, showTutorial, openNames, clearFeedback } = useGame();
  const [moreOpen, setMoreOpen] = useState(false);
  if (!state) return <>{children}</>;
  const team = teamOf(state.playerTeamId);
  const rt = state.teams[state.playerTeamId];
  const unread = unreadMail(state);
  const moreOn = MORE_VIEWS.has(view);
  const tint = settingsOf(state).teamColor;
  const hush = settingsOf(state).reducedMotion;
  const big = settingsOf(state).largerType;
  const shellStyle = tint
    ? ({
        "--color-accent": team.color,
        "--color-accent-fg": inkOn(team.color),
        "--team-tint": team.color,
      } as CSSProperties)
    : undefined;

  function go(id: View) {
    setMoreOpen(false);
    clearFeedback();
    if (id === "names") {
      openNames(view === "hub" ? "hub" : view);
      return;
    }
    setView(id);
  }

  return (
    <div className={`app-frame ${tint ? "is-team" : ""} ${hush ? "is-quiet" : ""} ${big ? "is-big" : ""}`} style={shellStyle}>
      <header className="chrome-header border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2">
          <span className="brand-mark">Dribble</span>
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: team.color }} />
          <span className="font-display min-w-0 flex-1 truncate text-lg">{team.name}</span>
          <span className="header-record text-sm text-muted">
            {rt ? `${rt.wins}-${rt.losses}` : "—"}
          </span>
          <button
            type="button"
            aria-label={unread ? `Mail, ${unread} unread` : "Mail"}
            {...bindTap(() => go("inbox"))}
            className="relative flex size-11 shrink-0 items-center justify-center rounded-lg text-fg"
          >
            <Mail className="size-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-loss px-1 text-center text-[10px] leading-4 font-bold text-fg">
                {unread}
              </span>
            )}
          </button>
          <button type="button" className="chrome-menu min-h-11 shrink-0 px-2 text-xs whitespace-nowrap text-muted" aria-label="Main menu" {...bindTap(leaveToTitle)}>
            Menu
          </button>
        </div>
      </header>

      <main className="app-scroll mx-auto min-w-0 w-full max-w-5xl px-3 py-4 md:px-6">
        {children}
      </main>

      {moreOpen && (
        <div className="more-overlay" role="dialog" aria-label="More">
          <button type="button" className="more-dim" aria-label="Close" {...bindTap(() => setMoreOpen(false))} />
          <div className="more-sheet">
            <div className="more-sheet-card">
              <p className="shrink-0 px-4 pt-3 pb-2 text-[11px] tracking-[0.16em] text-muted uppercase">More</p>
              <ul className="more-sheet-list flex flex-col">
                {MORE.filter((item) => item.id !== "merch" || state.playerTeamId === "kentucky").map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id} className="border-t border-border first:border-t-0">
                      <button
                        type="button"
                        {...bindTap(() => go(item.id))}
                        className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
                      >
                        <Icon className="size-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{item.label}</span>
                          <span className="block truncate text-xs text-muted">{item.id === "podcasts" && state?.playerTeamId === "kentucky" ? "The Catican · Locked On" : item.hint}</span>
                        </span>
                        {item.id === "inbox" && unread > 0 && (
                          <span className="rounded-full bg-loss px-2 py-0.5 text-[11px] font-bold">{unread}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
                <li className="border-t border-border">
                  <button type="button" {...bindTap(() => { setMoreOpen(false); showTutorial(); })} className="flex min-h-12 w-full items-center px-4 text-sm text-muted">
                    Tutorial
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <nav className="dock" aria-label="Main">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const on = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                {...bindTap(() => go(item.id))}
                className={`dock-tab flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-tight font-semibold ${on ? "is-on" : "text-muted"}`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-label="More"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            {...bindTap(() => {
              clearFeedback();
              setMoreOpen((v) => !v);
            })}
            className={`dock-tab flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-tight font-semibold ${moreOn || moreOpen ? "is-on" : "text-muted"}`}
          >
            <span className="relative" aria-hidden="true">
              <Ellipsis className="size-4" />
              {unread > 0 && <span className="absolute -top-1 -right-1 size-1.5 rounded-full bg-loss" />}
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
