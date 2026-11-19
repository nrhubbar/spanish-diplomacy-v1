# Milestone 2 Revision 7: Tasks

> Internal product and implementation plan. Nothing in this document may be imported into or rendered by the player-facing application.

**Baseline:** `main` at `c9465a0` (Milestone 2 Revision 6, one squashed commit).

**Inputs:** the product owner's Revision 7 brief (five items, 18 November 2026), the four answers given on the same day (section 1), `milestone-2-rev-6-tasks.md`, `milestone-2-rev-6-declog.md`, and `coding-principles.md`.

**Process:** the owner judged this revision light enough to skip the interactive research report. Four open questions were answered directly (section 1).

## 1. Decisions

| ID | Decision | Source |
|---|---|---|
| F1 | On the resolution and game-over screens, clicking or pressing Enter or Space on a territory or army counter focuses that place. The pane scrolls to its battle card, opens it if collapsed, and highlights it, and the territory is highlighted on the map. A place with no battle shows a short note at the top of the pane with what happened there, or "Nothing happened in {territory} this turn." Clicking empty map, or the same place again, clears the focus. | Brief 1, owner chose the recommendation |
| O1 | Every army has exactly one order each turn: **Move**, **Entrench**, or **Rest**. | Brief 2 |
| O2 | Healthy armies may Move or Entrench; Entrench is their default. Demoralized armies may Move (to empty or friendly territory, as today) or Rest; Rest is their default. A demoralized army can never entrench, and a healthy army is never offered Rest. | Brief 2, owner chose "demoralized must rest" |
| O3 | Works stay per territory. A territory gains `diggingIn.perTurn` levels, up to `max`, when its holder holds it at the start and end of the turn, no battle was fought there, **and at least one of the holder's armies there was healthy at the start of the turn and had no move order**. With no entrencher, works keep their level. | Brief 2, owner chose the recommendation |
| O4 | Morale recovery (M23) is unchanged in effect: a demoralized army recovers after a turn with no move order, no retreat, and no new demoralization. The rule is now described as resting. | Brief 2 |
| O5 | Entrench and Rest are **derived, not submitted**. The engine's orders stay `MoveOrder[]`. An army without a move order entrenches when healthy and rests when demoralized. The engine exports one helper, `standingOrder(unit): "entrench" \| "rest"`, and the UI presents the result as the army's order. This keeps the computer player, routes, and the coordinator unchanged. | Integrator design, after advisor review |
| A1 | The odds shown for a destination count every attacker this faction would send there: the selected armies plus the faction's planned move orders to the same destination, with no army counted twice. The estimate still assumes the defenders stay and nobody else joins. | Brief 3 |
| A2 | Odds read as approximate everywhere they appear: map chips ("≈ 2:1 · 50%"), the Orders pane, and accessible names ("Approximately 2:1, 50 percent to take it"). Next to the odds in the Orders pane sits a small circled "i" button (`aria-expanded`, keyboard and touch friendly). It opens one sentence: the defender may reinforce or another faction may attack too, so the real odds may differ. If a map chip can carry the same button without failing the mobile target-size check, add it there too; otherwise the pane copy is enough and the hand-off says so. | Brief 3 |
| Z1 | Below 125% zoom (`camera.zoom < 1.25`, the number the zoom readout shows), the map always shows one summed counter per faction per territory. At 125% and above, today's rules apply unchanged: individual counters, falling back to summed ones when a stack is crowded, and phones keep summed counters until the operational level. | Brief 4 |
| Z2 | Below 125%, the selected territory in planning, and the focused territory on the resolution screen (F1), still split into individual counters. | Owner chose the recommendation |
| K1 | WASD and the arrow keys pan smoothly. Holding a key pans continuously at constant screen speed, after a short ease-in of about 120 ms. Two keys move diagonally at the same speed. A quick tap still moves about the old 60 px step, as a short glide. Movement stops on keyup, window blur, and when the page is hidden. Key auto-repeat is ignored. | Brief 5 |

**Still open from Revision 6** (not part of this revision; carried for the owner): the balance lever for S2 freezes and the Republic's win rate, rules D29, D31 and D32, the initial-chunk budget (D62), historical sign-off (OD-3), and the manual accessibility checks.

## 2. Workstreams

Each workstream is one agent on one branch (`m2r7-<letter>-<slug>`), cut from `milestone-2-rev-7`, in its own worktree under `~/workplace/spanish-diplomacy-project/`, with its own `E2E_PORT`. Each owns a set of files; if you edit a file another stream owns, say so in the hand-off.

All four streams start at once. The integrator (I) merges them in the order A, B, C, D.

Before hand-off, every stream must pass lint, typecheck, unit tests, build, and `npm run test:e2e` on its branch. Visual baseline diffs are the only allowed failures, and only I regenerates baselines.

### A. Standing orders: Entrench and Rest (O1 to O5)

Port 5181. Worktree `spanish-diplomacy-v1-m2r7-a`, branch `m2r7-a-orders`.

**Owns:**
- `src/main/engine/{works,morale}.ts`, plus a new `standingOrder` export; put it in `engine/orders.ts` or a new `engine/standing-order` module, avoiding a clash with `standing.ts` (standing battles)
- the M22 and M23 rule text in `project/specs/scenario-package.md`
- `src/main/state/{planning,session}.ts`
- `src/main/screens/{OrderCommand,OrderBuilder,ArmyLine,ArmyPicker}.tsx`
- `src/main/presentation/{battleBasics,battleRules}.ts` and `screens/BattleBasics.tsx`, for the Briefing's digging-in line
- engine and planning tests

**Tasks:**
1. Engine (O3, O5):
   - `digIn` grows works only when an entrencher was there, as O3 defines. It needs the turn's valid move orders, or the set of armies that moved.
   - Export `standingOrder(unit)`.
   - Update the M22 and M23 spec text with the derived orders.
2. Planning:
   - Every army without a move order shows its standing order: Entrenching or Resting.
   - The order menu (`orderKinds`) offers Move, plus Entrench for healthy armies or Rest for demoralized ones. Choosing Entrench or Rest for armies with a move order cancels that move.
   - Clearing a move order returns the army to its standing order.
   - The selection rule and `availableUnitIds` mean "no **move** order". Otherwise armies that entrench by default could never be selected.
3. The Orders pane summary counts Moving, Entrenching, and Resting armies.
4. The Briefing's "How battles work" card describes the new rules. Entrenching armies dig the territory in; armies that move do not. Demoralized armies rest and cannot entrench.
5. Run the soak test **once** and read only its summary line. Report S1 to S3 and the winner split against Revision 6 (70 percent freezes, Republic 89 percent of decided games). No tuning (P3).

**Acceptance:**
- Engine tests cover each case:
  - a territory with one healthy stayer and one mover digs in;
  - a territory whose only stayers are demoralized does not;
  - a territory where every army moved out keeps its level;
  - a fought-over territory keeps its level;
  - recovery is unchanged.
- Planning tests cover default orders, Move to Entrench and back, the Rest offer for demoralized armies only, and selection of armies that entrench by default.
- The replay determinism test still passes.

### B. Combined, approximate odds (A1, A2)

Port 5182. Worktree `spanish-diplomacy-v1-m2r7-b`, branch `m2r7-b-odds`.

**Owns:**
- `src/main/presentation/{odds,glyphs}.ts`
- `src/main/map/DestinationOddsLayer.tsx`
- `src/main/screens/DestinationChoices.tsx`
- a new small info-disclosure component under `screens/`
- the single `destinationEstimates(...)` call in `screens/OrdersScreen.tsx`
- odds styles in `style.scss`

**Tasks:**
1. Build the estimate's attackers as the selected armies plus the faction's planned move orders whose `to` is that destination, with no duplicates (A1). Do this in the presentation or selector layer; `engine/combat.ts estimateAttack` already sums armies from several origins. Filter planned orders by `kind === "move"`, so the code is safe after A merges.
2. Planned attack routes listed in the Orders pane show the combined odds of everything ordered to that destination.
3. Add "Approx." and "≈" wherever odds appear, plus the circled-i disclosure (A2). Glyphs go in `glyphs.ts` as `\u` escapes, because sources are ASCII-only.

**Acceptance:**
- Unit tests cover:
  - one army at 1 against 1 reads 1:1;
  - adding a second 1-attack army from another territory to the same destination reads 2:1;
  - an army already in a planned order is not counted twice when it is selected again.
- An app test opens and closes the "i" by click and by keyboard.
- axe is clean with the note open.

### C. Map: summed counters below 125% and smooth panning (Z1, Z2, K1)

Port 5183. Worktree `spanish-diplomacy-v1-m2r7-c`, branch `m2r7-c-map`.

**Owns:**
- `src/main/map/{keyboard,useMapCamera,camera,CounterLayer,counterItems}.ts(x)`
- the `layoutCounters(...)` call and signature, including passing `zoom` in from `CampaignMap.tsx`
- `components/MapControlsHelp.tsx`, if its text changes
- `e2e/mapCamera.ts` and `e2e/performance.spec.ts`

**Tasks:**
1. Add the threshold as one named constant, `individualCountersFromZoom = 1.25`. `layoutCounters` takes the camera zoom, groups everything below the threshold except `expandedTerritoryId`, and keeps today's behaviour at and above it (Z1, Z2).
2. Smooth keyboard panning (K1):
   - track the set of held keys;
   - advance the camera each animation frame by velocity times elapsed time, with the ease-in;
   - normalise diagonals;
   - ignore `event.repeat`;
   - stop on keyup, `blur`, and `visibilitychange`;
   - leave the existing target rules (`shouldHandleMapKey`) as they are.
   Keep the pure step functions testable. The frame loop is the only impure part.
3. Every camera change re-runs counter layout. Measure the per-frame cost while panning with the existing performance spec, and report it. If a frame goes over budget, keep the layout out of the per-frame path during a held pan. Possible fixes: memoising on the semantic level, or translating the counter layer and laying it out again when the pan stops.

**Acceptance:**
- Unit tests cover:
  - counter layout at zoom 1.0, 1.24, 1.25, and the operational level;
  - the expanded territory below the threshold;
  - the velocity integration, diagonals, and the stop conditions.
- An e2e test holds D for about 500 ms. The map moves right in several steps and none of them jumps. Assertions are tolerant, not exact pixel counts.
- Planning selection on a phone's overview still works (the existing e2e test).

### D. Resolution focus (F1)

Port 5184. Worktree `spanish-diplomacy-v1-m2r7-d`, branch `m2r7-d-focus`.

**Owns:**
- `src/main/screens/ResolutionScreen.tsx`, `screens/report/**`, and `screens/ResultPanels.tsx`
- `map/view.ts`: D adds `focusedTerritoryId?: TerritoryId` and any `onSelectUnit` handler; nobody else edits this file
- in `CampaignMap.tsx`, only the wiring that passes the focused territory as `expandedTerritoryId` and routes clicks to the view's handlers. C owns the `layoutCounters` call itself, so coordinate through the hand-off.

**Tasks:**
1. Focus state lives in the resolution screen, as local component state; it is not game state. The map handlers must never dispatch a planning action.
2. Battle cards expose a controlled "open" state, so the focused card opens even when it is collapsed (the third card and later). The pane scrolls it into view (`scrollIntoView`, respecting reduced motion) and gives it a visible highlight.
3. A place with no battle shows the note in F1. A focused territory is highlighted on the map with the existing selection styling.
4. Keyboard: Enter or Space on a territory or counter focuses it, through the same target rules as planning. Focus does not leave the map unless the player tabs into the pane.

**Acceptance:**
- App tests cover:
  - focusing a territory whose card is collapsed;
  - focusing a counter;
  - a place with no events;
  - clearing the focus;
  - focus by keyboard.
- An e2e test on a real turn-1 report clicks a battle territory and sees its card open and in view.
- axe is clean with a card focused.

### I. Integration

**Owns:** merges, `e2e/baselines/**`, `project/milestones/milestone-2-rev-7-declog.md`, the parent README, and the final verify.

**Tasks:**
1. Merge A, then B, C, and D into `milestone-2-rev-7`. Each merge commit, or its immediate fix-up, passes every check.
2. Regenerate the visual baselines once, after the last merge, and review every changed image. Expect the overview, destinations, and resolution images to change.
3. Run `npm run verify` from a clean checkout with `CI=1`, then the production smoke test.
4. Re-measure the initial chunk against the 155 kB budget (D62). Report an overrun; do not raise the budget.
5. Write the decision log with every stream's numbered decisions, the soak summary from A, the frame cost from C, and a short rubric re-score.
6. Stop at a verified `milestone-2-rev-7`. The owner plays it before it is squashed onto `main`.

## 3. Shared Rules For Every Agent

Revision 6 section 3 applies unchanged:
- work only in your own worktree, with your own `E2E_PORT`;
- every commit passes lint, typecheck, and unit tests, gated on exit codes;
- no baseline regeneration outside I;
- ASCII sources, with `\u` escapes for accents and glyphs;
- the seeded generator for every random number;
- nothing from `project/` reaches the app, and nothing in the app mentions balance;
- do not paste large test output into hand-offs.

**Hand-off report:**
- what changed;
- numbered decisions and assumptions;
- checks run, with results;
- files outside your ownership that you touched;
- screenshots to look at.

## 4. Not In Revision 7

- Balance tuning, and the open rule decisions from Revision 6.
- Order types other than Move, Entrench, and Rest.
- Deferring the engine out of the initial chunk.

## 5. Definition Of Done

1. A to D are merged by I, with every commit green.
2. `npm run verify` passes from a clean checkout, and the production smoke test passes.
3. Each decision in section 1 has a test or a capture a reviewer can check.
4. The soak summary and the panning frame cost are reported in the decision log.
5. The owner has played `milestone-2-rev-7` before it is squashed onto `main`.
