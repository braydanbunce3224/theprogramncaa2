import type { ConferenceId, TeamSeed } from "./types";
import { TEAM_BY_ID, TEAMS } from "./teams";

const KEY = "dribble-custom-schools";

export interface CustomSchoolInput {
  name: string;
  mascot: string;
  abbr: string;
  color: string;
  city: string;
  stateName: string;
  conference: ConferenceId;
}

let memory: TeamSeed[] = [];

function readList(): TeamSeed[] {
  try {
    if (typeof localStorage === "undefined") return memory.slice();
    const raw = localStorage.getItem(KEY);
    if (!raw) return memory.slice();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return memory.slice();
    return parsed.filter((t) => t && typeof t.id === "string" && typeof t.name === "string");
  } catch {
    return memory.slice();
  }
}

function writeList(list: TeamSeed[]) {
  memory = list.slice();
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode */
  }
}

function mount(seed: TeamSeed) {
  if (!seed?.id || !seed.name) return;
  const row: TeamSeed = {
    id: seed.id,
    name: seed.name,
    mascot: seed.mascot || "Club",
    abbr: (seed.abbr || seed.name.slice(0, 3)).toUpperCase().slice(0, 5),
    conference: seed.conference || "HOR",
    city: seed.city || "Campus",
    state: seed.state || "US",
    color: /^#[0-9a-fA-F]{6}$/.test(seed.color) ? seed.color : "#0E6B4F",
    prestige: Math.max(44, Math.min(62, Math.round(seed.prestige || 56))),
  };
  const prev = TEAM_BY_ID[row.id];
  if (prev) {
    Object.assign(prev, row);
    return;
  }
  TEAMS.push(row);
  TEAM_BY_ID[row.id] = row;
}

export function listCustomSchools(): TeamSeed[] {
  return readList();
}

export function loadCustomSchools() {
  const list = readList();
  const keep = list.filter((t) => !phantomTest(t));
  if (keep.length !== list.length) {
    for (const row of list) {
      if (!phantomTest(row)) continue;
      const i = TEAMS.findIndex((t) => t.id === row.id);
      if (i >= 0) TEAMS.splice(i, 1);
      delete TEAM_BY_ID[row.id];
    }
    writeList(keep);
  }
  for (const row of keep) mount(row);
}

export function mountCustomList(rows: TeamSeed[] | undefined) {
  if (!rows?.length) return;
  const cur = readList();
  let changed = false;
  for (const row of rows) {
    if (!row?.id || phantomTest(row)) continue;
    mount(row);
    if (!cur.some((t) => t.id === row.id)) {
      cur.push(TEAM_BY_ID[row.id]!);
      changed = true;
    }
  }
  if (changed) writeList(cur);
}

function phantomTest(t: { name?: string; mascot?: string; abbr?: string; city?: string }) {
  if ((t.name ?? "").trim().toLowerCase() !== "test u") return false;
  const mascot = (t.mascot ?? "").trim().toLowerCase();
  const abbr = (t.abbr ?? "").trim().toUpperCase();
  const city = (t.city ?? "").trim().toLowerCase();
  return mascot === "trials" || abbr === "TST" || city === "testville";
}

export function isPhantomTest(t: { name?: string; mascot?: string; abbr?: string; city?: string }) {
  return phantomTest(t);
}

function slug(name: string) {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 22);
  return s || "school";
}

export function addCustomSchool(input: CustomSchoolInput): TeamSeed | null {
  loadCustomSchools();
  const name = input.name.trim().slice(0, 32);
  if (!name || phantomTest({ name, mascot: input.mascot, abbr: input.abbr, city: input.city })) return null;
  let id = `custom-${slug(name)}`;
  let n = 2;
  while (TEAM_BY_ID[id] && TEAM_BY_ID[id]!.name !== name) {
    id = `custom-${slug(name)}-${n++}`;
  }
  const seed: TeamSeed = {
    id,
    name,
    mascot: input.mascot.trim().slice(0, 24) || "Club",
    abbr: (input.abbr.trim() || name.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "SCH",
    conference: input.conference || "HOR",
    city: input.city.trim().slice(0, 28) || "Campus",
    state: input.stateName.trim().slice(0, 8) || "US",
    color: /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : "#0E6B4F",
    prestige: 56,
  };
  mount(seed);
  const list = readList().filter((t) => t.id !== seed.id);
  list.push(seed);
  writeList(list);
  return TEAM_BY_ID[seed.id]!;
}

/** Test hook. Pulls a custom school off the live board so a reload can put it back. */
export function unmountCustom(id: string) {
  const i = TEAMS.findIndex((t) => t.id === id);
  if (i >= 0) TEAMS.splice(i, 1);
  delete TEAM_BY_ID[id];
  writeList(readList().filter((t) => t.id !== id));
}

loadCustomSchools();
