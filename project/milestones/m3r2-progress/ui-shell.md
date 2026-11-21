# m3r2 progress: ui-shell

Stream `ui-shell` (U1, U2, U3, U4, U10). Branch `m3r2-ui-shell`.

## Done

- **U1, the top bar** (`components/GameHeader.tsx`, `components/header/`):
  - Left to right: the kicker with the readiness chips, the title, then the timer, Funds and Manpower, then `TurnNav` (Last turn, Recruitment n, Building n), `EndTurnButton` and `GameMenu`.
  - End Turn is orange-red with an hourglass icon.
  - The menu holds Settings (navigates to the existing `SettingsScreen`; `/settings` is now allowed in every phase), Save (disabled, "Coming later") and Exit Game (the existing Leave/Stay confirm).
  - On a phone (sheet layout), the top bar hides its End Turn with CSS (`:has(... data-pane-layout="sheet")`). `MapPane` shows End Turn in the sheet bar, whether the bar is open or collapsed and under the Briefing too (`PaneContent.barAction`).
  - The root view is titled "This turn".
- **U2**: `armiesWithoutOrders` (`state/planning/endTurn.ts`) drives the confirm. It shows only when some ground armies have no move, withdrawal or Replenish and were not told to stay. It lists them, with End anyway and Back (Back has focus; Escape goes back).
- **U3, the pane stack**:
  - `state/paneSlice.ts`: the API is in the section below.
  - The `MapPane` header has a back link naming the view underneath.
  - Views (`screens/shell/views/`): This turn (by type or by region, with Cancel on each line), Territory Info (the former Orders body, tabs unchanged), Last turn, and one placeholder file per later view.
  - A map click outside a destination choice opens Territory Info (`screens/shell/mapHandlers.ts`).
  - The destination callout, the departing army and the odds list sit above whichever view is shown.
- **U4**: `SelectionBar` is the pane footer: "N units selected", the territory, Clear, then one button per order (from `state/planning/orderChoices.ts`, which absorbed the old contested-menu wording). Orders the selection can't take in contested ground are shown greyed out with the reason. The bar also carries the planning feedback.
  - Removed: `OrderCommand.tsx`, the `choose-order` stage, `toggleOrderMenu` and `OrderBuilder.tsx`.
  - Note 11: Move, Withdraw, Entrench, Rest, Attack, Hold and Replenish now leave nothing selected. The probe's cases are in `src/test/ui/selectionAfterOrder.test.ts`.
- **U10**: `screens/report/factions.ts` groups "What happened" by faction: the viewer's first, then the scenario's order, then "Other events". The faction is read structurally, so new outcome kinds place themselves. `LastTurnView` shows last turn's report (from `history`, seen by this player) while planning. `report/BattleAir.tsx` is an empty slot above each engagement, for air-rules.

## Pane-slice API (for other streams)

- `PaneView`: one of
  - `thisTurn`
  - `territory {id, tab?}`
  - `invade {target}`
  - `reinforce {target}`
  - `build {territory, subTerritory?}`
  - `recruit {territory}`
  - `recruitment`
  - `building`
  - `lastTurn`

  `TerritoryTab` is `"units" | "buildings" | "recruit" | "production"`. `tab` is not wired yet: ui-economy owns the tabs.
- Actions:
  - `pushView(view)`: removes any view of the same kind, then pushes.
  - `popView()`: never pops past the root.
  - `openView(view)`: gives `[thisTurn, view]`. The top bar uses it.
  - `resetPane()`.

  The slice resets itself on `startGame`, `exitGame`, `beginPlanning`, `endTurn`, `timeRanOut` and `startNextTurn`.
- Pure helpers: `pushed`, `popped`, `opened`, `topView`, `viewKey`, `viewForMapClick`.
- To swap in a view, replace the body of its file in `screens/shell/views/` (`InvadeView`, `ReinforceView`, `BuildView`, `RecruitView`, `RecruitmentView`, `BuildingView`). Each receives `{scenario, session, view}`, and the titles are in `screens/shell/paneTitles.ts`.

## Decisions

- **"No order" (U2)**: Entrench, Rest, Attack and Hold are implicit, so a new optional draft field `orderedToStay` (`state/session.ts`, one field) records armies told to stay from the selection bar. `withDraft` and `selectAircraft` keep it, and `removeOrder` drops it. Generals and aircraft are never listed.
- **Pane stack**: one view of each kind at a time, so map clicks never build a deep back trail. The top-bar buttons open on top of This turn, and pressing the active one goes back.
- **Pane titles**: the Territory Info pane is titled "Territory info". The territory's own heading sits right below it, which avoids two "Madrid" headings.
- **Fixed outside the stream's files** (small edits):
  - `state/planning/air.ts`: `selectAircraft` dropped the Recruit basket, builds and Replenish orders (a bug).
  - `state/planning/recruitment.ts`: one line for note 11.
  - `map/MapPane.tsx` and `usePaneView.ts`: the back link and the phone bar action.
  - `state/routing.ts`: Settings is allowed in every phase.
- `presentation/thisTurn.ts` stays free of `state/` imports. It takes `PlannedSoFar`, built from engine types.

## Review

`diff-reviewer` found no blocking bugs. These findings are fixed:
- This turn now lists stay orders, each with Cancel.
- Cancelling an order clears its stale feedback.
- A Move drops an earlier stay order.
- The End Turn Escape listener is stable.

These are left as they are:
- On a phone, the collapsed bar shows End Turn rather than the selection bar. A new selection opens the sheet.
- A recon flight that was intercepted is filed under the interceptor's faction.

## Checks

- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npm run test:unit`: 98 files and 1,281 tests pass. Global coverage is 98.26% statements, 93.55% branches, 98.59% functions and 99.31% lines.
- Per-file coverage: every touched file meets 93/92/92, except `report/BattleCard.tsx` (90% branches) and `report/BattleReport.tsx` (91.7%). Both gaps were already there (`placesOf` and the toggle-close path), and these edits added no branches.

## Left

- `TerritoryTabs` keeps its tab in local state. The `territory.tab` field is for ui-economy.
- Not seen in a browser: no Playwright or screenshots were run in this stream. The e2e specs and visual baselines still expect the old pane, and the owner updates those.
