# Dribble architecture

Read this before changing the sim. One module per job.

## Postgame

There is no postgame press conference. A finished game opens the recap, then the hub. Do not build a podium, and do not route `pendingPresser` anywhere. Old saves that still have one open on the hub with it cleared.

## Live endgame buttons

`src/game/liveControls.ts` is the only list. `endgameMenu()` returns the labels: Foul up 3, Don't foul, Intentional foul, Hold for last, 2-for-1.

`src/components/game/game-view.tsx` renders that list once, in `EndgameBar`. Do not add a second copy in the footer.

`src/game/plays.ts` `queueLate()` applies the choice. `onePoss()` plays it. The 0:12 stop while up 3 uses `FOUL_CLOCK` from `liveControls.ts`.

## Sim odds

Live possessions: `onePoss()` in `src/game/plays.ts`.

Quick-sim: `simContest()` in `src/game/sim.ts`.

Shared line credits and on-court picks: `src/game/sim.ts` (`blankLine`, `credit`, `onCourtFive`). Shared free-throw caps: `src/game/engine-util.ts`.

Do not add a clamp that pulls either engine back to a target average.

## Box scores

`src/game/box.ts` totals a line (TEAM row, FG / 3P / FT / AST / TO / STL / BLK / PF). Live box and the recap both use `playedLines`, so the TEAM row is every player who played, not a sliced top 8. That total is the header.

`src/game/scoreFloor.ts` is the only place that repairs a finished line. A normal possession log is left alone. Any gap between the scoreboard and the box, including overtime, is closed onto that same total. If one player has 70+ points, a 71/0/0, the whole team total, or more than half the shots, `topUp` / `paintTeam` rebuilds a rotation: roughly 44% shooting, no one over the mid-40s, team total unchanged. A 30–45 point night stays. Quick-sim calls `topUp` before the result is saved. `sealLive` does the same.

## 2-for-1

College shot clock is 30 seconds, so the button is not the last 8 seconds. `endgameMenu` shows `2-for-1` only when you have the ball, the lead is 0 to 8, and the clock is 31–40 seconds. `queueLate("twofor")` sets pace to fast and the next possession to an early shot (about 6–9 seconds). A close game parks once per half on that window so the button can appear. Foul up 3, Don't foul, intentional foul, and Hold for last are unchanged. God Mode → Force 2-for-1 sets that exact look. Both force buttons set `liveGame.sandbox`. `closeLive` drops a sandbox game and does not write a result, a box, or a record.

## Win probability

`winProb` in `src/game/depth.ts`. The live clock is seconds (`1200` = 20:00), not minutes. Time left is the clock, plus another 1200 seconds during the first half. Possessions left are `time / 18`, with a floor of 0.35. The logistic is `(margin + possession) / sqrt(possessions) * 0.85`. Possession is about a point and only counts inside the last 40 seconds.

Bands (`winProbBandFails`):

- Down 30 at the half (second half, 20:00): 1–12%.
- Up 2 with the ball at 0:09: 88–99%.
- Up 4 with the ball at 0:04: 95–99%.
- Opening tip, tied: 45–55%.

## Titles, awards, numbers

National champions and "Cut the nets" only after a win in a slot id that starts with `ncaa-title-`. Any earlier NCAA win is the next round (Sweet 16, Elite Eight, Final Four, national championship game). A loss in that game is national runner-up.

Conference champions only when the user won the conference final: `confAliveBefore` is 2 or fewer. A semi is "Advance to the conference final." A loss in the final is "Conference finalist." Confetti only on a real title.

Awards in `src/game/awards.ts` use points, rebounds, and assists per game, plus team wins and conference place. Overall and minutes alone cannot make a 14-point player on a 9th-place team national player of the year.

A retired number (`legendWorthy` in `src/game/archives.ts`) is a national award, 1,800 career points, or an 86-overall senior with real scoring (12 a game or 360 points). At most two a year. The Archives empty state says the same thing.

The record book overwrites best season when that row is the current year, so 20–15 does not stay listed as 20–14. "Longest home win streak" is the record. "Current home streak" is `homeStreak`, which resets on a home loss. Neutral and tournament games are not home games (`slot.site === "home"` only).

## Overtime possession

When regulation or an overtime ends tied, the next period starts with the possession already flipped after the last play: the team that did not just have the ball. The code does not force `poss = "home"`. Later overtimes use the same flip, so it alternates off the last possession.

## Recruiting hours

High school: `scoutRecruit` (1), `offerRecruit` (2), `visitRecruit` (3) in `src/game/engine.ts`. Week pool is `state.recruitingHours`.

Portal hours are separate: `src/game/portal.ts` (`scoutPortal` 1, `offerPortal` 2, `visitPortal` 2).

## Save / load

`src/game/persist.ts`. The store calls `writeSave` / `loadSave`. Do not bump the save shape for a label change.

## Recruiting depth

`src/game/recruit-depth.ts` is the only place that scores a class.

- Pipeline: in-state starts at +8 and gains +2 per remembered in-state sign, cap +16.
- Bond: scout, offer, and visit write memory on that state. It carries into later classes, cap +8.
- Rival battle: a real rival within 8 interest points cuts the sign chance, up to −10.
- Class pressure: the second pledge at a position is −6. The third is −12.
- Lean math on the recruiting card is the same formula as `signChance`.

`interestIn` and `signChance` in `src/game/engine.ts` call that module. Do not add a second lean formula in the view.

## Regression checklist

- Endgame buttons still come only from `endgameMenu`.
- Live possessions still go through `onePoss`. Quick-sim still goes through `simContest`.
- Career jobs stay at or under `CAREER_MAX_PRESTIGE`. Pick a school still lists every Division I program.
- A sign-chance percentage on the recruiting card matches the Lean math line.

## Career vs Pick a school

Career jobs stay at or under `CAREER_MAX_PRESTIGE`. Pick a school lists every Division I program, including commissioner schools. Do not open power-conference jobs on day one of Career.

## Selection Sunday show

`src/components/game/selection-show.tsx` walks the field one game at a time: First Four, then each region in bracket order (`PAIR_64`: 1/16, 8/9, 5/12, 4/13, 6/11, 3/14, 7/10, 2/15), then your envelope. Play the show auto-advances and stops on your game. Skip still opens the bracket. Do not dump a whole seed line on one card.

## Archives

`ensureSelectionArchive` in `src/game/archives.ts` writes the year when Selection Sunday posts the field: record, conference record, bid or NIT/CBI, standings, and your box scores. `stampSeasonArchive` runs again when the season closes and fills the champion, awards, and the final record. Empty copy only shows before that first write. Open Archives from the gym or More. The row lives on `history.log` and reloads with the save.

## Custom schools

`src/game/custom-schools.ts` mounts a school onto the Division I board (`TEAMS` / `TEAM_BY_ID`) and stores it on this device. `newDynasty` builds a roster and a conference schedule for it. A save also carries `customSchools`, so a reload puts the school back. Career prestige stays capped. Add one from Pick a school.

## Platform

The web app is an installable PWA. The platform manifest and icons stay on `/__grok/manifest.webmanifest`. In production a service worker at `/dribble-sw.js` caches the UI shell. The last save stays in IndexedDB / local storage, so the office still opens offline. Live coaching uses one vertical scroll, wrapping buttons (44px), a sticky scoreboard, and safe-area insets. There is no native iOS binary in this build.

## Export / import

Settings exports the full save as JSON and imports it back with the build stamp. A commissioner room code stores that file locally so another session on the device can join. The gym Season card copies or downloads a markdown report (record, SOS, top players, portal, awards). Bug reports include the build id and the last five errors.

