import { create } from "zustand";
import type { CoachAxis, CoachIdentity, ConferenceId, DefPlay, DevFocus, Difficulty, Feedback, GameResult, GameState, LeagueSettings, OffPlay, Pos, PracticePlan, PromiseKind, Site, StaffRole, View } from "./types";
import type { RankKind } from "./ranks";
import { CAREER_MAX_PRESTIGE } from "./types";
import { TEAM_BY_ID, careerEligible } from "./teams";
import {
  addNonCon, answerPresser, beginLiveGame, closeLive, dropGame, goOffseason, identityName, joinMte, lockSchedule,
  newDynasty, nextYourGame, offerRecruit, pepTalk, recapFor, runLivePossession, runLiveRest, scoutRecruit, setAssistedRecruit, setPlayerMpg, setPlayerUsage, simGame, simWeek,
  spendCoachPoint, startNextSeason, visitRecruit, markRead, signExtension, takeContractJob, walkContract, worldWithCustom,
  setRedshirt, talkStay as tryStay, letGo as sendDeclare, draftWaiting,
  scoutPortal, offerPortal, visitPortal, signPortal,
  setFocus as setPlayerFocus, spendCamp, lockCamp, campWaiting, makePromise, resolveStory, holdAccountable,
  signRecruit, patchSettings, realign, retireCoach, goatLine, openDreamJob, forceCommit, answerNilAsk,
  dropTarget, pitchNil as bumpNilPitch,
  hireStaff, fireStaff, upgradeFacility, setPractice as setPracticePlan, setCaptain as seatCaptain, setStarter as seatStarter,
  scoutOpponent, reseatProgram, inviteExhibition,
} from "./engine";
import { setLiveCall, setPlanSlot, lockGamePlan, callTimeout, setLivePace, toggleLiveSub, sitFoul, queueLate } from "./plays";
import { forceEndgameState, forceTwoForState } from "./liveControls";
import { addCustomSchool, type CustomSchoolInput } from "./custom-schools";
import { noteError } from "./diag";
import { revealSelection } from "./selection";
import { deleteSlot, listSaves, loadSave, loadSlot, readSaveText, saveNamed, saveText, setTutorialDone, tutorialDone, whenSavesReady, writeSave, type SaveMeta } from "./persist";
import { readChallengeSeed } from "./sheet";
import { applyNamePack, ensureDefaultNames, loadRealSchoolsPack, loadSavedNames, parseNamePack, resetNames as clearNames, snapshotPack } from "./names";
import { recordHof } from "./hof";
import { advanceCarousel as stepCarousel, carouselWaiting, declineCarouselOffer as passCarousel } from "./carousel";
import { setSoundOn } from "./audio";
import { setHaptics } from "@/lib/tap";
import type { FacilityKind } from "./types";

const MENU_KEY = "dribble-2026.menu-view";
const PLAY_KEY = "dribble-2026.play-view";
const MENU_VIEWS = new Set(["title", "create", "select", "eras", "hof", "saves", "names"]);

function rememberMenu(view: View) {
  if (typeof window === "undefined") return;
  if (!MENU_VIEWS.has(view)) return;
  try {
    sessionStorage.setItem(MENU_KEY, view);
  } catch {
    /* ignore */
  }
}

function rememberView(view: View, hasState: boolean) {
  if (typeof window === "undefined") return;
  if (MENU_VIEWS.has(view)) {
    rememberMenu(view);
    try {
      sessionStorage.removeItem(PLAY_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  if (!hasState) return;
  try {
    sessionStorage.setItem(PLAY_KEY, view);
  } catch {
    /* ignore */
  }
}

function peekPlayView(): View | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(PLAY_KEY);
    return v ? (v as View) : null;
  } catch {
    return null;
  }
}

function resumeView(state: GameState, play: View): View {
  if (play === "game" && !state.liveGame) return "hub";
  if (play === "presser") return "hub";
  if (play === "story" && !state.pendingStory) return "hub";
  if (play === "selection" && !(state.phase === "selection" && !state.selection?.revealed)) return "hub";
  if (play === "tutorial") return "hub";
  if (play === "recap" && !state.results.length) return "hub";
  return play;
}

function viewFromGo(go: string | null): View | null {
  if (go === "career") return "create";
  if (go === "dynasty") return "select";
  if (go === "eras") return "eras";
  if (go === "hof") return "hof";
  if (go === "saves") return "saves";
  return null;
}

function recalledMenu(): View | null {
  if (typeof window === "undefined") return null;
  const fromGo = viewFromGo(new URLSearchParams(window.location.search).get("go"));
  if (fromGo) return fromGo;
  try {
    const v = sessionStorage.getItem(MENU_KEY);
    if (v && MENU_VIEWS.has(v)) return v as View;
  } catch {
    /* ignore */
  }
  return null;
}

interface Store {
  hydrated: boolean;
  view: View;
  state: GameState | null;
  recapId: string | null;
  recapReturn: View;
  selectedTeamId: string | null;
  selectMode: "career" | "dynasty" | "eras";
  eraDecade: number | null;
  draftCoach: CoachIdentity;
  draftDifficulty: Difficulty;
  draftGodMode: boolean;
  toast: string | null;
  feedback: Feedback | null;
  starting: boolean;
  busy: string | null;
  seasonRun: SeasonRun | null;
  seek: string;
  focusTeamId: string | null;
  focusPlayerId: string | null;
  ranksTab: RankKind | null;
  hydrate: () => void;
  setView: (v: View) => void;
  openSearch: (q?: string) => void;
  openTeam: (id: string) => void;
  openPlayer: (id: string) => void;
  openRanks: (tab?: RankKind, teamId?: string) => void;
  openSelect: (mode: "career" | "dynasty" | "eras") => void;
  pickEra: (d: number) => void;
  setDraftCoach: (p: Partial<CoachIdentity>) => void;
  setDraftDifficulty: (d: Difficulty) => void;
  setDraftGodMode: (on: boolean) => void;
  pickTeam: (id: string | null) => void;
  startDynasty: (teamId: string) => void;
  continueSave: () => void;
  saveNow: (name?: string) => void;
  openSaves: () => void;
  loadFile: (id: string) => void;
  dropFile: (id: string) => void;
  saves: SaveMeta[];
  namesStamp: number;
  namesReturn: View;
  refreshSaves: () => void;
  openNames: (from?: View) => void;
  openHof: () => void;
  importNames: (raw: unknown) => void;
  resetNames: () => void;
  applyRealSchools: () => Promise<void>;
  leaveToTitle: () => void;
  showTutorial: () => void;
  skipTutorial: () => void;
  finishTutorial: () => void;
  lock: () => void;
  addGame: (oppId: string, site: Site, week: number) => void;
  drop: (id: string) => void;
  join: (mteId: string) => void;
  simWeek: () => void;
  simGame: () => void;
  simSeason: () => void;
  stopSeason: () => void;
  playGame: () => void;
  callOff: (id: OffPlay) => void;
  callDef: (id: DefPlay) => void;
  runPlay: () => void;
  runCall: (side: "off" | "def", id: OffPlay | DefPlay) => void;
  runLate: (choice: "foul3" | "letplay" | "twofor") => void;
  forceEndgame: () => void;
  forceTwoFor: () => void;
  setPace: (pace: "slow" | "normal" | "fast") => void;
  setLook: (id: OffPlay) => void;
  subPlayer: (id: string) => void;
  sitTrouble: () => void;
  takeTimeout: () => void;
  simRest: () => void;
  simToEnd: () => void;
  leaveGame: () => void;
  skipPresser: () => void;
  openRecap: (id: string, from?: View) => void;
  closeRecap: () => void;
  finishSelectionShow: () => void;
  scout: (id: string) => void;
  offer: (id: string) => void;
  visit: (id: string) => void;
  sign: (id: string) => void;
  forceSign: (id: string) => void;
  dropRecruit: (id: string) => void;
  pitchNil: (id: string) => void;
  portalScout: (id: string) => void;
  portalOffer: (id: string) => void;
  portalVisit: (id: string) => void;
  portalSign: (id: string) => void;
  setAssisted: (on: boolean) => void;
  pep: (id: string) => void;
  bumpMinutes: (id: string, d: number) => void;
  setMinutes: (id: string, mpg: number) => void;
  bumpUsage: (id: string, d: number) => void;
  setFocus: (id: string, focus: DevFocus) => void;
  promise: (id: string, kind: PromiseKind) => void;
  hold: (id: string) => void;
  redshirt: (id: string, on: boolean) => void;
  talkStay: (id: string) => void;
  letGo: (id: string) => void;
  spendSkill: (axis: CoachAxis) => void;
  goOffseason: () => void;
  nextSeason: () => void;
  spendCampPt: (id: string, d: number) => void;
  lockCampNow: () => void;
  answerStory: (id: string) => void;
  setPlan: (side: "off" | "def", index: number, id: OffPlay | DefPlay) => void;
  lockPlan: () => void;
  signDeal: () => void;
  takeJob: (teamId: string) => void;
  walkDeal: () => void;
  openContract: () => void;
  advanceCarousel: () => void;
  declineCarouselOffer: () => void;
  patchLeague: (p: Partial<LeagueSettings>) => void;
  moveTeam: (teamId: string, conference: ConferenceId) => void;
  retire: () => void;
  answerNil: (playerId: string, yes: boolean) => void;
  clearFlash: () => void;
  answer: (id: string) => void;
  readMail: (id: string) => void;
  clearFeedback: () => void;
  clearToast: () => void;
  cancelStart: () => void;
  hire: (id: string) => void;
  fire: (role: StaffRole) => void;
  upgrade: (kind: FacilityKind) => void;
  setPractice: (plan: PracticePlan) => void;
  nameCaptain: (id: string) => void;
  nameStarter: (pos: Pos, id: string) => void;
  scoutOpp: () => void;
  inviteCup: (guestId: string) => void;
  editRating: (id: string, d: number) => void;
  loadTournament: () => void;
  importLeague: (raw: string) => void;
  exportLeague: () => string;
  createSchool: (input: CustomSchoolInput) => void;
}

function clampUse(n: number) {
  return Math.max(6, Math.min(40, n));
}

let bootGen = 0;
let seasonToken = 0;

export interface SeasonLine {
  id: string;
  text: string;
  win: boolean;
}

export interface SeasonRun {
  active: boolean;
  lines: SeasonLine[];
}
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistQueued: GameState | null = null;
let persistHooked = false;
let persistFail: ((msg: string) => void) | null = null;

function persist(s: GameState) {
  persistQueued = s;
  if (typeof window === "undefined") {
    writeSave(s);
    persistQueued = null;
    return;
  }
  if (persistTimer != null) return;
  const wait = s.liveGame && !s.liveGame.done ? 1500 : 280;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const q = persistQueued;
    persistQueued = null;
    if (!q) return;
    const ok = writeSave(q);
    if (!ok) persistFail?.("This device is out of save room. Delete an old file and try again.");
  }, wait);
}

function flushPersist() {
  if (persistTimer != null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const q = persistQueued;
  persistQueued = null;
  if (q) {
    const ok = writeSave(q);
    if (!ok) persistFail?.("This device is out of save room. Delete an old file and try again.");
  }
}

function hookPersistFlush() {
  if (persistHooked || typeof window === "undefined") return;
  persistHooked = true;
  window.addEventListener("pagehide", flushPersist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPersist();
  });
}

function afterPaint(fn: () => void) {
  if (typeof window === "undefined") {
    fn();
    return;
  }
  window.setTimeout(fn, 40);
}

function afterSimView(next: GameState): View {
  if (next.pendingStory) return "story";
  if (next.phase === "selection" && !next.selection?.revealed) return "selection";
  if (next.phase === "selection") return "bracketology";
  return "hub";
}

function apply(get: () => Store, set: (p: Partial<Store>) => void, next: GameState, extra?: Partial<Store>) {
  persist(next);
  if (extra?.view) rememberView(extra.view, true);
  set({ state: next, starting: false, busy: null, ...extra });
}

function failPlay(set: (p: Partial<Store>) => void, e: unknown, msg: string) {
  noteError(e);
  console.error(e);
  set({ toast: msg, starting: false, busy: null });
}

function yoursResult(state: GameState, slotId?: string) {
  const you = state.playerTeamId;
  if (slotId) return state.results.find((r) => r.slotId === slotId);
  return [...state.results].reverse().find((r) => r.homeId === you || r.awayId === you);
}

function withFilledRecap(state: GameState, resultId: string): GameState {
  const r = state.results.find((x) => x.id === resultId);
  if (!r || r.recap?.headline) return state;
  try {
    const recap = recapFor(state, r);
    return { ...state, results: state.results.map((x) => (x.id === resultId ? { ...x, recap } : x)) };
  } catch (e) {
    console.error(e);
    return state;
  }
}

function goRecap(get: () => Store, set: (p: Partial<Store>) => void, next: GameState, slotId?: string) {
  const last = yoursResult(next, slotId);
  if (!last) {
    apply(get, set, next, { view: afterSimView(next) });
    return;
  }
  const filled = withFilledRecap(next, last.id);
  apply(get, set, filled, { view: "recap", recapId: last.id, recapReturn: afterSimView(filled) });
}

function yoursAdded(before: GameState, after: GameState) {
  const you = before.playerTeamId;
  const seen = new Set(before.results.filter((r) => r.homeId === you || r.awayId === you).map((r) => r.id));
  return after.results.filter((r) => (r.homeId === you || r.awayId === you) && !seen.has(r.id));
}

function seasonLine(state: GameState, r: GameResult): SeasonLine {
  const you = state.playerTeamId;
  const home = r.homeId === you;
  const yours = home ? r.homeScore : r.awayScore;
  const theirs = home ? r.awayScore : r.homeScore;
  const opp = TEAM_BY_ID[home ? r.awayId : r.homeId]?.name ?? "Opponent";
  const rec = state.teams[you];
  const mark = rec ? `${rec.wins}-${rec.losses}` : "";
  const win = yours > theirs;
  return {
    id: r.id,
    win,
    text: `${win ? "W" : "L"} ${yours}–${theirs} ${home ? "vs" : "at"} ${opp}${mark ? ` · ${mark}` : ""}`,
  };
}

export const useGame = create<Store>((set, get) => ({
  hydrated: false,
  view: "title",
  state: null,
  recapId: null,
  recapReturn: "hub",
  selectedTeamId: null,
  selectMode: "dynasty",
  eraDecade: null,
  draftCoach: { first: "", last: "", age: 38, almaMaterId: "" },
  draftDifficulty: "realistic",
  draftGodMode: false,
  toast: null,
  feedback: null,
  starting: false,
  busy: null,
  seasonRun: null,
  seek: "",
  focusTeamId: null,
  focusPlayerId: null,
  ranksTab: null,
  saves: [],
  namesStamp: 0,
  namesReturn: "title",

  hydrate: () => {
    hookPersistFlush();
    persistFail = (msg) => set({ toast: msg, saves: listSaves() });
    void whenSavesReady().then(() => {
    loadSavedNames();
    const current = get();
    let state = current.state;
    let view = current.view;
    if (!state) {
      const play = peekPlayView();
      if (play) {
        const loaded = loadSave();
        if (loaded) {
          state = loaded.pendingPresser ? { ...loaded, pendingPresser: null } : loaded;
          view = resumeView(state, play);
        }
      }
    }
    const recalled = !state ? recalledMenu() : null;
    if (state?.settings?.soundOn === false) setSoundOn(false);
    if (state?.settings?.haptics === false) setHaptics(false);
    set({
      hydrated: true,
      state,
      view: recalled && view === "title" ? recalled : view,
      saves: listSaves(),
      namesStamp: get().namesStamp + 1,
      starting: false,
      busy: null,
    });
    void ensureDefaultNames().then((changed) => {
      if (changed) set({ namesStamp: get().namesStamp + 1 });
    });
    });
  },

  refreshSaves: () => set({ saves: listSaves() }),

  setView: (view) => {
    rememberView(view, Boolean(get().state));
    if (view === "saves") set({ view, saves: listSaves() });
    else if (view === "standings") set({ view, ranksTab: null });
    else set({ view });
  },

  openSearch: (q) => {
    rememberView("search", Boolean(get().state));
    set({ view: "search", seek: q ?? "" });
  },

  openTeam: (id) => {
    rememberView("team", Boolean(get().state));
    set({ view: "team", focusTeamId: id });
  },

  openPlayer: (id) => {
    rememberView("player", Boolean(get().state));
    set({ view: "player", focusPlayerId: id });
  },

  openRanks: (tab, teamId) => {
    rememberView("standings", Boolean(get().state));
    set({
      view: "standings",
      ranksTab: tab ?? "league",
      ...(teamId ? { focusTeamId: teamId } : {}),
    });
  },

  openSelect: (mode) => {
    const view = mode === "eras" ? "eras" : "create";
    rememberMenu(view);
    set({
      view,
      selectMode: mode,
      selectedTeamId: null,
      eraDecade: mode === "eras" ? get().eraDecade : null,
      toast: null,
      starting: false,
    });
  },

  pickEra: (d) => {
    rememberMenu("create");
    set({ eraDecade: d, selectMode: "eras", view: "create", selectedTeamId: null });
  },

  setDraftCoach: (p) => set({ draftCoach: { ...get().draftCoach, ...p } }),
  setDraftDifficulty: (d) => set({ draftDifficulty: d }),
  setDraftGodMode: (on) => set({ draftGodMode: on }),

  pickTeam: (id) => set({ selectedTeamId: id }),

  startDynasty: (teamId) => {
    if (get().starting) return;
    const school = TEAM_BY_ID[teamId];
    if (!school) return;
    const mode = get().selectMode;
    if (mode === "career" && !careerEligible(school)) {
      set({ toast: `Career starts at rating ${CAREER_MAX_PRESTIGE} and under.` });
      return;
    }
    const named = get().draftCoach;
    if (!named.first.trim() || !named.last.trim()) {
      set({ view: "create", toast: "First and last name are required.", starting: false, busy: null });
      return;
    }
    const gen = ++bootGen;
    set({ starting: true, busy: "Loading", selectedTeamId: teamId, toast: null });
    afterPaint(() => {
      void (async () => {
        if (bootGen !== gen) return;
        try {
          await ensureDefaultNames();
          if (bootGen !== gen) return;
          const d = get().draftCoach;
          const identity: CoachIdentity = {
            first: d.first.trim() || "Coach",
            last: d.last.trim() || "Stone",
            age: Math.max(28, Math.min(64, d.age || 38)),
            almaMaterId: d.almaMaterId && TEAM_BY_ID[d.almaMaterId] ? d.almaMaterId : null,
          };
          const forced = readChallengeSeed();
          const state0 = newDynasty(teamId, forced || ((Date.now() ^ (Math.random() * 1e9)) >>> 0), {
            careerMode: mode === "career",
            identity,
            eraDecade: mode === "eras" ? get().eraDecade : null,
          });
          const state = patchSettings(state0, { difficulty: get().draftDifficulty, godMode: get().draftGodMode });
          if (bootGen !== gen) return;
          const tuto = tutorialDone() ? "hub" : "tutorial";
          rememberView(tuto as View, true);
          set({
            starting: false,
            busy: null,
            state,
            view: tuto as View,
          feedback: {
            title: `${identityName(identity)} at ${school.name}`,
            detail: identity.almaMaterId
              ? `${TEAM_BY_ID[identity.almaMaterId]?.name} is still home. That job will reach further later.`
              : "No alma mater on the file.",
            parts: [{ label: "Rating", delta: school.prestige }],
          },
        });
        afterPaint(() => {
          try {
            persist(state);
          } catch (e) {
            console.error(e);
          }
        });
      } catch (e) {
        console.error(e);
        if (bootGen !== gen) return;
        set({ starting: false, busy: null, toast: "Couldn't start that job." });
      }
    })();
    });
  },

  continueSave: () => {
    const ticket = ++bootGen;
    void whenSavesReady().then(() => {
      if (ticket !== bootGen) return;
      const state = loadSave();
      if (!state) {
        set({ toast: "No save on this device.", saves: listSaves(), view: listSaves().length ? "saves" : "title" });
        return;
      }
      const opened = state.pendingPresser ? { ...state, pendingPresser: null } : state;
      const view: View = opened.pendingStory
        ? "story"
        : opened.phase === "selection" && !opened.selection?.revealed
          ? "selection"
          : "hub";
      rememberView(view, true);
      set({
        state: opened,
        view,
        saves: listSaves(),
        toast: null,
        feedback: null,
        recapId: null,
        starting: false,
        busy: null,
      });
    });
  },

  openSaves: () => {
    rememberMenu("saves");
    set({ view: "saves", saves: listSaves() });
  },

  openHof: () => {
    rememberMenu("hof");
    set({ view: "hof", toast: null });
  },

  openNames: (from) =>
    set({
      view: "names",
      toast: null,
      namesReturn: from ?? (get().state ? "hub" : get().view === "names" ? get().namesReturn : get().view),
    }),

  importNames: (raw) => {
    if (raw == null) {
      set({ toast: "Couldn't read that file." });
      return;
    }
    const parsed = parseNamePack(raw);
    if (!parsed.ok) {
      set({ toast: parsed.error });
      return;
    }
    const n = applyNamePack(parsed.pack);
    const s = get().state;
    if (s) persist({ ...s, namePack: snapshotPack() });
    set({
      namesStamp: get().namesStamp + 1,
      toast: null,
      state: s ? { ...s, namePack: snapshotPack() } : s,
      feedback: {
        title: parsed.pack.title,
        detail: `${n} schools renamed on this device. Packs stay here — they are not uploaded.`,
        parts: [{ label: "Schools", delta: n }],
      },
    });
  },

  resetNames: () => {
    clearNames();
    const pack = snapshotPack();
    const s = get().state;
    if (s) persist({ ...s, namePack: pack });
    set({
      namesStamp: get().namesStamp + 1,
      toast: null,
      state: s ? { ...s, namePack: pack } : s,
      feedback: { title: "Default names", detail: "School names are back to the built-in list.", parts: [] },
    });
  },

  applyRealSchools: async () => {
    const parsed = await loadRealSchoolsPack();
    if (!parsed.ok) {
      set({ toast: parsed.error });
      return;
    }
    get().importNames(parsed.pack);
  },

  saveNow: (name) => {
    const s = get().state;
    if (!s) {
      set({ toast: "Nothing to save yet." });
      return;
    }
    persistQueued = s;
    flushPersist();
    const label = name?.trim();
    if (!label) {
      const ok = writeSave(s);
      if (!ok) {
        set({ toast: "Couldn't write the save. Delete an old file and try again.", saves: listSaves() });
        return;
      }
      set({
        saves: listSaves(),
        toast: null,
        feedback: {
          title: "Saved",
          detail: `Season ${s.season} is on this device.`,
          parts: [{ label: "Saves", delta: 1 }],
        },
      });
      return;
    }
    const res = saveNamed(s, label);
    if (!res.ok) {
      set({ toast: res.error ?? "Couldn't save.", saves: listSaves() });
      return;
    }
    set({
      saves: listSaves(),
      toast: null,
      feedback: {
        title: "Saved",
        detail: `Wrote “${label}”.`,
        parts: [{ label: "Saves", delta: 1 }],
      },
    });
  },

  loadFile: (id) => {
    const ticket = ++bootGen;
    void whenSavesReady().then(() => {
      if (ticket !== bootGen) return;
      const state = loadSlot(id);
      if (!state) {
        set({ toast: "That file is gone.", saves: listSaves() });
        return;
      }
      const opened = state.pendingPresser ? { ...state, pendingPresser: null } : state;
      const view: View = opened.pendingStory
        ? "story"
        : opened.phase === "selection" && !opened.selection?.revealed
          ? "selection"
          : "hub";
      rememberView(view, true);
      set({
        state: opened,
        view,
        saves: listSaves(),
        toast: null,
        feedback: null,
        recapId: null,
        starting: false,
        busy: null,
      });
    });
  },

  dropFile: (id) => {
    deleteSlot(id);
    set({ saves: listSaves() });
  },

  leaveToTitle: () => {
    seasonToken += 1;
    const s = get().state;
    if (s) {
      persistQueued = s;
      flushPersist();
      recordHof(s);
    }
    if (typeof window === "undefined" ? false : location.hash.startsWith("#hh-")) {
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
    rememberView("title", false);
    set({
      view: "title",
      state: null,
      starting: false,
      busy: null,
      seasonRun: null,
      selectedTeamId: null,
      toast: null,
      feedback: null,
      recapId: null,
      saves: listSaves(),
    });
  },

  showTutorial: () => set({ view: "tutorial" }),
  skipTutorial: () => {
    setTutorialDone(true);
    const s = get().state;
    if (s) persist({ ...s, tutorialDone: true });
    rememberView("hub", Boolean(s));
    set({ view: "hub", state: s ? { ...s, tutorialDone: true } : s });
  },
  finishTutorial: () => {
    setTutorialDone(true);
    const s = get().state;
    if (s) persist({ ...s, tutorialDone: true });
    rememberView("hub", Boolean(s));
    set({ view: "hub", state: s ? { ...s, tutorialDone: true } : s });
  },

  lock: () => {
    const s = get().state;
    if (!s || s.phase !== "preseason") return;
    if (get().starting || get().busy || get().seasonRun?.active) return;
    const gen = ++bootGen;
    set({ starting: true, busy: "Filling the schedule", toast: null });
    afterPaint(() => {
      if (bootGen !== gen) return;
      try {
        const next = lockSchedule(s);
        if (bootGen !== gen) return;
        apply(get, set, next, {
          starting: false,
          busy: null,
          view: "hub",
          feedback: { title: "Season started", detail: "The schedule is locked.", parts: [] },
        });
      } catch (e) {
        console.error(e);
        if (bootGen !== gen) return;
        set({ starting: false, busy: null, toast: "Couldn't start the season." });
      }
    });
  },

  addGame: (oppId, site, week) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = addNonCon(s, oppId, week, site);
    apply(get, set, state, { feedback });
  },

  drop: (id) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, dropGame(s, id));
  },

  join: (mteId) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = joinMte(s, mteId);
    apply(get, set, state, { feedback });
  },

  simWeek: () => {
    const s = get().state;
    if (!s) return;
    if (get().starting || get().busy || get().seasonRun?.active) return;
    if (s.retired) {
      set({ toast: "You retired. Start a new job from the menu.", view: "hof" });
      return;
    }
    if (s.pendingStory) {
      set({ view: "story" });
      return;
    }
    if (s.phase === "selection" && !s.selection?.revealed) {
      set({ view: "selection" });
      return;
    }
    if (s.phase === "preseason") {
      set({ view: "schedule", toast: "Set your schedule first." });
      return;
    }
    const beforeIds = new Set(s.results.filter((r) => r.homeId === s.playerTeamId || r.awayId === s.playerTeamId).map((r) => r.id));
    const gen = ++bootGen;
    set({ busy: "Playing the week", toast: null });
    afterPaint(() => {
      if (bootGen !== gen) return;
      try {
        const next = simWeek(s);
        if (bootGen !== gen) return;
        const added = next.results.find((r) => (r.homeId === s.playerTeamId || r.awayId === s.playerTeamId) && !beforeIds.has(r.id));
        if (added) goRecap(get, set, next, added.slotId);
        else apply(get, set, next, { view: afterSimView(next) });
      } catch (e) {
        if (bootGen !== gen) return;
        failPlay(set, e, "That week didn't sim. Something in the save is missing.");
      }
    });
  },

  simGame: () => {
    const s = get().state;
    if (!s) return;
    if (get().starting || get().busy || get().seasonRun?.active) return;
    if (s.retired) {
      set({ toast: "You retired. Start a new job from the menu.", view: "hof" });
      return;
    }
    if (s.pendingStory) {
      set({ view: "story" });
      return;
    }
    if (s.phase === "selection" && !s.selection?.revealed) {
      set({ view: "selection" });
      return;
    }
    if (s.phase === "preseason") {
      set({ toast: "Set your schedule first." });
      return;
    }
    const before = nextYourGame(s);
    const gen = ++bootGen;
    set({ busy: "Playing the game", toast: null });
    afterPaint(() => {
      if (bootGen !== gen) return;
      try {
        const next = simGame(s);
        if (bootGen !== gen) return;
        if (before && next.results.some((r) => r.slotId === before.id)) goRecap(get, set, next, before.id);
        else apply(get, set, next, { view: afterSimView(next) });
      } catch (e) {
        if (bootGen !== gen) return;
        failPlay(set, e, "Couldn't sim that game. Something in the save is missing.");
      }
    });
  },

  simSeason: () => {
    const s = get().state;
    if (!s || get().starting || get().busy || get().seasonRun?.active) return;
    if (s.retired) {
      set({ toast: "You retired. Start a new job from the menu.", view: "hof" });
      return;
    }
    if (s.phase === "preseason") {
      set({ view: "schedule", toast: "Set your schedule first." });
      return;
    }
    if (s.phase === "offseason") {
      set({ toast: "The year is already in the book." });
      return;
    }
    if (s.phase === "selection" && !s.selection?.revealed) {
      set({ view: "selection", toast: "Watch Selection Sunday, then sim the rest of the year." });
      return;
    }
    const token = ++seasonToken;
    set({ seasonRun: { active: true, lines: get().seasonRun?.lines ?? [] }, toast: null, view: "hub", feedback: null });
    const step = () => {
      if (seasonToken !== token) return;
      const cur = get().state;
      const run = get().seasonRun;
      if (!cur || !run?.active) return;
      if (cur.phase === "offseason") {
        set({ seasonRun: { ...run, active: false }, toast: "The year is in the book." });
        return;
      }
      if (cur.phase === "selection" && !cur.selection?.revealed) {
        set({
          seasonRun: { ...run, active: false },
          view: "selection",
          toast: "Selection Sunday. Watch the show, then sim season to play March.",
        });
        return;
      }
      const mark = `${cur.phase}:${cur.week}:${cur.results.length}`;
      try {
        let base = cur.pendingPresser ? { ...cur, pendingPresser: null } : cur;
        const next = simWeek(base);
        if (seasonToken !== token) {
          persist(next);
          set({ state: next, seasonRun: { active: false, lines: run.lines }, busy: null, starting: false });
          return;
        }
        const fresh = yoursAdded(cur, next).map((r) => seasonLine(next, r));
        const lines = [...fresh, ...run.lines].slice(0, 16);
        persist(next);
        const done = next.phase === "offseason";
        const show = next.phase === "selection" && !next.selection?.revealed;
        const stuck = `${next.phase}:${next.week}:${next.results.length}` === mark;
        set({
          state: next,
          starting: false,
          busy: null,
          view: show ? "selection" : "hub",
          seasonRun: { active: !done && !show && !stuck, lines },
          toast: done ? "The year is in the book." : show ? "Selection Sunday. Watch the show, then sim season to play March." : stuck ? "Nothing left to sim." : null,
        });
        if (done || show || stuck || seasonToken !== token) return;
        window.setTimeout(step, 40);
      } catch (e) {
        if (seasonToken !== token) return;
        failPlay(set, e, "Season sim stopped. Something in the save is missing.");
        set({ seasonRun: { active: false, lines: run.lines } });
      }
    };
    afterPaint(step);
  },

  stopSeason: () => {
    const run = get().seasonRun;
    if (!run?.active) return;
    seasonToken += 1;
    set({ seasonRun: { ...run, active: false }, toast: "Season sim stopped. Change the rotation, then sim again." });
  },

  playGame: () => {
    const s = get().state;
    if (!s) return;
    if (get().starting || get().busy || get().seasonRun?.active) return;
    if (s.retired) {
      set({ toast: "You retired. Start a new job from the menu.", view: "hof" });
      return;
    }
    if (s.pendingStory) {
      set({ view: "story" });
      return;
    }
    if (s.phase === "selection" && !s.selection?.revealed) {
      set({ view: "selection" });
      return;
    }
    if (s.phase === "preseason") {
      set({ toast: "Set your schedule first." });
      return;
    }
    try {
      const next = beginLiveGame(s);
      if (!next) {
        set({ toast: "No game to play." });
        return;
      }
      apply(get, set, next, { view: "game" });
    } catch (e) {
      failPlay(set, e, "Couldn't start that game. Something in the save is missing.");
    }
  },

  callOff: (id) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, setLiveCall(s, "off", id));
  },
  callDef: (id) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, setLiveCall(s, "def", id));
  },
  runPlay: () => {
    const s = get().state;
    if (!s) return;
    try {
      apply(get, set, runLivePossession(s), { view: "game" });
    } catch (e) {
      failPlay(set, e, "That possession didn't run.");
    }
  },
  runCall: (side, id) => {
    const s0 = get().state;
    if (!s0) return;
    try {
      const s = s0.liveGame && !s0.liveGame.planned ? lockGamePlan(s0) : s0;
      apply(get, set, runLivePossession(setLiveCall(s, side, id)), { view: "game" });
    } catch (e) {
      failPlay(set, e, "That call didn't run.");
    }
  },
  runLate: (choice) => {
    const s0 = get().state;
    if (!s0) return;
    try {
      const s = s0.liveGame && !s0.liveGame.planned ? lockGamePlan(s0) : s0;
      apply(get, set, runLivePossession(queueLate(s, choice)), { view: "game" });
    } catch (e) {
      failPlay(set, e, "That call didn't run.");
    }
  },
  forceEndgame: () => {
    let s = get().state;
    if (!s) return;
    try {
      if (!s.liveGame || s.liveGame.done) {
        const started = beginLiveGame(s);
        if (!started?.liveGame) {
          set({ toast: "No game to force. Tip one off first." });
          return;
        }
        s = lockGamePlan(started);
      } else if (!s.liveGame.planned) {
        s = lockGamePlan(s);
      }
      if (!s?.liveGame) return;
      apply(get, set, forceEndgameState(s), { view: "game" });
    } catch (e) {
      failPlay(set, e, "Couldn't set that finish.");
    }
  },
  forceTwoFor: () => {
    let s = get().state;
    if (!s) return;
    try {
      if (!s.liveGame || s.liveGame.done) {
        const started = beginLiveGame(s);
        if (!started?.liveGame) {
          set({ toast: "No game to force. Tip one off first." });
          return;
        }
        s = lockGamePlan(started);
      } else if (!s.liveGame.planned) {
        s = lockGamePlan(s);
      }
      if (!s?.liveGame) return;
      apply(get, set, forceTwoForState(s), { view: "game" });
    } catch (e) {
      failPlay(set, e, "Couldn't set the 2-for-1.");
    }
  },
  setPace: (pace) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, setLivePace(s, pace), { view: "game" });
  },
  setLook: (id) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, setLiveCall(s, "off", id), { view: "game" });
  },
  subPlayer: (id) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, toggleLiveSub(s, id), { view: "game" });
  },
  sitTrouble: () => {
    const s = get().state;
    if (!s) return;
    apply(get, set, sitFoul(s), { view: "game" });
  },
  takeTimeout: () => {
    const s = get().state;
    if (!s?.liveGame || s.liveGame.done) return;
    try {
      const next = callTimeout(s);
      if (next === s) {
        set({ toast: "No timeouts left." });
        return;
      }
      apply(get, set, next, { view: "game" });
    } catch (e) {
      failPlay(set, e, "Couldn't take that timeout.");
    }
  },
  simRest: () => {
    const s0 = get().state;
    if (!s0) return;
    if (get().busy) return;
    const gen = ++bootGen;
    set({ busy: "Playing it out" });
    afterPaint(() => {
      if (bootGen !== gen) return;
      try {
        const s = s0.liveGame && !s0.liveGame.planned ? lockGamePlan(s0) : s0;
        apply(get, set, runLiveRest(s, { finish: false }), { view: "game" });
      } catch (e) {
        if (bootGen !== gen) return;
        failPlay(set, e, "Couldn't finish that game.");
      }
    });
  },
  simToEnd: () => {
    const s0 = get().state;
    if (!s0) return;
    if (get().busy) return;
    const gen = ++bootGen;
    set({ busy: "Playing it out" });
    afterPaint(() => {
      if (bootGen !== gen) return;
      try {
        const s = s0.liveGame && !s0.liveGame.planned ? lockGamePlan(s0) : s0;
        apply(get, set, runLiveRest(s), { view: "game" });
      } catch (e) {
        if (bootGen !== gen) return;
        failPlay(set, e, "Couldn't finish that game.");
      }
    });
  },
  leaveGame: () => {
    const s = get().state;
    if (!s) return;
    try {
      if (s.liveGame?.sandbox) {
        apply(get, set, { ...s, liveGame: null }, { view: "hub", toast: "Test game — not counted." });
        return;
      }
      if (s.liveGame && !s.liveGame.done && !s.liveGame.planned) {
        apply(get, set, { ...s, liveGame: null }, { view: "hub" });
        return;
      }
      const slotId = s.liveGame?.slotId;
      const closed = s.liveGame?.done ? closeLive(s) : s;
      if (s.liveGame?.done && slotId) goRecap(get, set, closed, slotId);
      else apply(get, set, closed, { view: afterSimView(closed) });
    } catch (e) {
      failPlay(set, e, "Couldn't leave that game.");
    }
  },
  skipPresser: () => {
    const s = get().state;
    if (!s?.pendingPresser) {
      set({ view: "hub" });
      return;
    }
    apply(get, set, { ...s, pendingPresser: null, lastPresserWeek: s.week }, { view: "hub" });
  },

  openRecap: (id, from) => {
    const s = get().state;
    if (!s) return;
    const filled = withFilledRecap(s, id);
    apply(get, set, filled, { view: "recap", recapId: id, recapReturn: from ?? (get().view === "recap" ? get().recapReturn : get().view) });
  },

  closeRecap: () => {
    const s = get().state;
    const back = get().recapReturn || (s ? afterSimView(s) : "hub");
    set({ view: back, recapId: null });
  },

  finishSelectionShow: () => {
    const s = get().state;
    if (!s) return;
    try {
      apply(get, set, revealSelection(s), { view: "bracketology" });
    } catch (e) {
      failPlay(set, e, "Couldn't open Selection Day.");
    }
  },

  scout: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = scoutRecruit(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "That recruit isn't on your list.");
    }
  },
  offer: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = offerRecruit(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "Couldn't send that offer.");
    }
  },
  visit: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = visitRecruit(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "Couldn't book that visit.");
    }
  },
  sign: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = signRecruit(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "Couldn't close that pledge.");
    }
  },
  forceSign: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, ok, detail } = forceCommit(s, id);
    if (!ok) {
      set({ toast: detail });
      return;
    }
    apply(get, set, state, { feedback: { title: "Committed", detail, parts: [{ label: "Commit", delta: 1 }] } });
  },
  dropRecruit: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = dropTarget(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "Couldn't drop that target.");
    }
  },
  pitchNil: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = bumpNilPitch(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "Couldn't pitch NIL.");
    }
  },
  portalScout: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = scoutPortal(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "That name isn't in the portal.");
    }
  },
  portalOffer: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = offerPortal(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "Couldn't send that portal offer.");
    }
  },
  portalVisit: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = visitPortal(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "Couldn't book that portal visit.");
    }
  },
  portalSign: (id) => {
    const s = get().state;
    if (!s) return;
    try {
      const { state, feedback } = signPortal(s, id);
      apply(get, set, state, { feedback });
    } catch (e) {
      failPlay(set, e, "Couldn't close that portal deal.");
    }
  },
  setAssisted: (on) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = setAssistedRecruit(s, on);
    apply(get, set, state, { feedback });
  },
  pep: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = pepTalk(s, id);
    apply(get, set, state, { feedback });
  },
  redshirt: (id, on) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = setRedshirt(s, id, on);
    apply(get, set, state, { feedback });
  },
  talkStay: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = tryStay(s, id);
    apply(get, set, state, { feedback, view: "draft" });
  },
  letGo: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = sendDeclare(s, id);
    apply(get, set, state, { feedback, view: "draft" });
  },
  bumpMinutes: (id, d) => {
    const s = get().state;
    if (!s) return;
    const p = s.players.find((x) => x.id === id);
    if (!p) return;
    apply(get, set, setPlayerMpg(s, id, p.mpg + d), {
      feedback: { title: `${p.first} minutes`, detail: `${Math.max(4, Math.min(36, p.mpg + d))} a night.`, parts: [{ label: "MPG", delta: d }] },
    });
  },
  setMinutes: (id, mpg) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, setPlayerMpg(s, id, Math.round(mpg)));
  },
  bumpUsage: (id, d) => {
    const s = get().state;
    if (!s) return;
    const p = s.players.find((x) => x.id === id);
    if (!p) return;
    const next = clampUse((p.usage ?? Math.round(p.mpg * 2.15)) + d);
    apply(get, set, setPlayerUsage(s, id, next), {
      feedback: { title: `${p.first} usage`, detail: `${next}% of the shots.`, parts: [{ label: "Usage", delta: d }] },
    });
  },
  setFocus: (id, focus) => {
    const s = get().state;
    if (!s) return;
    const p = s.players.find((x) => x.id === id);
    apply(get, set, setPlayerFocus(s, id, focus), {
      feedback: { title: p ? `${p.first}'s focus` : "Focus", detail: p ? `${p.first} will work on that.` : "Pick a skill.", parts: [] },
    });
  },
  promise: (id, kind) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = makePromise(s, id, kind);
    apply(get, set, state, { feedback });
  },
  hold: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = holdAccountable(s, id);
    apply(get, set, state, { feedback });
  },
  spendCampPt: (id, d) => {
    const s = get().state;
    if (!s) return;
    const { state, ok, detail } = spendCamp(s, id, d);
    if (!ok) {
      set({ toast: detail });
      return;
    }
    apply(get, set, state, { feedback: { title: "Camp", detail, parts: [{ label: "Pts", delta: -d }] } });
  },
  lockCampNow: () => {
    const s = get().state;
    if (!s) return;
    try {
      const next = lockCamp(s);
      apply(get, set, next, {
        view: "hub",
        feedback: {
          title: "Camp closed",
          detail: next.camp?.jumps[0] ? `${next.camp.jumps[0].name} ${next.camp.jumps[0].before} → ${next.camp.jumps[0].after}. Redshirt calls are open.` : "The gym work is on the film. Redshirt now if you're sitting someone.",
          parts: [],
        },
      });
    } catch (e) {
      failPlay(set, e, "Couldn't close camp.");
    }
  },
  answerStory: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = resolveStory(s, id);
    apply(get, set, state, { feedback, view: "hub" });
  },
  setPlan: (side, index, id) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, setPlanSlot(s, side, index, id), { view: "game" });
  },
  lockPlan: () => {
    const s = get().state;
    if (!s) return;
    apply(get, set, lockGamePlan(s), { view: "game" });
  },
  spendSkill: (axis) => {
    const s = get().state;
    if (!s) return;
    const { state, ok } = spendCoachPoint(s, axis);
    if (!ok) {
      set({ toast: s.skillPoints < 1 ? "No coaching points left." : "That skill is maxed." });
      return;
    }
    apply(get, set, state, { feedback: { title: "Skill point spent", detail: `${axis} went up.`, parts: [{ label: axis, delta: 4 }] } });
  },
  goOffseason: () => {
    const s = get().state;
    if (!s) return;
    if (get().busy) return;
    const gen = ++bootGen;
    set({ busy: "Closing the year" });
    afterPaint(() => {
      if (bootGen !== gen) return;
      try {
        apply(get, set, goOffseason(s), { view: "hub" });
      } catch (e) {
        if (bootGen !== gen) return;
        failPlay(set, e, "Couldn't close the year. Something in the save is missing.");
      }
    });
  },
  nextSeason: () => {
    const s = get().state;
    if (!s) return;
    if (get().busy) return;
    if (s.retired) {
      set({ toast: "You retired. Start a new job from the menu.", view: "hof" });
      return;
    }
    if (draftWaiting(s)) {
      set({ view: "draft", toast: "Stay or go first. An underclassman has a decision to make." });
      return;
    }
    if (campWaiting(s)) {
      set({ view: "camp", toast: "Camp first. Spend the points or lock it as-is." });
      return;
    }
    if (carouselWaiting(s)) {
      set({ view: "carousel", toast: "The carousel is still open." });
      return;
    }
    const review = s.contractReview;
    if (review && !review.resolved && (review.decision === "fire" || review.decision === "extend")) {
      set({
        view: "contract",
        toast: review.decision === "fire" ? "The AD wants a change. You can still stay." : "Sign the extension or walk.",
      });
      return;
    }
    const gen = ++bootGen;
    set({ busy: "Opening next season" });
    afterPaint(() => {
      if (bootGen !== gen) return;
      try {
        const next = startNextSeason(s);
        apply(get, set, next, {
          view: "schedule",
          feedback: {
            title: `${next.season} is open`,
            detail: next.offseasonReport?.incoming.length
              ? `${next.offseasonReport.incoming.map((x) => x.name).join(", ")} signed.`
              : "Camp is open.",
            parts: [],
          },
        });
      } catch (e) {
        if (bootGen !== gen) return;
        failPlay(set, e, "Couldn't open next season. Something in the save is missing.");
      }
    });
  },
  signDeal: () => {
    const s = get().state;
    if (!s) return;
    const { state, ok } = signExtension(s);
    if (!ok) {
      set({ toast: "Nothing to sign." });
      return;
    }
    apply(get, set, state, {
      view: "hub",
      feedback: {
        title: "Signed",
        detail: `${state.contract?.years} years. ${state.contract?.clauses.map((c) => c.label).join(" and ")}.`,
        parts: [{ label: "Years", delta: state.contract?.years ?? 0 }],
      },
    });
  },
  takeJob: (teamId) => {
    const s = get().state;
    if (!s) return;
    let next = takeContractJob(s, teamId);
    if (!next.ok) next = openDreamJob(s, teamId);
    if (!next.ok) {
      set({ toast: "That chair is gone." });
      return;
    }
    apply(get, set, reseatProgram(next.state, teamId), {
      view: next.state.carousel && !next.state.carousel.done ? "carousel" : "hub",
      feedback: {
        title: "New job",
        detail: next.state.snake?.season === next.state.season
          ? `${next.state.snake.to} is yours. The old room already has a name for it.`
          : `${next.state.contract?.years} years. The AD already wrote the terms.`,
        parts: [{ label: "Years", delta: next.state.contract?.years ?? 0 }],
      },
    });
  },
  walkDeal: () => {
    const s = get().state;
    if (!s) return;
    apply(get, set, walkContract(s), { view: "contract" });
  },
  openContract: () => set({ view: "contract" }),
  advanceCarousel: () => {
    const s = get().state;
    if (!s) return;
    const next = stepCarousel(s);
    const done = Boolean(next.carousel?.done);
    apply(get, set, next, done ? { view: "hub" } : undefined);
  },
  declineCarouselOffer: () => {
    const s = get().state;
    if (!s) return;
    const next = passCarousel(s);
    const done = Boolean(next.carousel?.done);
    const open = Boolean(next.phase === "offseason" && next.carousel && !next.carousel.done);
    apply(get, set, next, { view: done || !open ? "hub" : "carousel", toast: "You stayed." });
  },
  patchLeague: (p) => {
    const s = get().state;
    if (!s) return;
    if (p.soundOn != null) setSoundOn(p.soundOn);
    if (p.haptics != null) setHaptics(p.haptics);
    apply(get, set, patchSettings(s, p));
  },
  moveTeam: (teamId, conference) => {
    const s = get().state;
    if (!s) return;
    const { state, ok, detail } = realign(s, teamId, conference);
    if (!ok) {
      set({ toast: detail });
      return;
    }
    apply(get, set, state, { feedback: { title: "Realignment", detail, parts: [] } });
  },
  retire: () => {
    const s = get().state;
    if (!s) return;
    if ((s.history.seasons ?? 0) < 1 && (s.history.titles ?? 0) < 1 && s.phase !== "offseason") {
      set({ toast: "Coach a year first." });
      return;
    }
    const next = retireCoach(s);
    apply(get, set, next, {
      view: "hof",
      feedback: { title: "Retired", detail: goatLine(next), parts: [] },
    });
  },
  answerNil: (playerId, yes) => {
    const s = get().state;
    if (!s) return;
    const ask = (s.nilAsks ?? []).find((a) => a.playerId === playerId);
    apply(get, set, answerNilAsk(s, playerId, yes), {
      feedback: {
        title: yes ? "Raise paid" : "Told him no",
        detail: ask ? `${ask.name} asked for ${ask.ask}.` : "",
        parts: yes && ask ? [{ label: "NIL", delta: -ask.ask }] : [],
      },
    });
  },
  clearFlash: () => {
    const s = get().state;
    if (!s?.flash) return;
    apply(get, set, { ...s, flash: null });
  },
  answer: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = answerPresser(s, id);
    apply(get, set, state, {
      feedback,
      view: state.phase === "selection" && !state.selection?.revealed ? "selection" : "hub",
    });
  },
  readMail: (id) => {
    const s = get().state;
    if (!s) return;
    apply(get, set, markRead(s, id));
  },
  clearFeedback: () => set({ feedback: null }),
  clearToast: () => set({ toast: null }),
  cancelStart: () => {
    bootGen += 1;
    seasonToken += 1;
    const run = get().seasonRun;
    set({ starting: false, busy: null, toast: null, seasonRun: run ? { ...run, active: false } : null });
  },
  hire: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = hireStaff(s, id);
    apply(get, set, state, { feedback });
  },
  fire: (role) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = fireStaff(s, role);
    apply(get, set, state, { feedback });
  },
  upgrade: (kind) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = upgradeFacility(s, kind);
    apply(get, set, state, { feedback });
  },
  setPractice: (plan) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = setPracticePlan(s, plan);
    apply(get, set, state, { feedback });
  },
  nameCaptain: (id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = seatCaptain(s, id);
    apply(get, set, state, { feedback });
  },
  nameStarter: (pos, id) => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = seatStarter(s, pos, id);
    apply(get, set, state, { feedback });
  },
  scoutOpp: () => {
    const s = get().state;
    if (!s) return;
    const { state, feedback } = scoutOpponent(s);
    apply(get, set, state, { feedback });
  },
  inviteCup: (guestId) => {
    const s = get().state;
    if (!s) return;
    let week = 1;
    for (let w = 1; w <= 18; w++) {
      const n = s.schedule.filter((g) => !g.declined && g.week === w && (g.homeId === s.playerTeamId || g.awayId === s.playerTeamId)).length;
      if (n < 3) {
        week = w;
        break;
      }
    }
    const { state, feedback } = inviteExhibition(s, guestId, week);
    apply(get, set, state, { feedback });
  },
  editRating: (id, d) => {
    const s = get().state;
    if (!s || !s.settings?.godMode) return;
    const p = s.players.find((x) => x.id === id);
    if (!p) return;
    const bump = (n: number) => Math.max(40, Math.min(99, n + d));
    const skills = {
      shoot: bump(p.skills?.shoot ?? p.ovr),
      finish: bump(p.skills?.finish ?? p.ovr),
      defense: bump(p.skills?.defense ?? p.ovr),
      iq: bump(p.skills?.iq ?? p.ovr),
    };
    const ovr = Math.round((skills.shoot + skills.finish + skills.defense + skills.iq) / 4);
    apply(get, set, {
      ...s,
      players: s.players.map((x) => (x.id === id ? { ...x, skills, ovr, potential: Math.max(x.potential, ovr) } : x)),
    }, { feedback: { title: `${p.first} ${p.last}`, detail: `Rating ${ovr}.`, parts: [{ label: "OVR", delta: d }] } });
  },
  loadTournament: () => {
    const s = get().state;
    if (!s) return;
    const roster = s.players
      .filter((p) => p.teamId === s.playerTeamId && !p.redshirt && !(p.injury && p.injury.weeksLeft > 0))
      .sort((a, b) => b.ovr - a.ovr || b.mpg - a.mpg);
    const mpgOf = (i: number) => (i < 5 ? 32 : i < 8 ? 16 : 4);
    const players = s.players.map((p) => {
      const i = roster.findIndex((x) => x.id === p.id);
      if (i < 0) return p;
      const mpg = mpgOf(i);
      const usage = Math.max(6, Math.min(40, Math.round(mpg * (i < 5 ? 2.3 : 1.6))));
      return { ...p, mpg, usage };
    });
    apply(get, set, { ...s, players }, {
      feedback: { title: "Tournament minutes", detail: "Starters play 32. The next three play 16. Everyone else plays the leftovers.", parts: [] },
    });
  },
  importLeague: (raw) => {
    try {
      const state = readSaveText(raw);
      apply(get, set, state, { view: "hub", feedback: { title: "League loaded", detail: "Save came in. Same world, this device.", parts: [] } });
    } catch {
      set({ toast: "That file isn't a Dribble save." });
    }
  },
  exportLeague: () => {
    const s = get().state;
    return s ? saveText(s) : "";
  },
  createSchool: (input) => {
    const school = addCustomSchool(input);
    if (!school) {
      set({ toast: "Give the school a name." });
      return;
    }
    const s = get().state;
    const next = s ? worldWithCustom(s, school) : null;
    if (next) persist(next);
    set({
      namesStamp: get().namesStamp + 1,
      toast: `${school.name} is on the Division I board.`,
      selectedTeamId: school.id,
      ...(next ? { state: next } : {}),
    });
  },
}));

