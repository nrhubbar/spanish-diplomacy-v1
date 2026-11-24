# Casualties (note 9): data side

Research only. `E` = `src/main/engine`.

## Field list (for mockups)
- Headline: **Casualties: N men** (all sides, whole game). Tooltip or menu: one line per faction, `men` and `units lost`.
- Optional second figure: "this turn".

## What the engine records today
| Event | Men recorded? | Where |
|---|---|---|
| Battle losses, every unit | yes: `losses: {unitId, men, destroyed}` | `E/types/outcomes/battle.ts`, `E/d20/grades.ts` |
| Destroyed or broken up (<10% left) | yes, counts **all** remaining men | `E/d20/grades.ts` `applyGradeSide` |
| Surrendered (no retreat) | **no men**, only `surrenderedUnitIds` | `phases/result.ts` `withDepartures` |
| Path surrender (withdrawal cut off) | no, unit id only | `E/partition/steps.ts:293` |
| Disbanded for an impossible move | no, unit id only | `phases/result.ts` `disbanded-move` |
| Frostbite | yes (`men`) | `E/modules/weather.ts:55` |
| Raids | none: they cut income, hit buildings or shoot down the raider | `air.raidTable` in the scenario |
| Aircraft lost | unit only | `E/generals/changes.ts:138` |
| Demoralized | no losses | - |

Desertion, raids and air cost no men today. The simulation harness already defines per-faction losses (`src/sim/game.ts:19` `FactionLosses`: men drop of units still on the board plus the men of units that left). It **nets** the drop against reinforcement, so Replenish can hide losses; a battle counter should count losses gross, from the events.

## Where it can live
- `GameState` (`E/types/state.ts`) holds **no** history; only `session.history` (`src/main/state/session.ts:41`) keeps every turn's outcomes, already filtered per viewer. Nothing is persisted to browser storage (no localStorage or save code found in `src/main/state`), so a total survives a turn but not a reload, like the rest of the game.
- A selector over `session.history` can give the total today (battle losses + frostbite), but surrenders and disbands lack men, so it would undercount.

## Visibility
Battles are public to every viewer (`visibility.ts`, `case "battle"`), so a total from battles leaks nothing. Frostbite, surrenders and disbands are in the same public list. Enemy *training and reinforcements* are hidden, so do not use army-strength totals.

## What "a man" is
Unit strength and `fullStrength` are counts of men (46 starting units, 71,527 men in total). Manpower in the treasury is in thousands (`resources.manpower.display.unit = 1000`). Show men ("12,400"), never Manpower points. There is no killed/wounded split in the engine: the number is *men lost to the army*.

## Proposal
1. **Definition:** "casualties" = men lost: killed, wounded and missing together. Counts battles, broken-up units, surrenders, disbands and frostbite; **not** Replenish or recruitment. Not "men currently missing": it never goes down.
2. **Show:** one total in the header, per-faction on hover/tap (all public).
3. **State:** a small pure accumulator on `GameState`, `casualties: Record<FactionId, {men, units}>`, updated once at end of turn from the outcomes (so it is deterministic and works with hot-seat and replays). Add `men` to the surrender, path-surrender and disband outcomes (available from `start.units` by id).
4. **Cost (estimate):** engine about 60 lines plus the header chip about 30; tests about 6 (battle, break-up, surrender, frostbite, zero, two factions). Old saves do not exist.
5. **Constraint:** counters in the header sit next to `TurnNav`; width must hold 6-digit numbers.

Open point: include units that surrender? Default **yes**, as "missing" men leave the game.
