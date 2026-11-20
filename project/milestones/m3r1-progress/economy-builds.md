# `m3r1-economy-builds` progress

Mode: make it work (declog D13). Base: `milestone-3-rev-1` at `eb9515f` (contract fully merged).

## What works

- **Engine** (`src/main/engine/economy/`), wired as the `development` economy module (`engine/modules/economy.ts`):
  - `resources.ts`: resource arithmetic shared by every step-1 purchase (`canAfford`, `pay`, `credit`, `shortfall`, `addResources`, `subtractResources`, `treasuryOf`).
  - `holdings.ts`: held whole and contested, from sub-territory holders (W6).
  - `catalogue.ts`: project costs and levels, one Build-order validator (`buildRefusal`, `validateBuildOrder`), `applyBuildOrder` (the running ledger and the planning preview), `plannedSpend` (builds and recruits).
  - `income.ts`: `incomeFor`, through the contract's `hookedIncome` (the `incomeDelta` hook).
  - `queues.ts`: step 1 `payForBuilds`, step 10 `advanceBuildQueues` (hand-over, rail damage, progress), step 11 `collectIncome`.
  - `effects.ts`: Fortifications through `combatModifiers`; Hospital and Depot through `replenishBonus`.
  - `engine/validation.ts` sends Build orders to `validateBuildOrder`.
- **Computer player**: `ai/orders/build.ts`. It repairs rail, unlocks recruit types at capitals, fortifies the front, and develops the scarcer resource. It is deterministic.
- **UI**:
  - Header chips (X1): `components/header/ResourceChips.tsx`, with a detail that opens on tap.
  - Build tab: `screens/pane/BuildTab.tsx` and `build/SiteCard.tsx`.
  - Focused build list: `build/BuildList.tsx`, mounted in `SubTerritoryFocus`.
  - Icons (X8): `components/economy/EconomyIcon.tsx`.
  - Styles: `styles/_economy.scss`.
  - Planned builds: `state/planning/builds.ts`, with the actions `queueBuildOrder` and `cancelBuildOrder`.
- **Report lines**: `presentation/systemText/economy.ts`.
- **Spec**: rules EC-1 to EC-10 in `project/specs/scenario-package.md`.
- **Captures**: `e2e/capture.spec.ts`, "@capture economy", writes `20a-build-tab`, `20b-build-focus`, `20c-build-queued` and `20d-resource-detail`.

## Decisions

1. **EB-1. Held whole and contested come from sub-territory holders (W6),** not from the Milestone 2 `control`.
   - Under Spain's start table, six territories are mixed at the sub-territory level from turn 1 and pay nobody: Asturias, País Vasco, Aragón, Extremadura, Baleares and Andalucía.
   - Turn-1 income:
     - Republic: 14 Funds and 27 Manpower.
     - North: 5 Funds and 27 Manpower.
     - South: 1 Fund.
2. **EB-2. Orders are paid at reveal in submission order, against a running ledger.**
   - An order the balance no longer covers is a `rejected-order`, and nothing is paid. So is a duplicate.
   - Builds pay before Recruit orders (area order).
   - Each order must also be valid on its own, because `lockSubmission` checks every order against the start state.
3. **EB-3. No new queue items in a contested territory,** besides the pause in $5.
4. **EB-4. "In progress" means the head item with at least one turn of progress.**
   - Such an item is forfeited to the new holder, and its `paid` becomes `{}`.
   - An unstarted head is refunded, like the rest.
5. **EB-5. Hand-over and rail damage run at the start of step 10,** by diffing the start-of-turn holders against the current ones.
   - Economy runs before partition within step 8, so a step-8 part would miss that turn's flips.
   - Rail is next read at step 3, so the effect is the same.
6. **EB-6. Rail damage ($8)**: a territory held whole at the start and contested at the end loses `railDamageOnContest` levels in every sub-territory its former whole holder no longer holds. A territory that was already contested takes no further damage.
7. **EB-7. An item progresses in the turn it is queued.** A 2-turn building ordered on turn t stands at the end of turn t + 1.
8. **EB-8. Fortifications (`defence-roll`) count once per battle,** the strongest one. They need a defender to hold a sub-territory in the battle territory. They apply in every battle kind the d6 rules pass to the hook. The roll is negative, as with `dug-in`.
9. **EB-9. The economy module answers `replenishBonus`** from Hospital and Depot effects. The recruit stream should read the hook, not the buildings (see "Needs from").
10. **EB-10. Planned Build orders live on the planning session (`builds`),** not in `Draft`, because selection rebuilds the draft.
11. **EB-11. The resource chips show the balance after this turn's planned orders,** with next turn's income. The detail shows the full balance, what the planned orders spend, how many territories are held whole, contested territories, raid cuts, and other factions as "hidden", or with a value marked "(recon)".
12. **EB-12. Resources show as raw numbers with their scenario names** ("Manpower 10 +27"), not "18k". Code knows no resource ids.
13. **EB-13. Icons come from data shapes, not ids (X8):**
    - a building's icon from its first effect, with a flag when it has none (Barracks);
    - a development track's icon from `cityOnly` (industry), else from its resource;
    - the first resource is money (coin, pick); any other is people (people, wheat).
14. **EB-14. The build list leaves out projects the site can never take** (capital-only elsewhere, city-only without a city). Queueable projects come first; locked ones follow and say why.
15. **EB-15. Computer player.**
    - Builds spend at most 60 percent of what Recruit orders leave (`buildSpendShare`), at most 3 orders a turn, and one new item per sub-territory with an empty queue.
    - Both constants are code with a design note, waiting for an AI profile field.
    - It builds only in territories held whole.
16. **EB-16. Desktop header order**, when resource chips are present: title, readiness, then the resources beside Exit, by CSS `order` from `_economy.scss`. On a phone: title and Exit, then the resources row, then readiness.
18. **EB-18. The territory income chip** (`build/TerritoryIncomeChip.tsx`) shows one of three things:
    - "Pays +N ... a turn", when the viewer holds the territory whole;
    - "... to <holder>", when another faction holds it whole;
    - "Contested: pays nobody".
    Development is public, so the chip is too. Its interim home is the top of the Build tab, until `m3r1-weather-timer`'s meta-row slot lands.
19. **EB-19. Each resource chip's root has the `header-meter` class,** for the weather-timer's header row.
20. **EB-20. Render cost.**
    - The Build panel renders only while open: one condition in `TerritoryTabs`.
    - The chips read the game record's state and planned builds through narrow store selections, behind a `memo`, so selecting territories does not re-render them.
    - Desktop P2 selection was 50.5 ms, against a 50 ms budget, before this work. Run alone it is now 33 to 43 ms.
17. **EB-17. Parts return the draft unchanged when they have nothing to do** (no Build orders, no queue changes, no treasuries). `tiny-front` and the pipeline's pass-through pin still hold.

## Stubbed or interim

- Sub-territory holders never change until `m3r1-sub-territories` lands, so hand-over and rail damage do not yet happen in play. Both are unit-tested.
- No Recruit orders exist yet. The AI budget and `plannedSpend` already subtract their cost.
- Report lines are one sentence per kind. `describeSystemOutcome` passes only the kind, so lines cannot name places or amounts.
- The `building` modifier's name in `presentation/odds.ts` stays "Fortifications". `modifierName` gets no scenario, so it cannot read the building's name.

## Needs from

- **`m3r1-recruit-replenish`**:
  - Pay through `engine/economy/resources.ts` (`pay`, `canAfford`, `shortfallReason` in `catalogue.ts`).
  - Your reveal part runs after mine and reads `draft.systems.treasuries` with builds already paid.
  - Read the Hospital and Depot bonus from `hookedReplenishBonus`, not from building ids, or it counts twice.
  - Add a Recruit case next to the Build case in `validateOrder`.
  - `plannedSpend` already counts Recruit costs. Add Replenish when its price function exists.
- **`m3r1-sub-territories`**:
  - Flip `systems.subTerritories[*].holder` as your phases decide. My step-10 part does hand-over and rail damage from the diff.
  - Don't also apply rail damage at step 8 (your partition TODO lists it). If you'd rather own it, call `damageRail` from `engine/economy/queues.ts` and tell me to drop mine.
  - Have the map layer's click dispatch `focusSubTerritory`. The Build tab's "Build in X" buttons already do.
- **`m3r1-air-generals`**:
  - Apply raid cuts only through the `incomeDelta` hook (`hookedIncome` is called by my income part and by the header preview), and leave the air module's `cutIncome` step part empty. Otherwise cuts apply twice.
  - Record `raidCuts` with the turn number. `IncomeOutcome.cutSubTerritoryIds` reads them.
  - A "building downgraded or destroyed" raid result edits `subTerritories[*].buildings` directly.
- **`m3r1-weather-timer`**:
  - The header's phone row is CSS order only. Give `TimerChip` an order between 1 and 3 (I use 3 for resources), or wrap Timer and Resources together in `GameHeader`.
  - Readiness chips with abbreviations would stop the desktop header wrapping.
- **`m3r1-movement-rail-ports`**: rail and port levels are `systems.subTerritories[*].rail` and `.port`; Rail yard is the `rail-departures` effect.
- **`m3r1-contract` (integrator)**:
  - An order-validation hook per module, so slices stop editing `validateOrder`.
  - A planning-session slot for non-move orders (I added `builds`).
  - A per-outcome report line API.
  - An AI profile field for the build budget.

## Files touched outside my ownership

- `src/main/engine/validation.ts`: the Build case, 2 lines.
- `src/main/state/session.ts`: the `builds` field on the planning session.
- `src/main/state/gameSlice.ts`: two actions, and the builds added to the End Turn submission.
- `src/main/state/planning.ts`: one re-export line.
- `src/main/screens/pane/SubTerritoryFocus.tsx`: mounts `BuildList` (2 lines).
- `src/main/style.scss`: one `@use` line.
- `src/main/styles/_economy.scss`: reorders `.game-header` children by CSS, within my own partial.
- Tests:
  - `src/test/visibility.test.ts`: `planBuilds` dropped from the stub list;
  - `src/test/consolidation.test.tsx`: three income outcomes in Spain's report;
  - `src/test/slots.test.tsx`: the Build panel now has content.
- `e2e/capture.spec.ts`: one new `@capture` test.
- `project/specs/scenario-package.md`: rules EC-1 to EC-10.

## Checks (at `7a7aeea`)

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npx vitest run`: 690 passed. The only 6 failures are the known-red sim-harness tests (D14).
- `npm run build`: passed. `npm run budgets:check`: initial chunk 106.89 kB gzip against 155 kB, met.
- `npm run test:e2e` on chromium and mobile-chromium (`E2E_PORT=5313`): 45 passed, 5 skipped, 6 failed.
  - 5 of the failures are visual baseline diffs, as expected: the header chips (chromium `planning-overview` and `fallback`; mobile `planning-overview`, `resolution` and `fallback`).
  - The sixth is the desktop P2 selection budget under the parallel run. It passes run alone (33 to 43 ms). Mobile at 4x throttle is noisy around its 120 ms budget, with or without the chips.
  - Axe is clean (the acceptance specs pass).
- `npm run sim -- --games 50`, without blunders: decided 50.0%, freezes 50.0%, stalled 60.0%. Wins of decided games: Republic 36%, North 40%, South 24%.
- `npm run sim -- --games 50`, with blunders: decided 30.0%, freezes 70.0%. Wins: Republic 40%, North 40%, South 20%.
- A 50-game probe (66 turns, with blunders) counted builds per game: Republic 104 queued, North 65, South 11.5. No build orders were rejected, and no rail was damaged, because holders do not change yet.
  - The Republic banks unspent Funds, about 2,400 a game by the end, since Recruit is not live yet.
  - The South earns about 1 Fund a turn (Andalucía is contested at the start; $7 says to raise Ceuta's and Melilla's yields if the harness asks).
