# ai (M3 Rev 4): N7, N8

**The attack backing (5df177d, 10a1ed4) is reverted here and kept on the branch `m3r4-ai-backing`:** with it the smoke test's S1 fails (2 of 10 games won before turn 4, limit 5 percent). See "Open" below.

## What changed
- Trucks (`orders/move.ts` `withRoutes`): idle trucks, then tanks, go only with an army on a land march of two or more territories that can't make it without them, and only as many as its foot needs. No truck goes with a step, a ride or a landing.
- Truck buying (`orders/recruit.ts` `uncarriedFoot`): one a turn, at a site with a Motor road whose uncarried foot would fill it. The `transportRatio` constant is gone.
- Recruit worth (`unitWorth.ts`): what one more unit changes in the site's battles (ground, losses) per price. The odds are smoothed between the table's steps (`smoothOdds`), since a literal margin is 0 for almost every unit. Price counts six turns of upkeep, each resource as a share of six turns' net supply. Quick units come first only where a rival near victory would likely take the site; the old hard rule (wherever it could be met) bought most of the security forces in close games.
- Attacks (`backing.ts`, `attacks.ts`, `offensive.ts`; reverted, on `m3r4-ai-backing`): own generals who would go, and free aircraft in range, judged on the whole board. Each is counted for one attack only.
- `planningView.ts`: `movePlanningView`, moved from `computerPlayer.ts` and remembered per state.
- New profile numbers (`ai.profiles.*.recruits`), starting values, not tuned: `upkeepHorizon` 6, `delayDrag` 0.15, `fightersPerSupport` 3 (was 4, in code), `quickTakeChance` 0.35.

## Recruits before and after (one planner call each, no games)
"rich" is 200 Funds, 60 Manpower; "mid" is a fixed board, 60 and 30.

| Board | Before | After |
|---|---|---|
| Opening, Republic | 1 truck, 3 guns, 1 security | 1 truck, 5 infantry |
| Opening, North | 1 truck, 1 gun | 1 truck, 1 infantry |
| Opening, South | none | none |
| Opening rich, Republic | 1 truck, 5 guns, 1 bomber, 2 tanks, 10 security | 1 truck, 7 infantry, 6 guns, 1 bomber, 3 tanks |
| Mid, Republic | 1 truck, 14 security | 1 truck, 2 infantry, 2 guns, 1 bomber, 2 tanks, 3 security |
| Mid, North | 1 truck, 3 guns, 1 bomber, 3 security | 1 truck, 4 guns, 1 bomber, 1 tank |
| Mid rich, Republic | 1 truck, 15 security | 1 truck, 3 infantry, 4 guns, 1 bomber, 2 tanks, 4 security |

Worth per price at 12 against 12, the Republic's opening supply: fighter 33, bomber 29, gun 19.6, tank 19.0, colonial veterans 18.7, infantry 17.6, cavalry 13.0, security 8.4, militia 5.5.

## Open
- **S1.** The smoke plan (10 seeds) on this branch: the Republic wins 7, North 3, two wins on turn 3. I ran it twice more with parts switched off in the source: no generals and no aircraft in attack scores, S1 passes (Republic 3, North 4, South 3, shortest 6 turns); generals only, one win on turn 3. So the cause is counting backing in attacks, not trucks or recruits. The Republic opens with the aircraft, and nothing in `Assessment.danger` counts enemy Ground Support, so its rivals don't garrison against it. Not loosened and not tuned: tuning needs games. Choices: count enemy backing in `danger`; weigh backing by a profile share; or leave it out (revert the two backing commits).
- `air-mission.ts` flies over the biggest attack and only at an even chance or better of winning the air, so an attack can count support that doesn't fly.
- A recruit's Ground Support is not weighed by the defenders' anti-air (an attack's is).
- Trucks left without an army stay where they are.

## Checks
Planning takes 18.1 ms a submission against 16.5 before (best of 8). Full unit run: 1763 of 1768 pass. S1 is the only assertion; `app`, `briefing` and `state` timed out at 15 s, alone as well, with the machine at load 27 to 32, so whether load is the whole cause is not shown. Coverage was not read.
