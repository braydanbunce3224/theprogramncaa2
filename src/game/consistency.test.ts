import assert from "node:assert/strict";
import { test } from "node:test";
import { lockSchedule, newDynasty, signGate, recruitStage } from "./engine.ts";
import { hydrateState, setPlayerMpg } from "./develop.ts";
import { activeFive, intentionalFoulText, isFoulTrouble } from "./plays.ts";
import type { Player, Recruit } from "./types.ts";

test("a blank alma mater stays blank", () => {
  const born = newDynasty("gonzaga", 7, {
    careerMode: false,
    identity: { first: "Ada", last: "Lane", age: 36, almaMaterId: null },
  });
  assert.equal(born.identity.almaMaterId, null);
  const back = hydrateState({ ...born, identity: { ...born.identity, almaMaterId: "" } });
  assert.equal(back.identity.almaMaterId, null);
  assert.notEqual(back.identity.almaMaterId, "gonzaga");
});

test("minutes and usage are separate controls", () => {
  const born = newDynasty("gonzaga", 8, { careerMode: false, identity: { first: "Ada", last: "Lane", age: 36, almaMaterId: null } });
  const p = born.players.find((x) => x.teamId === "gonzaga")!;
  const next = setPlayerMpg(born, p.id, p.mpg + 4);
  const after = next.players.find((x: { id: string; mpg: number; usage?: number }) => x.id === p.id)!;
  assert.equal(after.mpg, Math.min(38, p.mpg + 4));
  assert.equal(after.usage, p.usage);
});

test("asking to commit uses the shown chance, not a hidden interest floor", () => {
  assert.equal(signGate(false, false), "Put a scholarship on the table first.");
  assert.equal(signGate(true, true), "Already asked this week.");
  assert.equal(signGate(true, false), null);
});

test("a commit is verbal or signed, never both", () => {
  const r = { committedTo: "gonzaga" } as Recruit;
  const early = { phase: "regular", week: 4, settings: { flipsOn: true } } as never;
  const late = { phase: "offseason", week: 0, settings: { flipsOn: true } } as never;
  const hard = { phase: "regular", week: 4, settings: { flipsOn: false } } as never;
  assert.equal(recruitStage(r, "gonzaga", early), "verbal");
  assert.equal(recruitStage(r, "gonzaga", late), "signed");
  assert.equal(recruitStage(r, "gonzaga", hard), "signed");
});

test("the projection is not labeled as the contract", () => {
  const born = newDynasty("gonzaga", 9, { careerMode: false, identity: { first: "Ada", last: "Lane", age: 36, almaMaterId: null } });
  const locked = lockSchedule(born);
  assert.match(locked.expectations?.note ?? "", /Projection, not the contract/);
  assert.doesNotMatch(locked.expectations?.note ?? "", /That's the job/);
});

test("foul trouble is not an ordinary foul", () => {
  assert.equal(isFoulTrouble(1, 18 * 60, 1, true), false);
  assert.equal(isFoulTrouble(1, 18 * 60, 2, true), true);
  assert.equal(isFoulTrouble(1, 8 * 60, 2, true), false);
  assert.equal(isFoulTrouble(1, 8 * 60, 3, false), true);
  assert.equal(isFoulTrouble(2, 10 * 60, 3, true), false);
  assert.equal(isFoulTrouble(2, 10 * 60, 4, false), true);
  assert.equal(isFoulTrouble(3, 60, 4, false), true);
  assert.equal(isFoulTrouble(2, 60, 5, true), false);
});

test("five fouls takes a player off the floor", () => {
  const roster = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `p${n}`, mpg: 30 - n, pos: "PG" })) as Player[];
  const lines = roster.map((p) => ({ id: p.id, pf: p.id === "p1" ? 5 : 0 }));
  const five = activeFive(() => 0.2, roster, lines, ["p1", "p2", "p3", "p4", "p5"]);
  assert.equal(five.some((p) => p.id === "p1"), false);
  assert.equal(five.length, 5);
  assert.equal(five.some((p) => p.id === "p6"), true);
});

test("intentional-foul copy follows the team that fouled", () => {
  assert.match(intentionalFoulText(true, "Reed", "Diaz"), /They sent you/);
  assert.match(intentionalFoulText(false, "Reed", "Diaz"), /You sent them/);
  assert.doesNotMatch(intentionalFoulText(false, "Reed", "Diaz"), /They sent you/);
});
