# Battle balance sheet (note 5): field list and how a fight is computed

Research only. `E` = `src/main/engine`. "(unverified)" marks what I did not check in code.

## 1. Field list for the sheet (for mockups)

Header: site (territory or road), kind (assault, entry, standing, meeting), attacker, defender factions.

**Strengths** (one line per unit, then a total per side)
| Row | Source | Kept in the record? |
|---|---|---|
| Unit name, faction, came from | `BattleSide.armies[].unitId/factionId/from` | yes |
| Unit value | `armies[].value` | yes (final value only) |
| Printed attack/defence, men / full men, demoralized x0.5 | not stored | **no** (see section 4) |
| Attack strength, defence strength | `attacker.value`, `defender.value` | yes |

**Odds**: attack : defence, rounded odds label (`oddsLabel`), column (`column`, 0-6).
**Roll modifiers**: one row per `modifiers[]` entry with a sign, grouped Attacker / Defender / Both (`kind`, `roll`, plus `role`, `factionId`, `level`, `unitTypeId`, `points`, `weatherId`, `name`).
**Totals**: modifier total (sum of `modifiers[].roll`) -> die roll (`die`) -> raw score (die + total) -> final number (`score`, clamped to 0-20) -> result (`grade`, name from the scenario) -> effects: losses %, demoralized, ground (`ground`), men and units lost per side (`losses`), retreats, surrenders.
**Air battle** (only if one was fought): two d20s, each side's total with plane air rolls and anti-air, who won the air, support applied. From the `air-battle` outcome (`input`, `result`, `support`), joined to the battle by `battleIndex`.

Rows to show even when zero: "Odds", "Modifier total", "Die roll", "Final number", "Result". Hide zero modifier rows.

## 2. How one fight is computed (d20-graded, the shipped rules)

1. **Unit value** = printed attack (attacker) or defence (defender; entry battles use the defender's *attack* too) x men / full men, x 0.5 if demoralized, rounded once, at least 1; trucks and generals count 0 (`E/d20/rules.ts` `gradedValue`; `combat.demoralizationFactor` 0.5).
2. **Side total** = sum. Nothing else changes strength. No terrain, river or capital strength term exists.
3. **Odds** (`E/combat/odds.ts` `oddsFor`): if attack >= defence, `floor(attack/defence):1`; else `1:ceil(defence/attack)`. Both sides at least 1. Column = 0 if below 1:1, else min(ratio, 6). Rounding favours the defender.
4. **Modifiers** (`E/d20/modifiers.ts` `gradedModifiers`, then `E/d20/odds.ts` `gradedOddsModifiers`). Order: works, faction modifiers, barricades, generals and traits, unit bonuses, fatigue, then hooks (weather, amphibious, pass, air support, buildings), then odds steps.
5. **Die**: one d20, seeded stream per battle index.
6. **Score** = die + modifier total, clamped 0-20 (`scoreFor`).
7. **Grade** = `table[column][score]` (21 scores a column). The grade gives losses %, demoralized none/half/all, ground 0/1/2/all, "weakest destroyed".
8. **Losses** (`E/d20/grades.ts` `applyGradeSide`): weakest unit destroyed if broken; others lose `round(men x percent)`; below 10% of full strength a unit breaks up and **all** its remaining men count as lost; demoralized weakest-first.

## 3. Every modifier

| Modifier | Who | Value | Changes | Where | Recorded as |
|---|---|---|---|---|---|
| Dug in (works level) | defender, assaults only | -2 a pip, max -6 | roll | `d20/modifiers.ts:57`, `works.ts` `worksRoll` | `dug-in` |
| Popular Resistance | Republic defender holding a city there | -3 | roll | `d20/modifiers.ts:60` | `faction` |
| Barricades | any defender holding a city there | -1 | roll | `d20/modifiers.ts:69` | `barricades` |
| General (best one a side) | attacker / defender | +1 / -1 | roll | `d20/modifiers.ts:112`, `generals/command.ts` | `general` |
| General's trait | same side | aggressive +1 attack, tenacious -1 to attacker when defending, cautious -1 attack | roll | same | `trait` |
| Artillery bonus | attacker | +1 per 3 points, max +3 | roll | `d20/modifiers.ts:121` | `unit-bonus` |
| Tank bonus | attacker | +1 per 3 points, max +2; none in mud or snow | roll | same | `unit-bonus` |
| Fatigue | side with half its value fatigued | attacker -2, defender +2 to the attacker | roll | `d20/modifiers.ts:139` | `fatigue` |
| Weather | battle zone | mud -3, snow -3, severe cold -6, else 0 | roll | `modules/weather.ts:61` | `weather` |
| Amphibious | attackers landing from the sea | -4 | roll | `movement/hooks.ts` `amphibiousModifiers` | `amphibious` |
| Pass | every attacker came over a mountain pass | -2 (cancelled by any flanking attacker) | roll | `movement/hooks.ts` `passModifiers` | `pass` |
| Ground Support | winner of the air (or unopposed) | +3 a plane, max two planes | roll | `air/hooks.ts`, `air/groundSupport.ts` | `air-support` |
| Fortifications | strongest in a held sub-territory | -1 | roll | `economy/effects.ts` | `building` |
| Odds above 6:1 | attacker | +3 a step | roll | `d20/odds.ts` | `odds-overflow` |
| Odds below 1:1 | attacker | -3 a halving (1:2-1:3 = one) | roll, not strength | `d20/odds.ts` | `odds-halving` |
| Demoralized | unit | x0.5 of its value | strength | `d20/rules.ts` | **not recorded** |
| Under-strength | unit | x men / full men | strength | `d20/rules.ts` | **not recorded** |
| Minimum 1 | unit | raises tiny units | strength | `d20/rules.ts` | **not recorded** |
| Score clamp 0-20 | battle | - | roll | `d20/odds.ts` | derivable: `rawScore` (`presentation/grades.ts`) |
| Air battle | both sides | d20 + fighter 2 / bomber 1 per plane, +3 AA defender | decides who gets support | `air/airBattle.ts` | `air-battle` outcome (separate) |

Works are -2 a pip on the shipped d20. On the d6 fixture they are -1 a pip (`worksRoll` returns the level), so a sheet test must use the shipped scenario, not `spain()`.

## 4. Where the sheet would mislead
- **Unit strength inputs are not stored.** Only `value` survives; printed strength, men, demoralized and the minimum are lost, and by report time the unit has changed. To list them, add optional fields to `BattleArmy` (`base`, `men`, `fullMen`, `demoralized`): small, engine-only.
- **The battle record has no index and no `rollModifier`.** The total is derivable; the join to the air battle relies on list order (unverified how the report does it).
- **Names are vague.** `modifierName` (`presentation/odds.ts:126`) says "General" without naming him (so two generals look alike), "Bomber support" even for fighters, and "Fortifications" for any defending building. `generalId`, `unitIds` and `buildingId` are recorded, so better names are free.
- **Defender bonuses read double.** `modifierName` prints "Dug in level 2 (+4)" while the roll column shows -4. The sheet should show one sign convention (attacker's view).
- The old `TODO` comments in `odds.ts:139-143` describe kinds that now have labels; delete them (pruning list).

## 5. Three-sided and special battles
- **Several attackers, one defender**: one sheet per attacker. Each attacker meets the defenders' *starting* strength; defender losses then add up. Occupant = the attacker with most attack left; a tie, nobody. 
- **Entry battle** (several factions into empty ground): the strongest entrant stands as defender and counts its *attack* value; no works.
- **Standing battle** (already sharing ground): no works; ties for attacker or defender settled by a recorded roll (`tieBreaks`).
- **Meeting on the road**: only generals, unit bonuses, fatigue and the attackers' destination weather. No works, city, pass, sea, building or air rows.
- Fortifications, and pass/amphibious if the units arrived this turn, can still apply in a standing battle (read from code, not tested).

## 6. Worked example (real engine call, scratch script, not committed)
Two North infantry regiments (700 men each, value 4 each) and an artillery group (400 men, value 3) attack Madrid in mud. Defenders: Wad-Ras Infantry at half strength (275 of 550, value 3) and Covadonga at full strength but demoralized (6 x 0.5 = 3). Works level 2 for the Republic.

| Row | Value |
|---|---|
| Attack strength | 4 + 4 + 3 = 11 |
| Defence strength | 3 + 3 = 6 |
| Odds column | 11:6 -> 1:1, column 1 |
| Dug in (2 pips) | -4 |
| Popular Resistance | -3 |
| Barricades | -1 |
| Artillery (3 points) | +1 |
| Mud | -3 |
| **Modifier total** | **-10** |
| Die roll | 18 |
| **Final number** | 18 - 10 = **8** (no clamp) |
| **Result** | **Stalemate**: both sides -10% (North 70+70+40 = 180, Republic 28+55 = 83), no ground |

Without Popular Resistance the same die reads 11, "Defender gives ground" (column 1: 8-10 stalemate, 11-13 gives ground); this is arithmetic on the example, not a second run. Build sheet tests on the real scenario: the test helper `spain()` pins the board to the d6 dice, where works and weather come out smaller (-2 and -1 here) and the same call scores 12.
