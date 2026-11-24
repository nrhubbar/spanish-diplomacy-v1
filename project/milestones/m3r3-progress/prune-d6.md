# prune-d6: progress

## Done
The d6 engine, the `m2-strength` ruleset, the `dice` rule area, `combat.table`, `combat.belowOneToOne` and `combat.factionModifiers` are gone. `d20` is required in the schema and in `Scenario`, so `requireD20` is gone too. The battle steps and morale are the engine's own part of steps 4, 5, 7 and 9 (`phases/pipeline.ts`), in the order they ran before. `d20.factionModifiers` and its data are unchanged; L13 (a modifier must change something) now checks them.

- Names: `BattleOutcome`, `BattleOdds`, `BattleEstimate`, `FightingSide`, `fightingSide`, `fightingValue`, `battleModifiers`, `battleOdds`, `battleOutcome`, `BattleRoll`. The folder stays `engine/d20/`.
- `combat` keeps `diggingIn` (works pips; the engine, counters and battle basics read it) and `demoralizationFactor`.
- `ruleset` stays as the literal `"m3-modular"`; `ScenarioDocument` is the one document type.
- Engine fix, in `ae50b69` (`d20/odds.ts`): faces are counted, then divided. Ten faces of twenty were 0.49999999999999994, so the computer player's 0.5 thresholds never fired at exactly one half.

## Tests removed or changed in meaning
- Removed with the d6: `combat` "results table", "outcome distribution", "adds odds above 6:1", "sums modifiers", "loads popular resistance", "keeps one list of results" (now "draws seven result families"); `grades` "tells d20 battles from d6" and its no-`d20` cases; `routePresentation` no-`d20` cases (one is now a roll of 0); `reportLines` and `consolidation` `general-moved`; `combatPresentation` `rawRow`; `spec` "L1 unknown result" and "unknown below-1:1 rule" (now a negative below-1:1 penalty).
- Re-pointed at the d20: `combat` situational modifiers and side values; `computerPlayer` `expectedLosses` (worked out from the 20 faces); `spec` L1 to L3 and L13 modifier and table cases; `specModular` L14 (an air module) and L1 (unknown ruleset); `pipeline` (a module registered twice).
- `airBattle` and `replenishTurn` ran twice for the two dice. `airBattle` runs once; `replenishTurn` runs on ground forces only and on every force.
- `battleFixtures` battles carry a grade, ground and score that agree with Spain's table.
- In `ae50b69`: hopeless withdrawals need more attackers (`aiGuard`, `aiVictoryDefence`); `partition` withdraw adds the Legion and Regulares, and its sweep has new dice; `computerOffensive` stall expects 0.35 in place of 1/6; `recruitment` drops Barbastro's garrison; `consolidation` and `engineTurn` three-faction cases start with nobody holding the ground (C3).

## Left
- Citation checks (L18, L28, unit sources) as an authoring check, and stripping `note`, `sources` and `historicalNote` from the shipped scenario.
- Row 6, unused exports (knip).

## Found, not changed
- A defender hit by two attackers in one turn is listed as demoralized in both battles (the d6 listed it once).
