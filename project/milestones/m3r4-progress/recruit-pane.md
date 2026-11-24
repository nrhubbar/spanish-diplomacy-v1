# recruit-pane (N2)

Branch `m3r4-recruit-pane`.

## Cause
- The training queue, with this turn's orders, was drawn above the unit rows, so each "+" pushed them down. The basket line and the rows' details also changed size. `e2e/recruit.spec.ts` failed on the old code in all six layouts tried.

## What changed
- `RecruitTab`: header, order slots, "Can recruit now", "Locked here", "In training", totals. Sections depend on the territory alone (`typeLock`, site), never on money or slots, so a card can't jump.
- `queues/RecruitRow.tsx` is the row both Recruit surfaces share (with `UnitSymbol`, `ResourceCells`); `queues/TrainingList.tsx` draws training on both; `queues/OrderSlots.tsx` is the slot row. They reuse the `muster-card`, `muster-group` and `muster-box` classes; nothing in `_actions.scss` changed. `QueueList` is now build queues only.
- "In training" on the tab leaves this turn's orders out (the slots show them). It would otherwise grow and shrink with each order and shift a pane scrolled to its end. Global Recruitment still lists them, with Cancel.
- Reasons: one line kept on every card ("Not enough Funds", "No orders left", "Upkeep too high next turn"), the figure concerned in red; the full sentence in the title, description and details.
- Steppers use `aria-disabled`, so the keyboard keeps its place at the last order.
- Details open over the card's head only, so none is drawn over the next card's stepper.
- Totals: icons and numbers, constant height. Sticky on a desktop and in the tall phone sheet; at the end of the pane in the half-height sheet, at large text in a narrow pane and on a low screen.

## Outside the stream's files
- `state/planning/recruitment.ts`: `setRecruitQuantity` keeps other orders' places; `takeBackRecruit`. `state/gameSlice.ts`: `cancelRecruitOrder`.
- `presentation/queues.ts` (`TrainingEntry`), `presentation/recruitment.ts` (figures, cells, short notes), `e2e/capture.spec.ts` (hover the head).

## Not done
- Global Recruitment has no order slots. The half-height phone sheet shows little of the pane with units selected (as before).
- Taking an order back from a slot is silent, as cancelling a build is.
