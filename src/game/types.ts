export type ConferenceId =
  | "AE" | "AAC" | "ACC" | "ASUN" | "A10" | "BE" | "BSKY" | "BSOU" | "B10" | "B12"
  | "BW" | "CAA" | "CUSA" | "HOR" | "IVY" | "MAAC" | "MAC" | "MEAC" | "MVC" | "MW"
  | "NEC" | "OVC" | "PAT" | "P12" | "SEC" | "SOC" | "SLAND" | "SWAC" | "SUM" | "SBC"
  | "UAC" | "WCC" | "SWC" | "IND";

export type View =
  | "title" | "select" | "create" | "eras" | "tutorial" | "hub" | "roster" | "schedule"
  | "recruiting" | "standings" | "news" | "bracketology" | "bracket" | "game" | "inbox"
  | "presser" | "saves" | "team" | "selection" | "names" | "hof" | "contract" | "compliance"
  | "recap" | "analytics" | "market" | "draft" | "camp" | "awards" | "story" | "settings" | "search"
  | "burner" | "podcasts" | "merch" | "places" | "records" | "leaders" | "program" | "player" | "archives" | "carousel";


export type Phase = "preseason" | "regular" | "conference" | "selection" | "ncaa" | "nit" | "crown" | "offseason";
export type Site = "home" | "away" | "neutral";
export type Pos = "PG" | "SG" | "SF" | "PF" | "C";
export type OffScheme = "motion" | "spread" | "post" | "transition" | "iso";
export type OffPlay = "motion" | "pnr" | "post" | "iso" | "spread" | "push" | "horns" | "floppy" | "delay" | "hammer";
export type DefPlay = "man" | "zone" | "press" | "pack" | "trap" | "switch" | "foul" | "sag";

export interface ShotMark {
  x: number;
  y: number;
  made: boolean;
  three: boolean;
  home: boolean;
}

export interface CountStats {
  g: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
}

export interface RecordMark {
  season: number;
  oppId: string;
  pf: number;
  pa: number;
}

export interface RecordBook {
  teamId: string;
  allW: number;
  allL: number;
  titles: number;
  longestHome?: number;
  bestSeason?: { season: number; w: number; l: number };
  biggestWin?: RecordMark;
  worstLoss?: RecordMark;
  playerGame?: { name: string; pts: number; season: number; oppId: string };
}

export interface LeaderRow {
  id: string;
  name: string;
  teamId: string;
  abbr: string;
  pos: Pos;
  val: number;
  gp: number;
  yours: boolean;
}

export interface LeaderSnap {
  week: number;
  season: number;
  pts: LeaderRow[];
  reb: LeaderRow[];
  ast: LeaderRow[];
  fg: LeaderRow[];
  three: LeaderRow[];
}

export interface LiveEvent {
  t: string;
  text: string;
  homeScore: number;
  awayScore: number;
  impact?: string;
  pts?: number;
  kind?: "two" | "three" | "ft" | "to" | "period";
  made?: boolean;
  poss?: "home" | "away";
  x?: number;
  y?: number;
  playerId?: string;
  astId?: string;
}

export interface LiveGame {
  slotId: string;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  half: number;
  clock: number;
  poss: "home" | "away";
  offCall: OffPlay;
  defCall: DefPlay;
  log: LiveEvent[];
  done: boolean;
  lastYouOff?: OffPlay;
  lastYouDef?: DefPlay;
  planned?: boolean;
  planOff?: OffPlay[];
  planDef?: DefPlay[];
  htAdj?: boolean;
  homeLines?: RecapPlayer[];
  awayLines?: RecapPlayer[];
  timeoutsHome?: number;
  timeoutsAway?: number;
  timeoutBoost?: number;
  shots?: ShotMark[];
  /** Next-possession tempo. Slow parks the ball; fast shortens the clock. */
  pace?: "slow" | "normal" | "fast";
  /** Player ids on the floor. Unset means the rotation picks them. */
  homeOn?: string[];
  awayOn?: string[];
  foulAlert?: { id: string; name: string; fouls: number } | null;
  /** One-shot endgame choice. Cleared after the possession. */
  lateChoice?: "foul3" | "letplay" | "twofor" | null;
  /** Already stopped once at 0:12 so the foul-up-3 choice can appear. */
  parked12?: boolean;
  /** Half in which the 2-for-1 look was surfaced. */
  parked2Half?: number;
  /** God Mode / dev endgame jump. Closing it does not write a season result. */
  sandbox?: boolean;
}
export type RecruitPath = "hs" | "juco";

export interface Injury {
  part: string;
  weeksLeft: number;
}

export type PortalReason = "minutes" | "nil" | "chemistry" | "scheme" | "hometown" | "coaching" | "draft" | "role";
export type PortalWindow = "none" | "closed" | "winter" | "spring";
export type PortalRole = "starter" | "rotation" | "bench";

export interface Transfer {
  id: string;
  playerId: string;
  first: string;
  last: string;
  pos: Pos;
  year: number;
  ovr: number;
  potential: number;
  stars: number;
  mpg: number;
  morale: number;
  skills: PlayerSkills;
  fromId: string;
  reason: PortalReason;
  role: PortalRole;
  yearsLeft: number;
  path?: RecruitPath;
  usedRedshirt?: boolean;
  redshirt?: boolean;
  scouted: boolean;
  offers: string[];
  visits: string[];
  interest: Record<string, number>;
  committedTo: string | null;
  nilAsk: number;
  wants: RecruitWants;
  window: "winter" | "spring";
  boomerang?: boolean;
  seasonMinutes: number;
  seasonGames: number;
  careerMinutes: number;
  careerGames: number;
  injury?: Injury | null;
}

export interface PortalState {
  season: number;
  window: PortalWindow;
  transfers: Transfer[];
  hours: number;
}

export interface Conference {
  id: ConferenceId;
  name: string;
  short: string;
  prestige: number;
}

export interface TeamSeed {
  id: string;
  name: string;
  mascot: string;
  abbr: string;
  conference: ConferenceId;
  city: string;
  state: string;
  color: string;
  prestige: number;
}

export interface CoachIdentity {
  first: string;
  last: string;
  age: number;
  almaMaterId?: string | null;
}

export interface PlayerSkills {
  shoot: number;
  finish: number;
  defense: number;
  iq: number;
}

export type CoachAxis = "offense" | "defense" | "recruiting" | "development" | "leadership";

export interface CoachSkills {
  offense: number;
  defense: number;
  recruiting: number;
  development: number;
  leadership: number;
}

export interface DevLine {
  id: string;
  name: string;
  before: number;
  after: number;
}

export interface OffseasonReport {
  grew: DevLine[];
  graduated: { name: string; ovr: number }[];
  incoming: { name: string; ovr: number }[];
  walkons: { name: string; ovr: number }[];
  pointsEarned: number;
}

export type DevFocus = "shoot" | "finish" | "defense" | "iq" | "balanced";

export interface GrowthYear {
  season: number;
  ovr: number;
  focus: DevFocus;
  jump: number;
  note?: string;
}

export interface CampJump {
  id: string;
  name: string;
  before: number;
  after: number;
  skill: string;
}

export interface CampState {
  season: number;
  points: number;
  spent: Record<string, number>;
  focuses: Record<string, DevFocus>;
  locked: boolean;
  jumps: CampJump[];
}

export type PromiseKind = "minutes" | "start" | "nil" | "develop";

export interface PlayerPromise {
  id: string;
  playerId: string;
  kind: PromiseKind;
  target: number;
  season: number;
  text: string;
  kept?: boolean | null;
}

export interface StoryChoice {
  id: string;
  label: string;
  tone: "even" | "hot" | "cool";
}

export interface StoryEvent {
  id: string;
  week: number;
  title: string;
  body: string;
  playerIds: string[];
  choices: StoryChoice[];
}

export type AwardKind = "poy" | "dpoy" | "freshman" | "all-american" | "all-conf" | "coach";

export interface Award {
  season: number;
  kind: AwardKind;
  team: "1st" | "2nd" | "3rd" | "";
  playerId?: string;
  teamId: string;
  name: string;
  pos?: Pos;
  yours: boolean;
}

export interface CardGrade {
  label: string;
  letter: string;
  note: string;
}

export interface SeasonCard {
  season: number;
  expectedWins: number;
  expectedNcaa: boolean;
  grades: CardGrade[];
  overall: string;
  letter: string;
}

export interface Expectations {
  wins: number;
  ncaa: boolean;
  note: string;
}

export type Difficulty = "easy" | "realistic" | "hard" | "extreme" | "impossible";

export interface LeagueSettings {
  difficulty: Difficulty;
  godMode: boolean;
  nilOn: boolean;
  flipsOn: boolean;
  teamColor: boolean;
  forceWin: boolean;
  soundOn?: boolean;
  reducedMotion?: boolean;
  largerType?: boolean;
  haptics?: boolean;
  /** How hard it is to land a transfer, and how many kids enter. */
  portalStrict?: "open" | "normal" | "tight";
  customLeague?: { name: string; teams: string[] };
}

export interface Donor {
  id: string;
  name: string;
  gift: number;
  fromPlayerId?: string;
  season: number;
}

export interface NilAsk {
  playerId: string;
  name: string;
  ask: number;
  resolved?: "yes" | "no";
}

export interface Potw {
  week: number;
  season: number;
  playerId: string;
  name: string;
  teamId: string;
  line: string;
  yours: boolean;
}

export interface ProFranchise {
  id: string;
  name: string;
  abbr: string;
  city: string;
}

export interface ProClass {
  season: number;
  picks: DraftPick[];
}

export interface PendingFlash {
  kind: "commit" | "flip" | "decommit";
  name: string;
  stars?: number;
  pos?: string;
  detail: string;
}

export interface GamePlan {
  off: [OffPlay, OffPlay, OffPlay];
  def: [DefPlay, DefPlay];
}

export interface Player {
  id: string;
  first: string;
  last: string;
  pos: Pos;
  year: number;
  ovr: number;
  potential: number;
  morale: number;
  teamId: string;
  mpg: number;
  skills: PlayerSkills;
  seasonMinutes: number;
  seasonGames: number;
  careerMinutes: number;
  careerGames: number;
  stats?: CountStats;
  career?: CountStats;
  path?: RecruitPath;
  redshirt?: boolean;
  usedRedshirt?: boolean;
  injury?: Injury | null;
  portalFrom?: string;
  portalSeason?: number;
  focus?: DevFocus;
  growth?: GrowthYear[];
  usage?: number;
  country?: string;
  freak?: boolean;
  freakTag?: string;
  height?: string;
  awards?: string[];
}

export interface RecruitWants {
  home: number;
  minutes: number;
  scheme: number;
  academics: number;
  nil: number;
  style: OffScheme;
}

export interface Recruit {
  id: string;
  first: string;
  last: string;
  pos: Pos;
  stars: number;
  ovr: number;
  potential: number;
  state: string;
  scouted: boolean;
  offers: string[];
  visits: string[];
  interest: Record<string, number>;
  committedTo: string | null;
  nilAsk: number;
  wants: RecruitWants;
  skills: PlayerSkills;
  path?: RecruitPath;
  country?: string;
  freak?: boolean;
  freakTag?: string;
  height?: string;
  flipped?: boolean;
  dropped?: boolean;
  heatWas?: number;
  /** One commitment ask per week. A miss stays a miss if the save is reopened. */
  signAsk?: { season: number; week: number; hit: boolean };
}

export interface TeamRuntime {
  id: string;
  conference: ConferenceId;
  prestige: number;
  wins: number;
  losses: number;
  confW: number;
  confL: number;
  homeW: number;
  homeL: number;
  homeStreak: number;
  gymW?: number;
  gymL?: number;
  gymPf?: number;
  gymPa?: number;
  coachName: string;
  /** Seasons already spent on this job. Missing on old saves. */
  coachYear?: number;
  allWins: number;
  allLosses: number;
  series?: Record<string, SeriesMark>;
  /** Set on exhibition guests. They are not in the Division I board. */
  guest?: "D2" | "D3" | "NAIA";
}

export interface GameSlot {
  id: string;
  week: number;
  homeId: string;
  awayId: string;
  site: Site;
  kind: "conference" | "noncon" | "mte" | "conf-tourney" | "ncaa" | "nit" | "crown";
  resultId?: string;
  declined?: boolean;
  /** Exhibition cup. Opponent is not a Division I member. */
  cup?: "D2" | "D3" | "NAIA";
}

export interface SeriesMark {
  w: number;
  l: number;
  last: string;
  lastWin: boolean;
  streak: number;
}

export interface RecapPlayer {
  id: string;
  name: string;
  pos: Pos;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  fgm: number;
  fga: number;
  tpm?: number;
  tpa?: number;
  ftm?: number;
  fta?: number;
  to?: number;
  stl?: number;
  blk?: number;
  pf?: number;
}

export interface GameRecap {
  headline: string;
  lede: string;
  grafs: string[];
  notes: string[];
  keyPlay: string;
  played: boolean;
  homeLeaders: RecapPlayer[];
  awayLeaders: RecapPlayer[];
  homePpp: number;
  awayPpp: number;
  homeTo: number;
  awayTo: number;
  homeOrb: number;
  awayOrb: number;
  shots?: ShotMark[];
}

export interface GameBox {
  poss: number;
  fga: number;
  orb: number;
  to: number;
  fta: number;
}

export interface GameResult {
  id: string;
  slotId: string;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  week: number;
  minutes?: number;
  homeBox?: GameBox;
  awayBox?: GameBox;
  recap?: GameRecap;
}

export interface Mail {
  id: string;
  from: string;
  subject: string;
  body: string;
  week: number;
  read: boolean;
  tone: "good" | "bad" | "even";
}

export interface NewsArticle {
  id: string;
  week: number;
  season?: number;
  tone: "good" | "bad" | "even";
  kicker: string;
  headline: string;
  dek: string;
  byline: string;
  outlet: string;
  grafs: string[];
  resultId?: string;
  names?: { name: string; id: string; kind: "player" | "recruit" | "portal" }[];
  text: string;
}

export type PodcastShowId = "catican" | "lockedon";

export interface PodcastHost {
  id: string;
  name: string;
}

export interface PodcastShow {
  id: PodcastShowId;
  name: string;
  tagline: string;
  kicker: string;
  network: string;
  homeId: string;
  hosts: PodcastHost[];
}

export interface PodcastBeat {
  speaker: string;
  line: string;
}

export interface PodcastEpisode {
  id: string;
  showId: PodcastShowId;
  week: number;
  season: number;
  phase: Phase;
  title: string;
  dek: string;
  runtime: string;
  beats: PodcastBeat[];
  resultId?: string;
  names?: { name: string; id: string; kind: "player" | "recruit" | "portal" }[];
}

export interface PresserChoice {
  id: string;
  label: string;
  tone: "even" | "hot" | "cool";
  morale: number;
  ad: number;
  fans: number;
}

export interface PresserQuestion {
  id: string;
  prompt: string;
  from?: string;
  choices: PresserChoice[];
}

export interface Presser {
  gameId: string;
  questions: PresserQuestion[];
  asked: number;
  log: { question: string; answer: string; morale: number; ad: number; fans: number }[];
  kicker?: string;
}

export interface Feedback {
  title: string;
  detail: string;
  parts: { label: string; delta: number }[];
}

export interface MteTemplate {
  id: string;
  name: string;
  site: string;
  week: number;
  size: number;
  minPrestige: number;
}

export type NcaaRegion = "East" | "West" | "South" | "Midwest";

export interface NcaaBid {
  teamId: string;
  seed: number;
  region: NcaaRegion;
  path: "auto" | "at-large";
  playIn?: boolean;
}

export interface SelectionBoard {
  autos: Record<string, string>;
  ncaa: NcaaBid[];
  nit: string[];
  crown: string[];
  champ?: string;
  nitChamp?: string;
  crownChamp?: string;
  confTourney?: string;
  confField?: string[];
  revealed?: boolean;
}

export type MarchRun = "bid" | "s16" | "e8" | "f4" | "title" | "nit" | "crown";

export interface SeasonLog {
  season: number;
  teamId: string;
  wins: number;
  losses: number;
  confW: number;
  confL: number;
  coachName: string;
  confTitle: boolean;
  ncaaBid: boolean;
  title: boolean;
  poy?: string;
  run?: MarchRun;
  /** One-line year summary written at Selection Sunday and refreshed when the year closes. */
  summary?: string;
  /** Career counters already applied for this season. */
  counted?: boolean;
  championId?: string;
  awards?: { name: string; kind: string; teamId: string }[];
  standings?: { conf: string; rows: { id: string; w: number; l: number }[] }[];
  boxes?: ArchiveBox[];
  leaders?: { name: string; teamId: string; pts: number }[];
  legends?: ProgramLegend[];
}

export interface ArchiveBox {
  id: string;
  week: number;
  homeId: string;
  awayId: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  line?: string;
}

export interface ProgramLegend {
  name: string;
  number: string;
  teamId: string;
  season: number;
  note: string;
}

export interface PipelineBook {
  /** Home-state abbreviation → in-state signs remembered, capped at 8. */
  states: Record<string, number>;
  /** Home-state abbreviation → scout/offer/visit memory, capped at 48. */
  ties: Record<string, number>;
}

export interface WatchName {
  name: string;
  teamId: string;
  yours: boolean;
  pos: Pos;
  ovr: number;
}

export type ClauseKind = "wins" | "confWins" | "ncaa" | "postseason" | "confTitle";

export interface ContractClause {
  kind: ClauseKind;
  target: number;
  label: string;
}

export interface ClauseResult extends ContractClause {
  actual: number;
  met: boolean;
}

export interface CoachContract {
  years: number;
  remaining: number;
  signedSeason: number;
  yearOnJob: number;
  clauses: ContractClause[];
}

export interface JobOffer {
  teamId: string;
  contract: CoachContract;
}

export interface ContractReview {
  season: number;
  results: ClauseResult[];
  standing: boolean;
  remainingAfter: number;
  decision: "continue" | "extend" | "fire";
  letter: string;
  offer?: CoachContract;
  jobs: JobOffer[];
  resolved: boolean;
  record: string;
  /** Walked out, or left a job that still wanted him. */
  abrupt?: boolean;
}

export type ComplianceKind = "apr" | "nil" | "visits" | "dead" | "extra";
export type ComplianceSeverity = "watch" | "notice" | "major";

export interface ComplianceFlag {
  id: string;
  kind: ComplianceKind;
  severity: ComplianceSeverity;
  week: number;
  text: string;
}

export interface ComplianceState {
  heat: number;
  apr: number;
  banned: boolean;
  flags: ComplianceFlag[];
  visitsThisWeek: number;
}

export type SheetSide = "home" | "away" | "over" | "under";
export type SheetKind = "spread" | "total";

export interface SheetPick {
  id: string;
  slotId: string;
  week: number;
  kind: SheetKind;
  side: SheetSide;
  number: number;
  result?: "win" | "loss" | "push";
}

export interface MarketSheet {
  picks: SheetPick[];
  wins: number;
  losses: number;
  pushes: number;
}

export interface CoachHistory {
  seasons: number;
  wins: number;
  losses: number;
  titles: number;
  ncaaBids: number;
  confTitles: number;
  sweet16: number;
  elite8: number;
  finalFour: number;
  nitBids: number;
  log: SeasonLog[];
}

export interface DraftPick {
  playerId: string;
  name: string;
  pos: Pos;
  ovr: number;
  teamId: string;
  round: 1 | 2;
  pick: number;
  yours: boolean;
  proId?: string;
  proName?: string;
}

export interface DraftRow {
  playerId: string;
  name: string;
  pos: Pos;
  year: number;
  ovr: number;
  potential: number;
  mpg: number;
  band: "lottery" | "first" | "second";
  stayChance: number;
  talked: boolean;
  decided?: "stay" | "go";
}

export interface DraftBoard {
  season: number;
  rows: DraftRow[];
  league: DraftPick[];
  stayed: { name: string; teamId: string }[];
  resolved: boolean;
}

export interface SavedNamePack {
  title: string;
  id?: string;
  note?: string;
  teams?: Record<string, { name?: string; mascot?: string; abbr?: string }>;
  conferences?: Record<string, { name?: string; short?: string }>;
}

export type CoachMoveKind = "fired" | "nba" | "jumped" | "promoted";

export interface CoachMove {
  season: number;
  teamId: string;
  school: string;
  outName: string;
  inName: string;
  kind: CoachMoveKind;
  fromSchool?: string;
  note: string;
}

export interface CarouselBeat {
  id: string;
  teamId: string;
  school: string;
  outName: string;
  inName: string;
  kind: CoachMoveKind;
  fromSchool?: string;
  note: string;
  record: string;
  yours?: boolean;
  decision?: "fire" | "offer";
  offerTeamId?: string;
  fallbackName?: string;
  staffRole?: "oc" | "dc" | "rc";
  applied?: boolean;
  quiet?: boolean;
  /** Last card. Lists what actually happened. */
  recap?: boolean;
}

export interface CarouselSession {
  season: number;
  beats: CarouselBeat[];
  index: number;
  done: boolean;
}

export interface SnakeTalk {
  season: number;
  coach: string;
  from: string;
  to: string;
}

export type StaffRole = "oc" | "dc" | "rc";

export interface StaffCoach {
  id: string;
  name: string;
  role: StaffRole;
  rating: number;
  specialty: string;
  years: number;
  from?: string;
}

export interface StaffBoard {
  oc: StaffCoach | null;
  dc: StaffCoach | null;
  rc: StaffCoach | null;
  pool: StaffCoach[];
  hiresThisYear: number;
}

export type FacilityKind = "practice" | "academics" | "locker" | "training";

export interface Facilities {
  practice: number;
  academics: number;
  locker: number;
  training: number;
  upgradedThisYear: number;
}

export type PracticePlan = "rest" | "film" | "scrimmage" | "hard";

export interface ScoutCard {
  teamId: string;
  week: number;
  identity: string;
  keys: string[];
  pace: string;
  shot: string;
  defense: string;
}

export type ProgramEventKind = "madness" | "media" | "senior" | "rivalry";

export interface ProgramEvent {
  id: string;
  kind: ProgramEventKind;
  week: number;
  season: number;
  title: string;
  body: string;
  done: boolean;
}

export interface DepthChart {
  starters: Partial<Record<Pos, string>>;
  captainId: string | null;
}

export interface GameState {
  version: number;
  seed: number;
  season: number;
  week: number;
  phase: Phase;
  playerTeamId: string;
  teams: Record<string, TeamRuntime>;
  players: Player[];
  recruits: Recruit[];
  schedule: GameSlot[];
  results: GameResult[];
  mail: Mail[];
  news: NewsArticle[];
  podcasts?: PodcastEpisode[];
  identity: CoachIdentity;
  careerMode: boolean;
  eraDecade: number | null;
  nilCap: number;
  donorMood: number;
  adHeat: number;
  fanMood: number;
  scholarships: number;
  recruitingHours: number;
  cpuRecruit: boolean;
  pendingPresser: Presser | null;
  liveGame: LiveGame | null;
  lastPresserWeek: number;
  recentQuestionIds: string[];
  tutorialDone: boolean;
  coachSkills: CoachSkills;
  skillPoints: number;
  offseasonReport: OffseasonReport | null;
  history: CoachHistory;
  selection: SelectionBoard | null;
  namePack?: SavedNamePack | null;
  contract: CoachContract | null;
  contractReview: ContractReview | null;
  compliance: ComplianceState | null;
  sheet: MarketSheet | null;
  draft?: DraftBoard | null;
  portal?: PortalState | null;
  camp?: CampState | null;
  promises?: PlayerPromise[];
  pendingStory?: StoryEvent | null;
  awards?: Award[];
  reportCard?: SeasonCard | null;
  expectations?: Expectations | null;
  gamePlan?: GamePlan | null;
  talksThisWeek?: number;
  settings?: LeagueSettings;
  donors?: Donor[];
  nilAsks?: NilAsk[];
  potw?: Potw[];
  proHistory?: ProClass[];
  flash?: PendingFlash | null;
  gotdId?: string | null;
  retired?: boolean;
  watch?: WatchName[];
  recordBook?: RecordBook;
  leaders?: LeaderSnap;
  staff?: StaffBoard;
  facilities?: Facilities;
  practice?: PracticePlan;
  scouted?: ScoutCard | null;
  events?: ProgramEvent[];
  depth?: DepthChart;
  fatigue?: Record<string, number>;
  /** Multi-year recruiting memory. Optional on old saves. */
  pipelineBook?: PipelineBook;
  /** Commissioner schools created on this device. */
  customSchools?: TeamSeed[];
  legends?: ProgramLegend[];
  /** Coaching changes written as the carousel session plays. */
  coachMoves?: CoachMove[];
  /** Offseason coaching carousel. One chair at a time. */
  carousel?: CarouselSession | null;
  /** Set when the user leaves a school that still had them. */
  snake?: SnakeTalk | null;
}

export const SAVE_VERSION = 31;
export const START_SEASON = 2026;
export const SCHOLARSHIPS = 13;
export const WEEK_HOURS = 10;
export const PORTAL_WINTER_HOURS = 6;
export const PORTAL_SPRING_HOURS = 8;
export const MAX_GAMES = 30;
export const MAX_PER_WEEK = 3;
export const REGULAR_WEEKS = 18;
export const CAREER_MAX_PRESTIGE = 62;
