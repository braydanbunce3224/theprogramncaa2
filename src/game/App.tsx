import { useEffect } from "react";
import { useGame } from "./store";
import { applyMenuGo } from "./menu-go";
import { armMenu } from "./menu-boot";
import { TitleFlow } from "@/components/game/title-flow";
import { Shell } from "@/components/game/shell";
import { Hub } from "@/components/game/hub";
import { ScheduleView } from "@/components/game/schedule-view";
import { RecruitingView } from "@/components/game/recruiting-view";
import { InboxView } from "@/components/game/inbox-view";
import { RosterView } from "@/components/game/roster-view";
import { MoreViews } from "@/components/game/more-views";
import { FeedbackToast } from "@/components/game/feedback";
import { Tutorial } from "@/components/game/tutorial";
import { GameView } from "@/components/game/game-view";
import { SelectionShow } from "@/components/game/selection-show";
import { CarouselView } from "@/components/game/carousel-view";
import { bindTap, installIosTaps } from "@/lib/tap";
import { installSafariChrome } from "@/lib/safari";
import { SavesView } from "@/components/game/saves-view";
import { NamesView } from "@/components/game/names-view";
import { HofView } from "@/components/game/hof-view";
import { ContractView } from "@/components/game/contract-view";
import { ComplianceView } from "@/components/game/compliance-view";
import { RecapView } from "@/components/game/recap-view";
import { AnalyticsView } from "@/components/game/analytics-view";
import { MarketView } from "@/components/game/market-view";
import { DraftView } from "@/components/game/draft-view";
import { CampView } from "@/components/game/camp-view";
import { AwardsView } from "@/components/game/awards-view";
import { StoryView } from "@/components/game/story-view";
import { SettingsView } from "@/components/game/settings-view";
import { SearchView } from "@/components/game/search-view";
import { BurnerView } from "@/components/game/burner-view";
import { MerchView } from "@/components/game/merch-view";
import { ProgramView } from "@/components/game/program-view";
import { TeamView } from "@/components/game/team-view";
import { PlayerView } from "@/components/game/player-view";
import { ViewError } from "@/components/game/error-bound";
import { AppFrame } from "@/components/game/app-frame";

export function GameApp({ start }: { start?: string } = {}) {
  const { hydrate, starting, busy, namesStamp, cancelStart } = useGame();
  void namesStamp;
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  useEffect(() => installIosTaps(), []);
  useEffect(() => installSafariChrome(), []);
  useEffect(() => {
    if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/dribble-sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    window.__dribbleApply = applyMenuGo;
    const queued = armMenu();
    if (start) applyMenuGo(start);
    else if (queued) applyMenuGo(queued);
    return () => {
      if (window.__dribbleApply === applyMenuGo) delete window.__dribbleApply;
    };
  }, [start]);

  const spin = starting ? "Loading" : busy;
  const spinDetail = starting
    ? "365 teams. One job. This takes a few seconds."
    : busy
      ? "Stay on this page. The office comes back when the week is in."
      : "";

  return (
    <>
      {spin && (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg/95 px-6"
          style={{ pointerEvents: "auto" }}
        >
          <p className="font-display text-3xl">{spin}</p>
          <p className="mt-2 text-center text-sm text-muted">{spinDetail}</p>
          <button type="button" className="mt-6 min-h-12 rounded-lg bg-elevated px-5 font-semibold" {...bindTap(cancelStart)}>
            Cancel
          </button>
        </div>
      )}
      <ViewError
        onReset={() => {
          const st = useGame.getState();
          if (st.state) {
            st.setView("hub");
            return;
          }
          st.continueSave();
          if (!useGame.getState().state) st.leaveToTitle();
        }}
      >
        <GameAppInner />
      </ViewError>
    </>
  );
}

function GameAppInner() {
  const { view, state, namesStamp } = useGame();
  void namesStamp;

  if (!state && (view === "saves" || view === "names" || view === "hof")) {
    return (
      <>
        <AppFrame>
          {view === "saves" && <SavesView />}
          {view === "names" && <NamesView />}
          {view === "hof" && <HofView />}
        </AppFrame>
        <FeedbackToast />
      </>
    );
  }

  if (view === "title" || view === "create" || view === "select" || view === "eras" || !state) {
    return <TitleFlow />;
  }

  if (view === "tutorial") return <Tutorial />;
  if (view === "selection") {
    return (
      <>
        <SelectionShow />
        <FeedbackToast />
      </>
    );
  }
  if (view === "carousel") {
    return (
      <>
        <CarouselView />
        <FeedbackToast />
      </>
    );
  }
  if (view === "game") {
    return (
      <>
        <GameView />
        <FeedbackToast />
      </>
    );
  }
  if (view === "story") {
    return (
      <>
        <StoryView />
        <FeedbackToast />
      </>
    );
  }

  return (
    <Shell>
      {view === "hub" && <Hub />}
      {view === "roster" && <RosterView />}
      {view === "schedule" && <ScheduleView />}
      {view === "recruiting" && <RecruitingView />}
      {view === "inbox" && <InboxView />}
      {view === "contract" && <ContractView />}
      {view === "compliance" && <ComplianceView />}
      {view === "recap" && <RecapView />}
      {view === "analytics" && <AnalyticsView />}
      {view === "market" && <MarketView />}
      {view === "draft" && <DraftView />}
      {view === "camp" && <CampView />}
      {view === "awards" && <AwardsView />}
      {view === "settings" && <SettingsView />}
      {view === "search" && <SearchView />}
      {view === "burner" && <BurnerView />}
      {view === "merch" && <MerchView />}
      {view === "program" && <ProgramView />}
      {view === "player" && <PlayerView />}
      {view === "saves" && <SavesView />}
      {view === "names" && <NamesView />}
      {view === "hof" && <HofView />}
      {view === "team" && <TeamView />}
      {(view === "standings" || view === "places" || view === "records" || view === "leaders" || view === "news" || view === "podcasts" || view === "bracketology" || view === "bracket" || view === "archives") && (
        <MoreViews />
      )}
      <FeedbackToast />
    </Shell>
  );
}
