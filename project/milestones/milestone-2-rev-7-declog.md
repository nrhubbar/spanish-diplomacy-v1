# Milestone 2 Revision 7 Decision Log

> Internal. Nothing here may be imported into or rendered by the player-facing application.

This log records the decisions and assumptions made while carrying out `milestone-2-rev-7-tasks.md`. Each one is numbered for reference. The product decisions (F1, O1 to O5, A1, A2, Z1, Z2, K1) are in section 1 of the tasks document; this log says how they were carried out.

## Process

**D1. Branches and worktrees.** Integration happens on `milestone-2-rev-7`, in `../spanish-diplomacy-v1-rev7`. Each of the four workstreams was cut from `fbb2ad5` (the Revision 7 tasks commit) and has its own worktree:

| Stream | Branch | Worktree | Port |
|---|---|---|---|
| A | `m2r7-a-orders` | `../spanish-diplomacy-v1-m2r7-a` | 5181 |
| B | `m2r7-b-odds` | `../spanish-diplomacy-v1-m2r7-b` | 5182 |
| C | `m2r7-c-map` | `../spanish-diplomacy-v1-m2r7-c` | 5183 |
| D | `m2r7-d-focus` | `../spanish-diplomacy-v1-m2r7-d` | 5184 |

The integrator uses port 5185. All four streams ran at once, and the integrator merged them in the order A, B, C, D.

## Standing orders: Entrench and Rest (workstream A)

**D2. The standing order is derived from morale (O5).** `engine/orders.ts` exports `StandingOrder` and `standingOrder(unit)`. A demoralized army rests; any other army entrenches. The engine still takes `MoveOrder[]`, so the computer player, routes, and coordinator are unchanged.

**D3. Digging in needs an entrencher (O3).** `digIn` now receives the set of armies with a valid move order. A held, unfought territory gains works only if one of the holder's armies there:
- was healthy at the start of the turn;
- had no valid move order;
- is still there at the end of the turn.

Engine tests cover:
- one stayer and one mover;
- demoralized stayers only;
- everyone moved out;
- a fought-over territory;
- unchanged recovery.

The M22 and M23 rule text says the same.

**D4. The order menu is computed for the current selection.** `orderKinds` is replaced by `orderKindsFor(session)`. It always offers Move. It adds Entrench when every selected army is healthy, or Rest when every one is demoralized. A mixed selection gets Move only, so a healthy army is never offered Rest (O2). `OrderKind` is now `"move" | StandingOrder`, but an order stage can only be a move.

**D5. Selection means "no move order".** An army that is moving can be selected again. Choosing Move for it replaces its order instead of adding a second one. Choosing Entrench or Rest cancels the move. Clearing a move returns the army to its standing order.

**D6. The Orders pane says what every army is doing.** The pane has a "Your orders" section with a "N moving, N entrenching, N resting" summary. The counts add up to every army the faction has (O1). Below it is the "Planned moves (N)" list. In the army list, each army without a move shows "Entrenching" or "Resting".

**D7. The Briefing's "How battles work" card describes the new rules:**
- entrenching armies dig the territory in;
- armies that move do not;
- demoralized armies rest and cannot entrench.

## Combined, approximate odds (workstream B)

**D8. Destination odds count the planned moves (A1).** `destinationEstimates(..., plannedOrders)` adds the faction's planned moves to the same destination, and a set ensures no army is counted twice. The engine's `estimateAttack` already sums armies from several origins. The estimate still assumes the defenders stay and nobody else joins.

**D9. Planned attacks show their combined odds.** `plannedEstimates` gives the odds of every army ordered to each destination. Each planned route in the Orders pane shows them (`PlannedOrderOdds`). Moves that meet no battle show none.

**D10. Odds read as approximate everywhere (A2):**
- map chips show "≈ 2:1 · 50%" (`glyphs.approx`);
- the pane shows "Approx. 2:1 · 50%";
- accessible names say "Approximately 2:1, 50 percent to take it."

**D11. The circled "i" is a plain disclosure.** `screens/OddsInfo.tsx` is a real button with `aria-expanded` and `aria-controls`, so click, tap, Enter, and Space all work. The "i" sits beside the Destinations heading and below the planned moves, and it opens one sentence on why the real odds may differ. The map chips do not carry an "i", because a chip-sized target would fail the mobile target-size check; the pane copy is enough.

**D12. A re-selected army counts once, at its new destination.** If an army with a planned move is selected again, the destination odds count it where it would now go. Its old order is ignored. The interaction with D5 is described in D19.

## Map: summed counters and smooth panning (workstream C)

**D13. One named threshold (Z1).** The threshold is one constant, `individualCountersFromZoom = 1.25` in `CounterLayer.tsx`. `layoutCounters` now takes the camera `zoom` instead of a semantic level. Below the threshold, each faction's armies in a territory always share one summed counter. At 125% and above, the Revision 6 rules apply unchanged.

**D14. The expanded territory always splits (Z2).** The selected territory in planning keeps its individual counters below 125%. So does the focused place on the report (D17). App tests that pick an individual counter now zoom to 125% first. So does the production smoke test.

**D15. Held keys pan smoothly (K1).**
- The pan intent now carries a `direction`.
- `map/keyboard.ts` holds the pure step functions: cruise speed 800 px/s, a 120 ms ease-in, normalised diagonals, and a 50 ms cap on any one frame.
- A quick tap still glides about 60 px (`panStepPixels`).
- `useMapCamera` runs the frame loop. It ignores `event.repeat`, and it stops on keyup, window `blur`, and `visibilitychange`.
- Pan keys pressed with a modifier (such as Cmd+D) are left to the browser, because macOS sends no keyup for them.
- `shouldHandleMapKey` is unchanged.
- The help text says "hold".

**D16. Counter layout stays in the frame path.** C measured about 1 ms of script per frame on the desktop production build, 2 to 4.5 ms on a 4x-throttled phone, and well under 1 ms for `layoutCounters`. That is within budget, so no memoising or deferred layout was added. The frames that do drop come from software-rendered WebGL relief in headless browsers. A flat-map run, with the relief blocked, holds 60 Hz.

## Resolution focus (workstream D)

**D17. Focus is local state in `ResolutionScreen`, not game state (F1).**
- `MapView` gains `focusedTerritoryId` and `onSelectNothing`.
- `highlightedTerritoryId(view)` (the selection, or else the focus) drives the map highlight and the expanded territory.
- The map handlers never dispatch a planning action.

**D18. The pane follows the focus.** Battle cards have a controlled open state, so a collapsed card opens. `screens/report/focus.ts` finds a territory's cards, including road meetings at either end. It also writes the note for a place with no battle: what happened there, or "Nothing happened in {territory} this turn." The card scrolls into view, with no animation when the player asks for reduced motion. Clicking the same place again, or empty map, clears the focus. Cards the player opened stay open.

**D19. Keyboard focus stays on the map.** Enter on a summed counter opens it into single armies, which removes the element that held focus. `map/useFocusRescue.ts` then moves focus to the territory's region, or to the map itself, and never to the page body. Map names, cities, sea lanes, and routes are `pointer-events: none`. A click on one of them now reaches the territory beneath it, instead of clearing the focus.

## Integration

**D20. Merges.** Each stream was merged with `--no-ff`. Any fix-up was folded into that stream's merge commit, so every commit on the integration line passes lint, typecheck, and unit tests. Each merge also passed its stream's own browser specs on Chromium and Pixel 7 before it was committed: the acceptance spec, and the keyboard-pan, performance, and report-focus specs from C and D. Visual baselines were left for one pass at the end, as the tasks ask (I.2).

| Commit | Merge | Fix-ups folded in |
|---|---|---|
| `aef265e` | A | D21, D22 |
| `06de8ee` | B | D23, D24, D25 |
| `316a534` | C | D26, D27 |
| `a3fd039` | D | D28, D29 |
| `35700fc` | Baselines | D31 |

**D21. Counters name the planning player's orders.** A left the map counters' accessible names saying "order planned" for moving armies, and saying nothing for the others. The status words (Moving, Entrenching, Resting) now live in `presentation/army.ts`, and the army list and the counters share them. `OrdersScreen` passes the order of each of its own armies to the map as `MapView.unitOrders`. As a result:
- a counter's name ends with "moving", "entrenching", or "resting";
- a summed counter's name ends with "2 moving, 1 entrenching".

Enemy armies and the report screens name no order, because the player cannot know another faction's orders. The visual "ordered" mark still means a move. Unit and app tests cover both kinds of name.

**D22. Digging-in descriptions follow O3.** The scenario schema described works as gained "per quiet turn". It now says a territory gains them each turn its holder keeps it without a battle while one of the holder's armies there entrenches. `scenario.schema.json` was regenerated, and `spec:check` passes; the only change in the schema is that description. The engine type comments now say "entrench" and "turn of rest".

**D23. B's insertions applied cleanly to A's rewrite of `OrderBuilder.tsx`.** `PlannedOrderOdds` sits inside each planned route. `PlannedOddsInfo` follows the "Planned moves" list and returns nothing when there is no planned battle. B's call to `destinationEstimates` in `OrdersScreen.tsx`, with `draft.orders` in its dependencies, merged without conflict.

**D24. Phones reach the destination "i".** On the phone's sheet layout, the pane stays collapsed while the player chooses a destination, so the "i" beside Destinations was unreachable. The sheet bar ("Choose a highlighted territory.") now carries the same `OddsInfo`, and its note opens upward inside the bar. B's e2e test now runs the click and keyboard cycle on phones too. It finds the note through `aria-controls`, because the hidden pane holds a second copy of the text. The test passes on Pixel 7 and iPhone 14, and axe is clean with the note open.

**D25. Moving armies' odds after a replaced move (D5 with D12).** One test selects an army that already has a planned move and points it elsewhere. While it is choosing, the old destination counts it once. The new destination counts it, but not the other planned army. After Move replaces its order, the planned odds at the old destination drop it. B's `kind === "move"` filter was removed, because O5 keeps every order a `MoveOrder`, so the filter could never be false; that matches "code past the loader trusts its types". Its test, which built a fake "hold" order with a cast, went with it.

**D26. Hidden map instructions say "hold".** The screen-reader instructions on the map now say "Drag, or hold W, A, S, and D or the arrow keys, to pan.", matching the help text.

**D27. Z1 also reached B's new app test.** B's combined-odds test picked a single counter at 100%, which merged cleanly as text but failed once counters were summed. It now zooms to 125% first, as C's other tests do.

**D28. One conflict, in `CampaignMap.tsx`, next to `layoutCounters`.** The resolution keeps C's `camera.zoom` argument and D's `expandedTerritoryId = highlightedTerritoryId(view)`. C added no `onBlur` of its own to the map surface, because its pan stops on window blur, so D's `focusRescue.onBlur` stands alone.

**D29. Z2 on the report has its own test.** At 100% zoom, the resolution map now shows summed counters. A new app test checks three things. Focusing Madrid splits its four Republican armies into single counters. Every other place stays summed. Clearing the focus sums Madrid again. D's existing app tests and `e2e/reportFocus.spec.ts` pass unchanged on Chromium and Pixel 7.

**D30. `useFocusRescue` does not slow panning.** Its layout effect runs on every map render, pan frames included, but it returns at once: during a held pan the focused element is the map surface, which is still connected. The development-build pan measurements were taken at the C merge and again at the D merge, on Chromium and a 4x-throttled Pixel 7, at 100%, 125%, and 175%. Script time per frame was 4.9 to 6.9 ms before and 4.8 to 7.3 ms after on desktop, and 12.6 to 19.7 ms before and 15.4 to 20.9 ms after on the phone. These runs share the machine with other tests, so that difference is noise. The production figures are in D33.

**D31. Visual baselines were regenerated once and every changed image was reviewed.** `npm run e2e:baselines` rewrote all fourteen images. Eleven differ from before (the mobile setup, overview, and fallback did not):

| Image | Change | Cause |
|---|---|---|
| desktop planning-overview, fallback | One summed counter per faction and territory at 100% | Z1 |
| desktop and phone planning-destinations | "≈" on the map chip, "Approx." and an "i" by Destinations, "Entrenching" in the army list, Madrid split into four counters while the rest are summed | A2, D6, Z1, Z2 |
| desktop planning-operational and detail; phone operational and detail | "≈" chip, "Approx.", the "i" (on phones, in the sheet bar), "Entrenching" | A2, D6, D24 |
| desktop and phone resolution | The Northern stack in Castilla y León has no dug-in badge after turn 1 | O3: none of its armies there entrenched |
| desktop setup; designations in operational and detail | "Sevilla" for "Seville"; SIER, DURR, MOLA for MSC, D, MSS | Revision 6 D64 and D65. Those changes came after the last baseline pass and stayed within tolerance, so this is the first baseline that records them. |

## Soak (workstream A)

**D32. The soak test after standing orders** covers seeds 1 to 200, with 30 turns each. A ran it once and read only the summary.

| Measure | Revision 7 | Revision 6 (D60) | Budget |
|---|---|---|---|
| S1 early wins | 0 | 1 (0.5%) | 5%, met |
| S3 abandonments | 0 | 0 | 0, met |
| S2 freezes | 116 (58%) | 139 (70%) | 20%, missed |
| Decided | 103 (Republic 42, Northern 48, Southern 13) | 79 (Republic 70, Northern 4, Southern 5) | No target |

Requiring an entrencher means a territory whose armies all march out no longer digs in. That cut freezes by 12 points and moved the decided games from the Republic, 89 percent of them in Revision 6, to an even split: 41 percent Republic, 47 percent Northern, 13 percent Southern. Nothing was tuned (P3).

The integrator checked the re-baselined bands in `src/test/soak.test.ts`. They record the measurement without loosening it:
- the freeze band is 0.48 to 0.68 around 0.58, and the decided band 0.42 to 0.62 around 0.515, the same plus-or-minus 10 points Revision 6 used around its own figures;
- the S1 check (at most 5 percent), the S3 check (exactly 0), the first-turn movement check, the "every faction wins some game" check, and the determinism check are unchanged.

The soak is deterministic, so the passing unit run is the evidence.

## Release checks

**D33. Panning frame cost.**
- C measured the production build: about 1 ms of script per frame on desktop, and 2 to 4.5 ms on a 4x-throttled phone. `layoutCounters` takes well under 1 ms.
- The merged production build after D: not run. The owner waived the final verify, production smoke, and production pan measurement on 18 November 2026.
- The development build in verify: not run. The owner waived the final verify, production smoke, and production pan measurement on 18 November 2026.
- The regression guard is one frame of script on desktop and four on the throttled phone, and it held in every run that was taken.

**D34. Verify and production smoke.** Not run. The owner waived `npm run verify` from a clean checkout and the production smoke test on 18 November 2026, and asked for Revision 7 to be squashed onto `main` without them. The evidence is the per-merge checks in D20.

**D35. Initial chunk: 150.5 kB gzip, within the 155 kB budget (D62).** The production build's `index` chunk is 484.6 kB, or 150.52 kB gzip, up from 150.0 kB in Revision 6. That leaves 4.5 kB of headroom, and the budget was not changed. The map screens chunk is 36.9 kB, up from 33.3 kB with the odds "i", the planned odds, and the report focus. The Three.js chunk is 130.9 kB, unchanged.

## Rubric re-score (coding principles)

| # | Score | Evidence |
|---|---|---|
| R1 | 5 | `standingOrder` lives in the engine, behind the lint import boundary. Presentation and map import nothing from `state/` (D21 keeps the order words in `presentation/`). |
| R2 | 5 | `StandingOrder` and `OrderKind` are unions, and an order stage can only be a move. `MapView.unitOrders` and `focusedTerritoryId` are readonly and optional. |
| R3 | 5 | Orders stay `MoveOrder[]` (O5). The replay determinism and soak determinism tests pass. Panning is the only impure frame loop, and its step functions are pure and tested. |
| R4 | 5 | No new `as` casts or non-null assertions in `src/main`. B's test cast was removed with the dead filter (D25). |
| R5 | 5 | Report focus is local component state. Screens still route only through the session guard. |
| R6 | 5 | Store and registry are injected as before. |
| R7 | 5 | Digging in still reads `combat.diggingIn` from data. The zoom threshold and pan motion are named constants. |
| R8 | 4.5 | New modules are small (`focus.ts`, `useFocusRescue.ts`, `OddsInfo.tsx`, `PlannedOrderOdds.tsx`). Several files are now over the 200-line target: `state/planning.ts` (239), `CampaignMap.tsx` (236), and `useMapCamera.ts` (232), along with Revision 6's `combat.ts` (316) and `TerrainLayer.tsx` (210). |
| R9 | 5 | No dead code. The always-true move filter is gone (D25). |
| R10 | 5 | The feedback boundary is unchanged. The odds note and the report note are inline answers to the player's own action. |
| R11 | 5 | 484 unit tests, at 95.0 percent branch coverage. There are tests for every section 1 decision: engine cases for O3, planning flows for O1, O2, and O5, odds for A1, disclosure flows for A2, layout at 1.0, 1.24, 1.25, and operational zoom, pan integration for K1, Z2 on the report, and focus flows for F1. |
| R12 | 4.5 | axe is clean with the odds note open and with a card focused, and phones can now reach the "i" (D24). Counters name each army's order (D21). The manual screen-reader, 200 percent zoom, and high-contrast checks are still open from Revision 5. |
| R13 | 5 | All five integration commits pass lint, typecheck, and unit tests, and each merge also passed its streams' browser specs before it was committed. The baselines changed once, in their own reviewed commit. |

The average is 64 / 13 = **4.92**, and no row is below 4.5.

## Open for the owner

- **Play-through.** The owner chose to squash `milestone-2-rev-7` onto `main` without a play-through or the final verify (tasks section 5.2 and 5.5 waived, 18 November 2026).
- **Balance:**
  - S2 freezes are at 58 percent, against a budget of 20, down from 70 (D32).
  - Decided games now split Republic 41 percent, Northern 47, Southern 13, where Revision 6 had the Republic winning 89 percent.
  - Both are measured and reported, not tuned (P3). The digging-in cap is still the strongest lever the D52 probe found.
- **Rules D29, D31, and D32 from Revision 6 still need confirmation:**
  - standing battles in shared territories (D29);
  - every army starting at full strength (D31);
  - the Army of Africa crossing the Strait on turn 1 (D32).
- **Initial chunk budget (Revision 6 D62).** The chunk is 150.5 kB against the 155 kB budget the integrator set in Revision 6 (D35). Accept that budget, or schedule the follow-up that moves the coordinator off the initial chunk.
- **Historical sign-off (OD-3)** on the 35-army order of battle.
- **Manual accessibility checks**: screen reader, 200 percent zoom, and Windows high contrast. The new "i" disclosures and the counter order names (D21) are worth including.
- **Worktrees.** The Revision 5, 6, and 7 worktrees and the four stream worktrees were removed after the squash. Their branches remain.

## Follow-ups

- Bring `state/planning.ts`, `CampaignMap.tsx`, and `useMapCamera.ts` back under 200 lines, along with Revision 6's `combat.ts` and `TerrainLayer.tsx`.
- On a phone, the wider "≈" odds chip at a destination can cover the zoom readout or a neighbouring counter. The plaques already overlapped in Revision 6; the glyph makes them a little wider.
- Each planned route computes all planned estimates separately (`usePlannedEstimates`). That is cheap with 15 armies, but it could be lifted to one computation per pane.
- Revision 6 follow-ups still stand: defer the engine out of the initial chunk, the dense phone overview on the turn report, and merging the outcome-art sanitizer with the map geometry sanitizer.
