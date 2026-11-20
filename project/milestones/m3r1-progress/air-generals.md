# `m3r1-air-generals` progress

Mode: make it work (declog D13). Branch `m3r1-air-generals`, merged with `milestone-3-rev-1` at `eb9515f` (contract CP4).

## What works

- **Engine (`air: missions`).**
  - Step 1: sackings; aircraft and generals set aside from the ground steps.
  - Step 2: grounding through the `grounded` hook, recon reveals, interception, raids rolled on the `raid` stream (anti-air, fighters, the four outcomes), and support recorded in the scratch.
  - Step 5: bomber support and generals reach every battle through `combatModifiers`.
  - Step 9: aircraft back at base, or rebased or lost; generals arrive with their army; death rolls on the `general-death` stream; rallies; replacements in the seat.
  - Step 11: raid cuts through `incomeDelta`; spent cuts and reveals expire.
  - Validation of AirMission and Sack orders; a unit takes only the order kinds its type lists.
- **Data (Spain).**
  - Five starting aircraft, each with a source: Republic fighters and bombers at Madrid and recon at Barcelona, North recon at León, South Ju 52 bombers at Seville.
  - Three starting generals, each faction's first on the roster: Miaja at Madrid, Mola at Navarra, Yagüe at Ceuta.
  - `air.generalDeathRoll` 4, with a design note.
  - Tiny-front is untouched: the `m2-strength` preset has no generals and no air.
- **UI.**
  - Aircraft counters at their airfield's city, with the NATO fixed-wing symbol from the map package and a tag (FTR, BMB, RCN). They are selected like units.
  - The selected aircraft shows a range ring, and planned missions show as dashed lines.
  - Aircraft pane: base, type and range; Raid, Intercept, Support and Recon buttons, greyed where the type cannot fly them; Stand down; a target list; a target card with range, anti-air, enemy fighters in reach and the raid chances; the other aircraft at the base.
  - The territory pane lists "Aircraft here" apart from the armies.
  - A general's card shows a pill (star, name, trait) and a Sack or Keep him button.
  - The turn report has "Air missions" and "Generals" groups, with full sentences.
  - Capture `@capture air missions and generals` (`20a` to `20d`).
- **Computer player.**
  - `ai/orders/air-mission.ts`: bombers support the biggest planned attack in range, else raid the richest enemy sub-territory, avoiding anti-air; fighters intercept over the richest own territory an enemy bomber can reach; recon looks at the enemy territory with the most units that is not revealed yet.
  - `ai/orders/sack.ts`: sacks a general with a harmful trait when the next man on the roster is better.
  - `ai/orders/general.ts` (new): a general goes with the biggest attack leaving his territory; a lone general walks toward his own armies.
  - The move planner plans on a ground-only view of the board.

## Decisions

- **AG-1. Generals ride on the air module.** Generals have no area (CT-4), so the general rules live in `air: missions` (`engine/generals/`), with their numbers in the `air` block (`generalDeathRoll`). A scenario with generals but `air: none` gets no generals' rules.
- **AG-2. CT-21: generals stay out of the d6 army counts.** Generals and aircraft never enter a ground battle (AG-3), so they add no point to any side, under d6 and d20 alike. The `m2-strength` preset (tiny-front) has neither, so it is unchanged. Spain places its starting generals whatever the dice module.
- **AG-3. Aircraft and generals are set aside during the ground steps.**
  - The air module's step-1 part takes every non-ground unit out of `draft.armies`, along with its move orders, into `scratch.air.aside`. Its step-9 part puts them back.
  - So no ground rule (battles, retreats, control, works, sweeps) ever counts them, and no shared ground file needed a kind check.
  - Planning estimates (`estimateAttack`) and the move planner see only ground units, which makes them consistent with resolution.
- **AG-4. A general's move follows his army.** He arrives where his faction has ground units at his destination after the battles; otherwise he stays where he was. A `general-moved` outcome reports which.
  - His army is the ground units of his faction with the same origin and destination, or holding with him when he does not move.
  - The +1 applies to the side whose faction he belongs to, in the territory he is going to or holding.
- **AG-5. The raid cut names the turn whose income it removes, the turn after the raid.** The hook reads `state.raidCuts` where `cut.turnNumber === state.turnNumber`, so it works whether economy passes the start or the current state. It removes the sub-territory's development yield (level × `yieldPerLevel`), only when the holder holds the whole territory ($2).
- **AG-6. Support counts the best bomber once per side.** Several bombers over one battle do not stack (as with D5 for generals). Support from a defender faction is signed against the attacker.
- **AG-7. Roster index and replacement ids.**
  - "Next" means the first roster entry at or after `nextIndex` who is not in play, not on his way, and not the man leaving; `nextIndex` then moves past him.
  - A replacement's unit id is `general-<generalId>`, and `generalUnitDefinition` derives his definition from the id. `requireUnitDefinition` falls back to it, the same pattern `m3r1-recruit-replenish` uses for recruits. `GameState.raised` records him as well.
  - He appears at the end of the turn after the call, in the seat, or in the first territory his faction controls when the seat is lost.
- **AG-8. Death means the army was destroyed or routed.** The trigger: every unit of his army was destroyed, retreated or surrendered this turn, or he stood alone in ground another faction took or stands in. The d6 rules have no rout, so a forced retreat counts as routed.
  - He dies on a d20 at or under `generalDeathRoll`.
  - A survivor follows the first retreat of his army, else goes to the seat, else to the first territory his faction controls. With nowhere to go, he is lost as if dead.
- **AG-9. Aircraft whose base is lost** rebase to the nearest airbase of their faction within range (ties by scenario order), or are lost on the ground. Outcomes: `aircraft-rebased` and `aircraft-lost`.
- **AG-10. Rally per army.** At the end of step 9, the best general (D5) with each group of his faction in one territory rallies its demoralized units, unless his trait has `no-rally`. This includes units demoralized this turn (C5, D7: "at the end of the turn"). It runs after the dice module's morale part.
- **AG-11. Building hit.**
  - A building chosen by the raid stream's next draw is destroyed. A building with `upgradeOf` (the paved airfield) falls back to that building instead.
  - With no buildings, the highest development level drops by one, and the outcome names it (`developmentId`, added to `RaidFlownOutcome`).
- **AG-12. Anti-air.** The best single `raid-defence` among other factions' units in the target territory applies; they do not stack.
- **AG-13. Interception does not stop support missions.** Fighters only worsen raids over their territory and shoot raiders down on an air-eliminated roll. No separate shoot-down roll; no data field was added.
- **AG-14. Draft and selection.**
  - Air missions and Sack orders live in `Draft.airOrders`, carried through selection changes by `withDraft`, the pattern recruit-replenish uses for its basket.
  - `Draft.selectedAircraftId` opens the aircraft pane. Territory selection never picks aircraft.
  - At End Turn, a unit with a move keeps the move; Sack replaces a planned move.
- **AG-15. Computer planners never draw from `random`** (CT-36). Ties break by id or name.
- **AG-16. Starting aircraft and generals in Spain**, each with a source:
  - the new `enwiki-republican-air-force`: the July 1936 inventory of Breguet XIX, Vildebeest and Ni-52, and planes lost at rebel aerodromes;
  - `enwiki-airlift-1936` for the Ju 52s;
  - the roster sources for the generals.
  - The 100 men of each air and HQ counter is a design note.

## Stubbed

- **Weather.** `grounded` returns false until `m3r1-weather-timer` fills it. Both the engine and the planner call `hookedGrounded` before flying.
- **Income.** The raid cut works only once `m3r1-economy-builds` calls `hookedIncome` at step 11.
- **Building.** Airfields and the paved upgrade come from `m3r1-economy-builds`. The air code reads only their effect kinds.
- **Recon.** Reveals go through the contract's `viewFor`. The hidden-balance UI that shows them is economy's.
- **Training.** Aircraft and anti-air are trained by `m3r1-recruit-replenish`. Raised aircraft resolve through `GameState.raised`.
- **Counters.** A general's counter on the map still prints "1-1": `armyFigures` floors at 1. A star or "0-0" is left for make-it-right.

## Needs from

- **`m3r1-d20-combat`:**
  - The d20 battle parts pass `scratch: draft.scratch` into the `combatModifiers` context, as the d6 `site.ts` and `standing.ts` now do. Without it, support and moving generals do not count.
  - Keep `draft.settled` (retreated, surrendered) or an equivalent, so AG-8 can tell a rout.
  - The morale seam: my rally runs after your morale part and clears demoralization; generals and aircraft are set aside during it, so they gain no fatigue.
- **`m3r1-economy-builds`:** call `hookedIncome` at step 11 with a state whose `turnNumber` is the current turn and whose `raidCuts` are present; the start or the draft state both work.
- **`m3r1-weather-timer`:** fill `grounded` (Mud and Snow, unless `isAllWeatherAirbaseFor`; the helper is in `engine/air/pieces.ts`).
- **`m3r1-recruit-replenish`:** at merge, chain `raisedDefinition` and `generalUnitDefinition` in `requireUnitDefinition`. Both of us changed its return type to the same `UnitIdentity`.
- **`m3r1-sub-territories`:** set aside generals' Withdraw orders as AG-3 does their moves. Sub-territory flips make airfields change hands, and AG-9 follows them.
- **`m3r1-movement-rail-ports`:** your reveal part runs before mine. Do not keep scratch for units of a non-ground kind, because mine removes their moves.

## Files outside my ownership

Each is a small wiring edit.
- **Engine:**
  - `validation.ts`: air and sack dispatch; type order kinds on moves;
  - `hooks.ts`: `CombatHookContext.scratch`;
  - `combat/odds.ts`: `BattleContext.scratch` and `attackerUnitIds`;
  - `combat/estimate.ts`: ground units only, and passes `attackerUnitIds`;
  - `site.ts`, `standing.ts`, `phases/05-battles.ts` and `phases/07-standing.ts`: they pass the scratch;
  - `lookup.ts`: the replacement general fallback;
  - `types/systems.ts`: `generalDeathRoll`;
  - `types/outcomes/air.ts` and `generals.ts` (mine by CT-19).
- **Schema:** `scenarios/schema/systemsSchema.ts`, with `scenario.schema.json` regenerated.
- **Spain:** `scenario.json` (units, a source, the air block).
- **AI:** `ai/computerPlayer.ts`: the ground view for moves; the general planner.
- **State:**
  - `state/session.ts`: `airOrders` and `selectedAircraftId`;
  - `state/planning/selection.ts`: keeps air orders, skips aircraft, opens the aircraft pane, and takes an optional `scenario`;
  - `state/planning/orders.ts`: passes `scenario`;
  - `state/planning.ts`: re-exports;
  - `state/gameSlice.ts`: three actions; End Turn submits air orders.
- **Map:**
  - `map/MapLayers.tsx`: counters without aircraft, symbols for the layers;
  - `map/layers/slots.ts`: `unitSymbols`;
  - `map/view.ts`: `plannedAirMissions` and `selectedAircraftId`.
- **Screens:**
  - `screens/OrderBuilder.tsx`: the aircraft pane and "Aircraft here";
  - `screens/ArmyPicker.tsx`: the general controls;
  - `screens/OrdersScreen.tsx`: the view fields;
  - `screens/ResultPanels.tsx`: two report groups.
- **Presentation:**
  - `presentation/systemText.ts`: the scenario-aware sentences, the same signature as recruit-replenish;
  - `presentation/text.ts`: passes the scenario;
  - `presentation/odds.ts`: names for general, trait and air support;
  - `presentation/glyphs.ts`: star.
- **Styles:** `style.scss`, one `@use`.
- **Tests:** `hooks.test.ts`, `pipeline.test.ts` (air is no longer a skeleton), `combat.test.ts` and `orders.test.ts`, `engineTurn.test.ts` (the invariants count air and general losses and arrivals), and `consolidation.test.tsx` (an exhaustive switch).
- **Specs:** `project/specs/scenario-package.md`, the "Air and generals" section.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `src/test/air/*`: 34 tests passed.
- Full `vitest` run: known red. Some tests count Spain's units, and now meet the new starting aircraft and generals: `app.test` (2), `compactCounters` (4), `consolidation` (2, the AI's planned moves now include generals) and `resolutionFocus` (1). The 6 sim-harness tests were already known red (D14). These are for make-it-right.
- `@capture air missions and generals` on chromium: passed. Screenshots in `build/e2e/screenshots/chromium-20{a,b,c,d}-*.png`.
- `npm run sim -- --games 50`: 100 games (50 seeds, with and without blunders), turn limit 66, no crash.
  - With blunders: decided 58% [44, 71], freezes 42%, stalled 50%, median length 12. Wins of decided games: Republic 55%, North 31%, South 14%.
  - Without blunders: decided 50%, freezes 50%, median length 10. Wins: Republic 52%, North 40%, South 8%.
- An exploratory 10-game, 40-turn count before the last planner change showed every new outcome kind occurring: recon, support (with air-support modifiers in battles), raids of all four results, rebases, aircraft lost, rallies, general deaths, sackings and replacements.
