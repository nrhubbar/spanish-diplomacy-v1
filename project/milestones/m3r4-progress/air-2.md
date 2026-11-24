# air-2: P1, the air battle (overrides N11 in air.md)

## The rule
- `air.battleTable` rows: `name`, `upTo`, `support` (`attacker`, `defender`, `none`) and `aircraftLost` per side. The shares are gone from schema, engine, estimate, report and AI. Same score and breakpoints.
- `engine/air/airBattle.ts`: `aircraftLost` picks the lowest air roll, then the highest support roll, then id, from Patrol and Ground Support alike; a side with none over the battle loses none. `groundSupport` gives the row's winner all of its support (at most `supportMax`), from the aircraft it still has (a scenario may cost the winner aircraft too), and both sides theirs when no air battle is fought.
- `FoughtBattle.air` (`d20/battle.ts`) records the air over each territory battle once, with the hook's own input and die. The report (step 9) reads it instead of recomputing (`airOverFoughtBattles` is gone).
- Gone in the same turn: several factions may attack one territory, each with its own air battle. `settleSite` (`d20/front.ts`) takes lost aircraft out of the flights before the next battle there (`flightsAfter`). Standing battles are one per territory and a mission names one territory, so nothing else can fly twice. Step 9 leaves the lost out of the aircraft that come back.
- Books, as a lost raider: no men, so no casualties; no refund; no upkeep from that turn on; no `aircraft-lost` or `aircraft-rebased` event. `AirBattleOutcome.aircraftLost` names them (the raid's field name).
- Driven-off aircraft are over a later air battle in the same territory that turn, as before; only lost ones are not.

## Estimate, ledger, card
- `PlannedAir`: `average`, `supportChance`, `lossChance` (exact, added up in faces of the d20) and `results` (chance, name, support, roll, aircraftLost). `share` is gone.
- The ledger always folds out all five results when an air battle would be fought. `InvadeOdds.airLoss`: "20% chance to lose an aircraft in the air battle.", absent at 0. The planner knows only the defenders' anti-air, as before.

## AI
- `ai.profiles.*.air.supportShare` is renamed `supportChance`, 0.35 in both scenarios. Against anti-air of 3: bomber 0.3 (alone, no), fighter 0.35 (yes), both 0.4 (yes).
- `planSupport`: biggest attack first; of the combinations of free aircraft (how many of each type, up to the cap) whose chance is enough, the one with the greatest average; ties by id. The rest then raid, patrol or recon. `unitWorth.ts` and `airRecruits.ts` never read the share.

## Report
- Table rows, result sentences and the report line say whose Ground Support counts, whose aircraft are driven off or return home, and which were lost.

## Fixtures re-derived
- `airBattle`, `battleAir`, `m3r2Contract`, `rollLedger`, `mapOrdersLogic`, `aiActions`: half shares replaced by the rows above; the 60-seed turn test expects [6, 6, 0, 0, 0] and one loss in the first row. The "certain result" ledger case went with its shortcut, which would hide losses.

## Not done
- No browser check of a contested sky: no opening board has anti-air or enemy aircraft over an attack. Unit and component tests only.
