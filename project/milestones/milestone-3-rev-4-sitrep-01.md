# Milestone 3 Rev 4: sitrep 1 (2026-11-23)

Branch `m3r4` (tip `e8c5205` before this file), not pushed. `main` is `d1bfa81` (Rev 3, live; CI, deploy and production smoke test passed). The question page: https://claude.ai/artifact/FBFiz2nCczpmFuX4rPMWN1 (no answers yet).

## Built: all twelve notes, with defaults where a question is open
- 1 Disband is a unit order, several at once; a general in the selection stays. Button after the unit list, and a bottom sheet on phones.
- 2 Recruit pane rebuilt; nothing moves when an order is added (asserted in the browser at 1440, 412 and 320 px).
- 3 The stuck line was the Ground Support mission's line: cancelling the moves left the mission. Every cancel path now goes through one function. Map chip, This turn and the pane share one estimate and one way to give orders.
- 4 Generals can be ticked; their bonus and Ground Support are in the odds ledger.
- 5 Tenths everywhere. 6 Targets chosen on the map. 9 Sound only in Settings. 10 General words on hover and cards.
- 11 One die and one table for the air battle (`air.battleTable`).
- 12 Trains enforced while ticking; Select all.
- 7, 8 Trucks go only with Motor marches that need them, and are bought only for foot they would carry. Recruits are worth what they change in the battles near the site, upkeep and scarcity counted. Manpower numbers unchanged (questions R4-1, R4-2).

## Checks
- Container check at `d59f4a4`: 1,833 unit tests, 98.9 statements, 95.5 branches, 59 browser tests pass, 3 skipped, visual baselines unchanged. Result for the last commit (the target list folded away): see the report to the owner.
- Reviews: all five streams, nothing blocking; the real findings were fixed.

## Open
- **Attack backing held back.** Counting own generals and aircraft in the computer player's attack choices fails the early-win check (2 of 10 games before turn 4, limit 5 percent). The commits are on `m3r4-ai-backing`. Likely cause, untested: the danger estimate ignores enemy Ground Support. Needs games the owner has not approved.
- **Rule changed:** Rev 3 D6 preferred one-turn units wherever a side two steps from winning could be met. Now only where that side would likely take the site (`quickTakeChance` 0.35), since the old rule bought most of the security forces.
- **Process:** the `ai` worker ran the 10-game smoke plan four times, two of them with attack code altered. The other workers' runs were the unit suite, and one more alone by `invade`.
- Left: the AI's Ground Support planner tests aircraft one at a time (a lone bomber against anti-air stays home, a pair would fly); the scarcity price is not lowered as orders pile up in a turn; the global Recruit view has no slots; cards without special effects keep a blank line; both the footer bar and the new button offer the same orders on desktop.
- Not verified: phone by hand, screen readers, Safari, Firefox; `e2e:capture` not run; the averaged Ground Support row and the new battle card have no browser test.

# Sitrep 2 (2026-11-24): second pass and the 200 games

- Built: 0.6 Manpower a farm level; Castilla y León at 8 farm levels; the air battle gives Ground Support to one side or nobody, with one aircraft lost on the first and last rows; the Recruit pane in the Build pane's language; the harness records inventories and timings (`--record inventory`); the scarcity price falls as a turn's orders pile up.
- Container check at `bb18312`: 1,878 unit tests, 98.9 statements, 95.5 branches, 60 browser tests pass, 3 skipped, screenshots unchanged.
- **Attack backing tried again and reverted.** With enemy backing in `danger` too, the early-win check still failed (2 of 10). Kept on `m3r4-ai-2-backing`.
- **The 200 games** (seeds 1 to 200, `bb18312`, 66-turn limit): `milestone-3-rev-4-sims/` and https://claude.ai/artifact/E76Q1uwaM3BGvs3qmSBUUU. All decided; Republic 87, North 74, South 39 wins; median 15 turns, longest 52; **17 won before turn 4 (8.5 percent, limit 5), all Republic, missed by the 10-game smoke test**; median 1.5 s a game on a worker, 68.4 s in all on 9 workers. Nothing was tuned.
- Findings for tuning (from the run, no changes made): trucks are 23, 18 and 15 percent of the recruit orders of Republic, North and South; Funds are mostly spent (about 91 percent of what comes in) but each side holds 20 or more on 43 to 77 percent of its turns; the South's Manpower piles up (about 110k by turn 20); unpaid upkeep at least once in 64, 40 and 28 of 200 games.
