# ai (M3 Rev 3)

- `ai/alarm.ts`: steps short of victory, the alarm, the rivals spent against. `Assessment` gained `risk`, `spoils` and `strikesThreat`; `isCritical` is still own ground only (it drives the pin, the garrison and the last stand), so gaps 2 to 4 raise stakes and never pin.
- The pin lifts for attacks on the leader, but one plan opens at most one critical territory: a foothold takes one territory off the leader's count. Without that limit the North opened four at 1:3.
- `ai/unitWorth.ts`: a roll point is worth a share of an odds column, read from the d20 table (a third in Spain); a column costs the strongest stack in the profile's offensive reach, or the own attack near the site if that is less. Bonuses diminish by the units of the type near the site, in training and ordered included.
- The support and transport ratios count units that fight, and units in training. Support is now a limit, not a first choice.
- `starves` (`orders/spending.ts`): Recruit, Replenish and Build leave `recruits.upkeepTurns` turns of upkeep. The South so recruits nothing until Andalucia pays.
- `build.ts`: the development target tied with an Airfield (three unlocks, 12) at the same sub-territory and lost it by order. It now scores 25, over any unlock. The `factory` stream edits the same file.
- Tests: `aiLeader`, `aiSpending`. The old alarm is kept as the test's own numbers in `computerOffensive` ("attacks once the massed armies"); `aiVictoryDefence` now lets critical ground be emptied to strike the leader.
