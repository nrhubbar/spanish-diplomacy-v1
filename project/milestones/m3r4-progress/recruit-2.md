# recruit-2 (P2)

Branch `m3r4-recruit-2`. The look of the Recruit pane only; no rule or number changed.

## The rules the other panes share
- Section heads: serif, 1rem, on the pane's own background; a soft hint on the right (`build-tab-head`, `pane-hint`).
- Rows (Build, This turn): paper card, 1px `--rule`, radius 8px, gap 0.4rem. Bold sans name with its icon, then one soft line of terms joined with a middle dot, the action on the right (`build-option`, `build-terms`). Locked: dashed, soft, the reason in bold accent under the terms (`build-option-locked`, `build-locked`).
- Summary card (Invade): `muster-box`, a 4px rule on the left whose colour says what it is about. Inside, a ledger: bold caption, hairlines, figures to the right, bold total last (`roll-ledger`).
- Buttons: `secondary-button compact-button` to add, underlined `text-button` to cancel. Off means faded.
- Buildings: icon and name in a soft wrapped line (`site-buildings`). Fold-outs: a small underlined question (`muster-why`).
- Figures are words in rows ("5 Funds · 1k Manpower"); icons with numbers only where they stand in columns.

## What changed
- `queues/OrderLedger.tsx` (was `OrderSlots`): one line for each order the territory has: symbol, unit, cost in columns, Cancel; or "Empty". Same height either way. An emptied line keeps its button out of sight, so the keyboard keeps its place.
- The totals are the ledger's last two lines. They are one element: it sticks to the top of the pane once the ledger is scrolled away, so it can't cover the last row. With the ledger in the half-height sheet, on a low screen and at large text in a narrow pane.
- The spent total was "This turn" and counts every territory's Recruit orders and Replenish, so it isn't the sum of the lines above it. It now reads "All recruiting".
- Rows are Build rows; `RecruitRow` is still shared with the training list and global Recruitment. The reason keeps two lines under the stepper, beside the row's own text, so it costs no height. Gold "ticked" rows, the lock emoji, columns of figures and the blue fold-out are gone.
- `_roll-ledger.scss`: the ledger's line style also for lists. `presentation/recruitment.ts`: `recruitsWith` replaces `recruitsWithLabel`, terms carry their kind, `recruitFigures` is gone.

## Outside the stream's files
- `TerritoryTabs.tsx`, `_pane-tabs.scss`: the first order gave the Recruit tab its count, which wrapped "Production" and moved the whole pane 35px when it was scrolled to the top (the first pass's test was saved by scroll anchoring). The count now keeps its place, and the tabs' padding is 8px, not 12px, so all four fit. New test.

## Still to change
- The Recruit tab with no orders has a gap where its count will go.
- The ledger and the territory's header fill a 1440x800 pane, so the unit rows start below the fold.
