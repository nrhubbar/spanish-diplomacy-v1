# `invade` (notes 3, 4 general, 12)

## The stuck line (note 3), as reproduced on the unchanged code
1. New game, Start Campaign, Escape.
2. Right-click Castilla y León, Invade. Tick Covadonga Infantry Regiment No. 4 (From Madrid) and the Breguet bombers (Ground Support). Order.
3. The map draws the move's dashed line and the aircraft's dashed line.
4. This turn: Cancel on the move. The move's line goes; `.air-mission-line` stays, with Ground Support still planned.

Cause: `removeOrder` touched only `draft.orders`. Not the cause: `AirLayer` reading `draft.airOrders` (a real divergence, also fixed).

## What changed
- `cancelIdleSupport` (`state/planning/orders.ts`), called from `inPlanning` in `gameSlice`, so every reducer passes through it. It compares the draft before and after: Ground Support planned on its own stays.
- One estimate: `attackEstimate` (`presentation/odds.ts`) for the map chip, This turn and the pane, with the legs and `airDraftOrders`.
- One judge of armies: `judgeArmies` (from `checkArmies`, `engine/movement/transit.ts`); `judgePlannedMoves` for planning. One refusal (`movesRefusal`) and one draft builder (`draftWithMoves`) for Move and the panes.
- `presentation/musterFit.ts`: the pane fitted to the ticks (trains, trucks, landings, generals), and Select all. `muster()` = `musterList` + `fitMuster`.
- Divergence found on the way: the pane offered Motor to units with no trucks, which the reveal holds back. It now offers Motor only where transport there could carry the unit, and takes the trucks along.
- Generals, trucks and anti-air are listed where a unit that can fight sets out, and go only the same way as a ticked one.
