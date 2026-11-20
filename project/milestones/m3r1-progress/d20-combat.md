# `m3r1-d20-combat` progress

Mode: make it work (declog D13). Branch `m3r1-d20-combat`, merged with `milestone-3-rev-1` at `eb9515f` (contract CP4).

## What works

- **Engine** (`src/main/engine/d20/`): the `d20-graded` dice module's parts of steps 4, 5, 7 and 9, wired in `engine/modules/dice.ts`.
  - `rules.ts`: lookups (raised units included), d20 values.
  - `odds.ts`: columns, the x3 odds steps, score, grade lookup, the column's bands, grade chances, `takeChance` and `gainChance`, expected losses for the computer player.
  - `modifiers.ts`: works, d20 faction modifiers, barricades, best general and his trait, unit bonuses (artillery, tanks, weather exceptions), Fatigued, and the `combatModifiers` hooks.
  - `grades.ts`: a grade's losses, weakest-destroyed, break-up below 10 percent, demoralization none, half or all.
  - `battle.ts`, `front.ts`, `meeting.ts`, `standing.ts`: graded meetings, territory battles (ground all, partial ground, stalemate), M19 and M27 with C3, artillery that cannot attack alone.
  - `morale.ts`: fatigue, rest only in uncontested ground, digging in at the d20 rates.
  - `estimate.ts`: `estimateAttack` on the d20 (C15).
- **Data**: Spain selects `dice: d20-graded` (its existing `d20` block, unchanged). Tiny-front stays on `m2-strength`.
- **UI**:
  - Battle cards for d20 battles: the die as a d20 badge, every modifier and the score in one line, then the column as bands with score range, grade and effect, the hit band outlined (`screens/report/BattleGradedRoll.tsx`, `styles/_d20.scss`).
  - Card titles, headlines and map medallions use the grade name; each grade is drawn with the nearest d6 result's art (`presentation/grades.ts`).
  - Hovering a battle medallion on the map shows the result's name (SVG `<title>`).
  - Unit lines show "Fatigue n" with a three-pip icon, next to Demoralized.
  - Fatigue report lines; the Briefing's battle basics and example on the d20.
  - Capture `20a-d20-battle-card`.
- **Computer player**: plans with d20 odds (estimate, threat checks, relief), weighs partial ground at half the prize, never sends artillery alone, and charges a unit that this attack would exhaust its whole attack value (H5).
- **Tests**: `src/test/d20Combat.test.ts` (21 tests, on the modular tiny-front fixture with an invented catalogue).

## Decisions

- DC-1. The d20 lives in `engine/d20/`, with its own meetings, front, standing and morale parts. The d6 code is untouched except for the shared seams listed below.
- DC-2. `PendingBattle.battle` is a d6 `FoughtBattle` or a d20 `GradedBattle`; `phases/result.ts` builds the matching outcome.
- DC-3. Above 6:1 the d20 roll gains `belowOneToOnePenalty` per step, the same x3 as the halvings, so the schema needed no new field.
- DC-4. Values: a type with value 0 counts 0 on the d20, not 1; a side of 0 fights as 1 for the odds. General units count 0.
- DC-5. Generals lose no men and are never demoralized by a grade; whether one dies is the generals module's roll.
- DC-6. Losses are a share of each unit's men now, rounded to the nearest man. Demoralization "half" uses the side's value as fought, as M16 does.
- DC-7. Several attackers on one territory (M17): one snapshot of values, but the defenders' losses add up battle by battle.
- DC-8. A claim needs a ground-all grade, or no fighting defender left (break-up can empty a territory on a low grade).
- DC-9. Partial ground moves the attackers into the territory beside the defenders only in a territory with more than one sub-territory and a partition module other than `none`. Otherwise it is a stalemate (Q-D20-7). In an entry battle (M19) partial ground is always a stalemate.
- DC-10. `D20BattleOutcome.ground` is the ground actually taken: `all` for the occupant, 1 or 2 for attackers that came in, 0 otherwise. `m3r1-sub-territories` reads it to flip sub-territories.
- DC-11. No standing battle where a territory battle was fought this turn: that assault was the turn's battle (C2).
- DC-12. Meetings: ground all, the attacker continues; ground 0 with no defender losses, the defender continues; else both bounce. Meetings take only the armies' own modifiers, no hooks.
- DC-13. Artillery alone (D5): a side made only of `cannot-attack-alone` units does not fight; its move bounces as a standoff. Generals and value-0 units do not count as company.
- DC-14. C3: with three or more factions, the defender is the capital sub-territory's holder, else the territory's last controller; with two, M27 and M19 are unchanged.
- DC-15. Fatigue: +1 for each unit on the attacking side of any battle this turn (meetings, assaults, standing). A quiet turn means no move order, no retreat, no attack, and uncontested ground at the end of the turn; it resets fatigue and lets a demoralized unit recover (M23). Contested means control says so, armies of several factions share it, or its sub-territories have several holders.
- DC-16. The best general per side is the greatest command bonus plus his trait's roll for the side's role. I emit both `general` and `trait`; `m3r1-air-generals` should not add them through the hook.
- DC-17. Tests keep Spain on the d6 table: `support.ts` pins Spain to `d6-table` in `testRegistry()` and `spain()`, so the Milestone 2 rule and report tests keep testing the d6 (declog D3's intent). `spainD20()` and `shippedRegistry()` give Spain as shipped.
- DC-18. The art and legend reuse the seven d6 result keys; each grade maps to one by its catalogue entry, never its id (`gradeFamily`).
- DC-19. The odds chip's "chance to take" on the d20 is the chance of a ground-all grade.

## Stubbed or left

- Weather, amphibious and air-support modifiers come only through the `combatModifiers` hook; none is registered yet.
- Contested ground is my own helper (`contestedAtEnd`) until `m3r1-sub-territories` ships theirs.
- The `combat` block is still required under `m3-modular` (CT-3); I left the schema alone.
- Planning odds breakdown names unit bonuses "Supporting arms" where no scenario is passed.

## Needs from other streams

- **Needs from m3r1-sub-territories:** read `D20BattleOutcome.ground` (and the attackers' origins) to flip sub-territories (P4); a shared contested-territory helper to replace `contestedAtEnd`.
- **Needs from m3r1-air-generals:** do not emit `general` or `trait` modifiers (DC-16); bombers' support through `combatModifiers`; a general's death roll on destroyed or routed armies, read from the battle outcome; the rally in the air module's step-9 part, after mine.
- **Needs from m3r1-weather-timer:** the weather modifier through `combatModifiers`; `canDigIn` for Snow and Severe cold. Tanks read `systems.weather` (else the start's) for their exceptions.
- **Needs from m3r1-movement-rail-ports:** the amphibious modifier through `combatModifiers`.
- **Needs from m3r1-recruit-replenish:** Replenish clears demoralization in its own step-9 part; raised units go in `state.raised` (my lookups read it).

## Files outside my ownership that I touched

- `src/main/engine/battle.ts`: `PendingBattle.battle` widened (DC-2).
- `src/main/engine/phases/result.ts`: picks the d20 outcome builder.
- `src/main/engine/works.ts`: `digIn` takes optional rates.
- `src/main/engine/combat/estimate.ts`: `estimateAttack` dispatches to the d20; new `oddsForValues`.
- `src/main/ai/attacks.ts`, `src/main/ai/assessment.ts`: dice-agnostic odds, the fatigue cost.
- `src/main/presentation/{battle,battleText,odds,text,army,battleBasics}.ts`, `presentation/systemText/morale.ts`: both dice; my three modifier names; Fatigue labels.
- `src/main/screens/report/{BattleCard,BattleEngagement,BattleSides,BattleEffects}.tsx`, `screens/{ArmyLine,BattleBasics}.tsx`.
- `src/main/map/{routes.ts,RouteLayer.tsx,MapLegend.tsx,VectorLayer.tsx}`: d20 battles, hover titles.
- `src/main/style.scss`: one `@use` line.
- `src/scenarios/spanish-civil-war-1936/scenario.json`: `rules.dice`.
- `project/specs/scenario-package.md`: the D20 rules section.
- Tests: `support.ts` (DC-17), `pipeline.test.ts` (dice no longer a skeleton), `orders.test.ts`, `combat.test.ts`, `engineBattles.test.ts`, `combatPresentation.test.ts` (type narrowing).
- `e2e/capture.spec.ts`: the `20a` capture.

## Checks

See the hand-off report for the latest run.
