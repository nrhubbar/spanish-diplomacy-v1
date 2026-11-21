# m3r2-map-orders: progress

> Internal. Phase 2 of Milestone 3 Revision 2 (tasks §3.3 `map-orders`): U5, U6, U7 and U8's order lines.

## Done

- **U8, order lines** (`map/routes.ts`, `map/RouteLayer.tsx`):
  - Every move line runs through the sub-territory capitals that `orderLine` gives, March included. It is a polyline of straight segments, trimmed at both ends, with an arrowhead on the last link.
  - Each lane sits to the right of its links, so opposite directions part.
  - Routes group by their line as well, so a Rail move and a March move over the same pair are drawn apart.
  - `battleMarkPoints` uses the same geometry.
  - Lines are cached per board, so panning doesn't re-check routes.
  - With no line, it is drawn straight between the anchors (MO1).
  - The class names are unchanged, for the Layers toolbar (ML5).
  - `routeCurve` stays, for the sea lanes only.
- **Odds with Ground Support.** `destinationEstimates` and `plannedEstimates` now pass the draft's Ground Support (`plannedSupport`) to `estimateAttack`.
- **U5, quick actions.**
  - `presentation/quickActions.ts` decides which actions show, which are greyed out and why (MO6).
  - `screens/actions/QuickActionMenu.tsx` draws the menu: a dropdown at the cursor, or a wheel on touch.
  - `map/useTerritoryPress.ts` handles right-click, long-press (500 ms; a drag cancels it; it is deduplicated against Android's context menu, and the click that follows is swallowed) and hover (MO7).
  - Each action opens its pane view (`quickActionView`).
- **U6, Invade and Reinforce** (`presentation/muster.ts`, `presentation/moveModes.ts`, `screens/actions/MusterView.tsx` and `MusterBoxes.tsx`):
  - Unit cards are grouped by source. Each has a tick box, values, a strength bar, a dug-in chip, and mode chips: unavailable ones are struck through, with the reason listed.
  - When a tick would replace another order, the card says so.
  - "Already here" lists units by pocket and leaves them out of the odds (MO3).
  - Ground Support lists aircraft in range, ticked up to `air.supportMax`, with the reason shown on the rest.
  - The odds box covers attack against defence, the odds, the take chance, the defenders, the air battle line, the pass line and an artillery-alone warning.
  - The Reinforce box shows defence now and after, and the strongest threat's odds before and after (MO5).
  - "Order N units (and M aircraft) to invade" runs `orderFromMuster`, then `orderMuster` (`state/planning/muster.ts`). That checks every move and mission through the engine, replaces other orders, clears unticked ones, leaves nothing selected, and pops the pane.
- **U7, reach** (`presentation/reachNote.ts`, `screens/actions/ReachCard.tsx`, `useMapActions.tsx`):
  - While a Move is being given, hovering over an unreachable territory shows the `reachFor` reasons, each led by its mode icon.
  - On a phone, a touch tap opens the same reasons in a modal card.
- **Wiring** (MO8): `MapView` callbacks, `CampaignMap`, `VectorLayer`, `MapLayers`, `gameSlice`, `OrdersScreen` (it draws the overlay) and `stayWithout` exported.
- **Tests:**
  - `src/test/ui/orderLines.test.tsx` covers the lines, geometry and layer.
  - `mapOrdersLogic.test.ts` covers the view models, the chips, odds, defence, quick actions, reach notes and the muster order.
  - `mapOrdersScreens.test.tsx` covers the jsdom flows: dropdown, wheel, long-press, panes, Ground Support cap, hover card and phone modal.
  - `map.test.ts` dropped the curve-helper test.

## Review

`diff-reviewer` ran once and found no blocking bugs. Fixed:
- **No cap means no cap.** An absent `air.supportMax` no longer caps the Ground Support ticks at 2 (`supportCount` and `supportBlocked`).
- **The pane clears only what it listed.** A Reinforce order no longer drops the Ground Support planned over the same ground: `MusterOrder.shown`.
- **A chosen mode the card can't take** falls back to the card's default mode's legs, not to a plain step.
- **A second finger (a pinch)** cancels the long-press.

Fixed as well, from a self-check:
- **A refused order** keeps the pane and its ticks and shows why (`musterRefusal`).
- **Focus** moves to the first action, or to OK, once when the menu or card opens, not on every render.
- **Report lines** keep only a line that runs from the origin to the destination. Battle routes are traced along their move's legs.
- **iOS** no longer shows its own long-press callout on the map.

## Checks

- `npm run lint` and `npm run typecheck`: clean.
- `npm run test:unit`: 110 files and 1,452 tests pass. Global coverage is 98.48 statements, 94.59 branches, 98.73 functions and 99.40 lines.
- Per-file coverage of the touched files:
  - New and changed files meet the gate.
  - `CampaignMap.tsx` (79.2 branches) and `VectorLayer.tsx` (85.3) were already below it. They gained no uncovered branches: the leftovers are the existing zoomed sub-territory click, the briefing and the map's fallbacks.

## Left

- Not seen in a browser: no Playwright and no screenshots. The mock's "Show route" button on the phone card isn't built.
- Army-wide limits (one truck allowance, rail capacity) on a pane's mixed picks are judged at the reveal (MO2).
- **A gap against "every line follows links":** the resolution screen's lines are read against the end-of-turn board. When that board no longer describes a move, the line is drawn straight (MO1). Keeping the start-of-turn board on the resolution session would make every line exact.
- **Merge with `milestone-3-rev-2` (map-layers):** `git merge-tree` shows two textual conflicts, both append-only: `milestone-3-rev-2-declog.md` (rows) and `style.scss` (one `@use` line each). `CampaignMap.tsx` and `MapLayers.tsx` merge cleanly. The tip's `map.test.ts` still imports the removed curve helpers; this branch's `map.test.ts` already drops them.
