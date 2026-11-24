# Milestone 3 Rev 4: tasks

> Internal. The source of truth for this revision; the owner's words are in `milestone-3-rev-4-ideation/owner-notes.md`. Items marked **(default)** are in the owner's question page: build them so the answer is a small change (data or one component).

Bar: production quality, no hacks, high coverage. No sims and no AI-against-AI batches (the owner has been asked; until they say yes, none). Token target for the whole revision: 1.5M.

## Worker rules
- Integration branch `m3r4`, worktree `../spanish-diplomacy-v1-m3r4`. Each stream: branch `m3r4-<stream>`, sibling worktree `../spanish-diplomacy-v1-m3r4-<stream>`. Stage by path. Small commits on your own branch, ending with the `Co-Authored-By` line you were given. Never push, never bare `git stash`, never `git add -A`.
- Shell rules: `m3r4-progress/shell-rules.md`. Read them first.
- Never change `e2e/baselines/`, `e2e/production.spec.ts`, thresholds or coverage settings; no skipped tests, no v8 ignores, no `any`, no branching on a unit, building or faction id. Rules and numbers live in scenario data and Zod schemas (`npm run spec:build` after a schema change). The engine stays pure and deterministic. Seeded fixtures that shift because a die is now rolled differently are re-derived, never loosened.
- Player-facing text: plain English, no ids or rule codes. No "pays for itself" text.
- Every new branch has a test; add or update a Playwright flow for each UI change (own `E2E_PORT`, desktop chromium). Before hand-back: `npm run lint && npm run typecheck && npm run test:unit`, and your own specs.
- Stay inside your stream's files; say so if you had to leave them. Token cap below; at 80% commit and hand back what is left. Don't start subagents.
- Hand back under 400 words (commits, what changed, tests, not done or verified, baselines broken, decisions, collisions) and leave `m3r4-progress/<stream>.md`, under 60 lines.

## Streams

| Stream | Cap | Notes | Owns |
|---|---|---|---|
| `invade` | 220k | 3, 4 (general), 12 | `presentation/muster.ts`, `presentation/odds.ts`, `state/planning/{muster,orders}.ts`, `screens/actions/Muster*`, `state/planning/mapView.ts` |
| `air` | 220k | 4 (Ground Support), 6, 11 | `engine/air/`, `engine/d20/estimate.ts` air part, air text and report, `screens/pane/AirPane.tsx`, `state/planning/air.ts`, AI `air-mission.ts`, the Ground Support row and air line in the Invade card |
| `orders-ux` | 160k | 1, 5, 9, 10 | `screens/ArmyPicker.tsx`, `DisbandControls`, selection bar and order menu, `state/planning/{disband,selection}.ts`, number formatting, sound settings, general tooltips |
| `recruit-pane` | 150k | 2 | `screens/pane/RecruitTab.tsx`, `screens/queues/`, `_recruit.scss`, `_queues.scss` |
| `ai` | 250k | 7, 8 | `src/main/ai/` except `air-mission.ts` |

Merge order: `air`, `invade`, `orders-ux`, `recruit-pane`, `ai`. Each gets one `diff-reviewer` pass.

## Decisions

### N1 Disband is a unit order (`orders-ux`)
- Disband joins the order menu beside Move, Entrench, Rest and Replenish for the selected units (several at once), with one confirm step naming the units and what it saves. A selection it can't apply to (generals) isn't offered it. The always-visible Disband block on every unit card goes.
- Desktop: a button directly after the unit list, "Order for 3 selected units" (singular for one; disabled with "Select units first" when none), opens the same menu the selection bar opens. One menu component, two entry points.
- Phone **(default)**: the same button, full width, sticky at the bottom of the sheet above the bar; the menu opens as a bottom sheet with large rows.
- Aircraft: Disband sits with the missions (after Stand down), with the same confirm.
- The "Goes home at the end of the turn" state stays visible on the unit's card, with Keep.

### N2 Recruit pane (`recruit-pane`)
- Adding or removing a unit must not move anything else in the pane: the "+" under the pointer stays where it was, on desktop and phone, with and without a queue, at every slot count. A Playwright test asserts the bounding boxes of every stepper before and after several clicks.
- **(default)** layout: at the top a fixed row of order slots (one per Recruit order this territory has; empty slots drawn, filling with the unit's symbol; a click on a filled slot takes it back), then the unit rows, and at the bottom, below the rows, "In training". The totals line ("This turn", "Left") is a sticky footer of constant height. Long reasons (locked, can't afford, shortage) have a reserved line, never an inserted one.
- Bring it up to the Invade pane's standard: cards like `muster-card`, symbol, name, attack-defence, cost, men, time, upkeep in aligned columns, effects as a fold-out, sections for "Can recruit now" and "Locked here".
- The two Recruit surfaces (territory tab and the global recruitment view) share one row component.

### N3 One planned attack, one planned move (`invade`)
- Reproduce the stuck dotted line in a browser first, on the code as it is, and write down the steps. Candidates: Ground Support's dashed line survives cancelling the units' moves; `orderMuster` and `musterPicks` disagree about which orders the pane "shows"; `AirLayer` draws `draft.airOrders`, not `airDraftOrders`. Fix the cause and add a Playwright test of those steps.
- Rule: when the last own ground order into a territory is cancelled, and none of the player's units stand there, Ground Support planned over it is cancelled too, and the feedback says so. Any cancel path (This turn, the pane, selecting another order, Disband) goes through one function.
- The Move path (`chooseDestination`, the destination odds) and the Invade and Reinforce panes use one planning function for giving the orders and one for the estimate (moves with their chosen legs, the planned moves already there, support, generals). The same attack shows the same odds on the map chip, in This turn and in the pane; a test asserts it. `destinationEstimates` passes the planned routes as `invadeOdds` does.

### N4 Bonuses in the Invade odds (`invade`, `air`)
- Generals can be ticked in Invade and Reinforce (today `reachingUnits` leaves them out), with their bonus on the card, and the best one's bonus and trait show in the ledger. A general can't go alone; say so plainly.
- Ground Support shows as a ledger row: "Ground Support, 2 aircraft" with its value. When an air battle decides it, the row shows the average to tenths, marked "average; air battle first", and a fold-out lists the five results with their chances. The total includes it. (`air` owns this.)

### N5 Tenths (`orders-ux`)
- Every number the player sees has at most one decimal. One formatter in `presentation/`, used everywhere (amounts, upkeep, income, chips, ledgers, odds); whole numbers print without a decimal. The engine keeps thousandths. A ledger's total is the rounded true total **(default)**; where rounded rows don't add up to it, that's accepted. Amounts under 0.05 print as "<0.1".

### N6 Choosing mission targets on the map (`air`)
- No drop-down for any mission's target **(default: all four missions; raids pick a sub-territory)**. Choosing a mission highlights the territories in range that are valid; a click (or Enter, or a tap) on one plans it; Escape or Cancel leaves; a territory out of reach says why, as for Move. Keyboard users can step through the highlighted territories as they do for Move. The Invade pane's Ground Support ticks stay.

### N9, N10 Small ones (`orders-ux`)
- Sound controls leave the in-game menu; Settings has them, reachable from that menu in one click.
- Hovering or focusing a general (map counter, unit card, Invade card) gives his name, trait and die effect in plain words, e.g. "+1 on the battle roll of his army; +1 more when attacking". On touch, the unit card shows the same text. Both use one text function, read from the scenario's effects.

### N11 Air superiority (`air`)
- One d20 for both sides: the score is the die plus the attacker's air rolls (every aircraft, as the engine sums today **(default)**; fix the "only the best aircraft counts" text) less the defender's and the defender's anti-air, clamped to 0..20. One table in the scenario's `air` block decides the result for both, higher better for the attacker. Two d20s and "higher total wins" go.
- **(default)** table, in data, each row with a name and each side's share of its Ground Support (rounded down): up to 3 "Defender commands the air" 0 / all; up to 8 "Defender holds the edge" half / all; up to 12 "Contested sky" half / half; up to 17 "Attacker holds the edge" all / half; 20 "Attacker commands the air" all / 0. (attacker / defender.)
- With no air battle, as today. The estimate weighs the chances exactly over the table (`plannedAir`, `weighOdds` over several results), so the AI and the odds card follow the same rule. `air-battle` stream: one d20.
- The battle report shows one die, the modifiers of both sides in one ledger, and the table's result, as the d20 battle card does.

### N7, N8 Computer player (`ai`)
Facts (from the code and the odds table, `battleOdds` arithmetic, no sims):
- `worthOf` counts defence as much as attack, ignores upkeep, and treats a roll point linearly. Security forces (2-6, 4 Funds, 1 turn) so rank above infantry, though they add no chance to take ground in most fights. Odds columns are steps (the attacker must double to move a column, +3 to the roll each): at 12 v 12 two infantry add 0 to the chance of taking it, two guns +10 points, one bomber +15. Chance of taking it that one more unit adds, in points: a bomber on Ground Support 15 (7 Funds), a gun about 5 (6 Funds), infantry or security 0, or 15 when it happens to cross a column (5 and 4 Funds). So guns and aircraft do make sense; the AI undervalues them, and `attacks.ts` scores attacks without own generals or Ground Support.
- Price ignores upkeep; Manpower is abundant for the Republic (+27 against 12.75) and North (+27 against 5), and absent for the South (0 against 2.25). The owner is choosing the farm yield; don't change it.
- `withRoutes` sends every idle truck with the largest army leaving, whatever it needs: the "1 militia and 4 trucks".
What to build, all from data (profile weights in the scenario), each with focused tests:
1. Trucks: go only with armies that march two or more steps by Motor, and only as many as that army's foot needs. Buy trucks only for armies that will use them: one for every two foot that a Motor road serves and nothing carries yet.
2. Recruit worth: the marginal gain in the battles the site would fight (take chance, ground and losses from `battleOdds` against the stacks it would face, as attacker and as defender) per price, where price counts upkeep over a horizon in the profile and each resource by how scarce it is (the balance and its net income). Defence counts where the site is threatened, attack where it can strike. Keep it one function with a clear test for each unit kind; guns and aircraft where they pay, and security only where a quick defender is the best buy.
3. Attacks: `bestAttackOn` counts own generals that stand with the force and the Ground Support the faction's free aircraft in range could fly (weighed by the air battle), so it attacks when supported and masses guns with foot.
4. Tests that pin the new behaviour on fixed boards: the opening boards don't buy security over infantry where the Republic is attacking; a lone militia never takes four trucks; guns are bought in a Barracks and Factory site facing a city stack; aircraft raise an attack's score.

## Second pass (owner's answers, 2026-11-24)

The answers are in `milestone-3-rev-4-ideation/owner-answers.md` and override anything above. Implementation budget for this pass: under 1M tokens. The sims have their own: under 1M. No balance tuning: numbers come from the owner after the sim report. **AI-against-AI games are allowed only where a stream says so.**

Streams (same worker rules; branches `m3r4-<stream>`):

| Stream | Cap | Owns |
|---|---|---|
| `air-2` | 180k | the air battle rule, its report, estimate, ledger row, AI threshold |
| `recruit-2` | 150k | the Recruit pane's look |
| `sim-record` | 150k | `src/sim/`: what each game records, and how long it takes |
| `ai-2` | 150k | after `air-2`: the attack backing, air pairs, the scarcity price |

### P1 The air battle (`air-2`)
The owner: "both sides can't have ground support, its either Defence gets it, no one gets it, or attacker gets it. And then the gradient is did any side lose any planes. If the defender is getting a bonus, then the attacker's planes have been defeated and vice versa. But we may also have no ground support and every plane returned home."
- Five rows, the same score and breakpoints (3, 8, 12, 17, 20). Each row gives Ground Support to one side or to nobody, whole, and says how many aircraft each side loses:
  - up to 3 "Defender commands the air": the defender's Ground Support; the attacker loses one aircraft.
  - up to 8 "Defender holds the edge": the defender's Ground Support; the attacker's planes are driven off, none lost.
  - up to 12 "Contested sky": nobody's; every plane returns home.
  - up to 17 "Attacker holds the edge": the attacker's; the defender's planes are driven off, none lost.
  - 20 "Attacker commands the air": the attacker's; the defender loses one aircraft.
- Data: `air.battleTable` rows carry `support` ("attacker", "defender" or "none") and `aircraftLost` per side (a whole number), no shares. An aircraft lost is the side's aircraft over the battle with the lowest air roll, then the highest support roll, then id order (so the weakest in the air goes first); it leaves the board as a raid's "raiders are lost" does, with the same outcome, casualties bookkeeping, refund rules and report. If a side has none over the battle (only anti-air), it loses none. A side with only anti-air or a lone Patrol and no Ground Support still wins or loses the air as the score says.
- The loser's Ground Support never counts; the winner's counts in full, at most `supportMax` aircraft, as before. Remove the shares from the schema, engine, estimate, report and AI.
- Estimate: the chance a side's support applies, and the chance it loses an aircraft, exactly over the table. Ledger row: the average to tenths, marked "average; air battle first", with the five results folded out: each result's chance, the support it gives, and "you lose one aircraft" where it does. The Invade card states the chance to lose an aircraft.
- AI: `supportShare` becomes the least chance that its support applies (data). Start at 0.35, so it flies against an even opponent; it isn't tuned. Also test the best combination of free aircraft up to the cap, not one at a time (known gap).
- The battle report shows who got Ground Support, who was driven off and who was lost.

### P2 The Recruit pane (`recruit-2`)
The owner on the fixed slots (which he chose as the layout): "I actually don't love this, can we leverage design language from other parts of our app for this?" Keep what works: nothing moves when units are added, the same order of information, and every accessibility feature. Change the look to the app's own language: read the Build pane (`screens/pane/build/`, the Build list rows), the Invade pane (odds card, `muster-card`, `muster-box`), the roll ledger, the resource chips and `ThisTurnView`, then compose the Recruit pane from those. In particular: the order slots become a ledger-style card with one fixed line for each order the territory has, filled or "Empty", the unit, what it costs and a Cancel, and the totals as its last line (like `RollLedger`), so it reads like the odds card; unit cards are laid out as Build rows are. Show Recruit and Build side by side in your images, so the owner can see they belong together. Show desktop and phone.

### P3 What each simulated game records (`sim-record`)
For the owner's economy tuning. Today `games.jsonl` has outcomes only.
- For every game and every turn, for every side: Funds and Manpower held, income and upkeep; units on the map by type, units in training by type (and ordered this turn), buildings and development levels on the map by kind, builds under way and queued by project, and territories held. In `games.jsonl` behind a flag (`--record inventory`), so default runs are unchanged. Compact (arrays per turn, no repeated keys where avoidable), deterministic, same key order.
- How long games take: turns, as now, and wall-clock milliseconds per game in a separate file (`timings.jsonl`), never in the deterministic lines. Report total run time too.
- A summary step that turns a run into the tables the report needs: per side and turn means of each count, totals per game, final inventories, win shares, lengths, freezes, early wins, wall-clock. Tests for both.
- Run only small runs (up to 10 games) to check it. The 200-game run is the coordinator's.

### P4 The computer player (`ai-2`, after `air-2`)
- Attack backing: the commits are on `m3r4-ai-backing` (5df177d, 10a1ed4). The early-win check failed, and the likely cause is that `Assessment.danger` ignores enemy Ground Support and generals. Bring the backing back and count enemy backing in `danger` the same way (the same functions, for the enemy's free aircraft and generals in reach). Then run the unit suite's smoke test **once**. If S1 fails, leave the backing out (the branch keeps it) and say so. Don't tune.
- The scarcity price falls as a turn's orders pile up (`recruitSupply` is computed once per call today).
- Recompute the "before and after" table in the progress file from single planner calls.
