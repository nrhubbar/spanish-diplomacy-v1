# m3r2 progress: ui-economy

Stream `ui-economy` (U9, U11, U12). Branch `m3r2-ui-economy`, cut from `milestone-3-rev-2` with `ui-shell` merged.

## Done

- **U9, the shared queue** (`screens/queues/QueueList.tsx`):
  - Active items come first, each with a progress bar and its turns left. Waiting items are numbered behind them.
  - Items ordered this turn have Cancel. A planned build calls `cancelBuildOrder`; a Recruit order lowers that type's quantity by one.
  - A contested queue draws its bar paused, and its card carries "Paused · contested".
  - The rows come from pure functions in `presentation/queues.ts`: `buildEntries`, `trainingEntries`, `buildingGroups`, `recruitmentGroups` and their summaries.
- **Global Recruitment** (`screens/queues/GlobalRecruitment.tsx`):
  - Grouped by territory. Each territory's name opens its Recruit tab.
  - A summary line above: in training, ready next turn, ordered this turn, and what the orders commit.
- **Global Building** (`screens/queues/GlobalBuilding.tsx`):
  - Grouped by territory, then sub-territory. Each sub-territory's name opens its card.
  - The summary gives under way, queued, paused, and which territories finish at the end of this turn.
  - Contested territories are marked paused, with "progress is kept".
- **Territory Info** has four tabs: Units, Buildings, Recruit and Production.
  - `territory.tab` is wired.
  - `build{territory, subTerritory}` opens Buildings with that card open. `recruit{territory}` opens the Recruit tab.
  - Buildings shows one opening card per sub-territory (`pane/build/SiteCard.tsx`):
    - Closed, the card shows the queue's head and how many items wait.
    - Open, it shows terrain, port and rail chips, cities, levels, buildings, the queue, and "Add to the queue" (`BuildOptions`).
    - Opening a card focuses its sub-territory, so the map follows. A sub-territory focused on the map opens Buildings with its card open, which replaces the old focus view.
  - Recruit leads with the territory's training queue, which shows other factions' units only by recon.
  - Production (`pane/ProductionTab.tsx`, `presentation/ledger.ts` `productionOf`):
    - Each sub-territory's levels and its yield, one column per resource.
    - The total is "Held whole: pays", or struck through as "Contested: pays nothing".
    - Raided sub-territories are marked.
    - Where each resource comes from is read from the scenario's development tracks.
- **U11, the balance view** (`components/header/Ledger.tsx`, `presentation/ledger.ts` `ledgersFor`):
  - One flat list of territory rows. A contested row shows "−N contested" inline and pays 0.
  - Then a Raids row (only when a raid landed), and the expense rows: Builds under way, Replenish and Upkeep.
  - The total is the chip's next-turn figure.
- **U12, Replenish for the selection** (`state/planning/recruitment.ts`):
  - `replenishPlan` splits the selection into units to refill and units skipped, each with a short reason: at full strength, `<type> units cannot replenish`, in contested ground, outside your territory, or not enough Funds.
  - It prices the units in turn against the carry, after the draft's other Replenish orders.
  - Replenish is offered when at least one selected unit can take it.
  - The selection bar's line reads "Refills 2 of the 3 selected units: … Skips X (at full strength)." The feedback after the order names the skipped units too.

## Decisions

- **Ledger accounting** (as the approved `r2-b-ledger` mock shows):
  - The chip reads `Funds <now> <next turn>`.
  - **now** is the balance less this turn's Build and Recruit orders.
  - **next turn** is the ledger's total: yields, less raid cuts, less this turn's Replenish, less upkeep.
  - Before this change, Replenish came off the "now" figure. It now comes off "next turn", so it is never counted twice. `now + next turn` is still the balance after the turn.
  - The Recruit tab's "Left" line still subtracts Replenish, as before.
  - "Builds under way" is always 0, noted "paid when queued".
  - Upkeep is 0, noted "none in this scenario".
- **Training is parallel, not a queue.** `advanceTraining` takes a turn off every item each turn. So every unit in training is an active row with its own bar, and only this turn's Recruit orders wait behind them. The mock's "1 at a time" text is not how the engine behaves.
- **Paused:**
  - Build queues are paused when the territory is contested now (`advanceQueues` skips those).
  - Training uses each item's own `paused` flag, because militia train on in contested ground.
- **Counts** match the top bar's `queueCounts`. Global Building lists only the viewer's queue items, and its planned builds come from `previewState`.
- **Removed:** `SubTerritoryFocus`, `BuildList` and `TrainingList`, and the Units tab's "In training" list. Their content now lives in the opening card and in the Recruit tab.
- **Outside the stream's files, small wiring:**
  - `PaneViewBody.tsx` passes `view.tab` and the narrowed view to the Build and Recruit views.
  - `orderChoices.ts` reads Replenish's line from `replenishSelectionDetail`.
  - `glyphs.ts` gains two carets.
- **Link projects:** queue rows follow whatever `BuildProject` kinds the state holds. A new link kind needs a name in `presentation/economy.ts` `projectBaseName`, and an icon. Typecheck flags both on merge.

## Review

`diff-reviewer` findings:
- **Fixed:** `replenishPlan` matched prices to units by position. A kept order with no price shifted the list, and a selected unit was then wrongly reported as unaffordable. Prices are now matched by unit, with a regression test.
- **Fixed:** the short resource is now named against what the units paid first leave.
- **Fixed:** a card the player closed reopened after they left Buildings and came back. The open card now lives in `TerritoryTabs`.
- **Fixed:** the Buildings tab count now counts only the viewer's queue items, as the top bar does.
- **Not a bug:** a raid counted twice. `subTerritoryYield` is the raw yield; the cut comes only through `incomeFor`'s hook, and a test checks that the rows sum to the chip with a raid.
- **Kept:** "(recon)" on another faction's training. Recon is a player order, and the pane already says "Queue empty (recon)".

## Checks

- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm run test:unit`: 99 files and 1,306 tests pass. Global coverage is 98.27% statements, 93.74% branches, 98.63% functions and 99.32% lines.
- Per-file coverage: every file added or changed meets 93/92/92. The lowest are `ResourceChips` at 95.7% branches, `orderChoices` at 95.5% (the one gap was already there) and `state/planning/recruitment.ts` at 98% functions.

## Left

- Not seen in a browser: no Playwright or screenshots were run. The e2e specs and visual baselines still expect the old pane, the old chip detail and the Build tab.
- Phone layout of the ledger popover and the Production table has not been checked at Pixel width.
