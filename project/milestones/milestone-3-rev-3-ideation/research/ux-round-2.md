# Rev 3 UX, round 2

Mocks over the running app (seed 42). Scripts: `ux-pass/round2/`.

## Collisions
- **Upkeep is fractional; resources are whole** (`resourcesSchema`). 0.25 is rejected (question 3). The app prints Manpower with "k", so mocks read "1k Manpower to raise, 0.25k a turn".
- **Aircraft cards would print 1-1, not 0-1.** `armyFigures` raises values to at least 1 (General Miaja shows "1-1" with 0-0 struck through today).
- **No player Disband order exists.** It needs an AI path and test.
- **Answers disagree.** Table: militia defence 5, security 5 Funds. Q-R3-6d says 4; 6e says 4 Funds and 1,000 men. I drew the table (you weighted it more); men stay as today.
- **The clamped fight uses Popular Resistance** (turn 4 Extremadura, -2 kept to 0), which Q-R3-11 removes; without it the score is +1. Barricades are drawn at today's 1, not your 2.

## 1. Air cards (`r3b-2-air-cards`)
Same 32x24, 54x39, 58x56 cards. At overview all print "0-1", like an anti-air battery; the variant adds a letter badge, and FTR, BOMB or RCN in the name slot when zoomed (9.5 px text, small symbol, BOMB is tight). Grounded and selected not redrawn. **Code:** `AirLayer`, `placement`, `armyFigures`.

## 2. Recruit (`r3b-4-recruit-foldout`)
Fold-outs replace chips, closed by default; upkeep on every row. Sideways overflow 0 at 416 and 320 px. Closed rows 80 to 108 px; open artillery 194. **Code:** `RecruitTab`; texts built from effects; upkeep and tank `transport` in the data.

## 3. Battle ledger (`r3b-5-battle-ledger`, `r3b-5-who-fought`)
Only `p.battle-score` changes. Signs are the roll's, so green helps the attacker and a defender sees their own bonuses red. "Who fought" needs men and morale recorded per unit; my numbers come from start-of-turn state and matched the recorded value for all five units drawn. **Code:** `BattleGradedRoll`, `termName`, `BattleArmy`.

## 4. Invade (`r3b-8-invade`, `-phone`, `-order-button`)
All scrolls: odds card with the ledger, your units, Ground Support, then defenders in your unit card. **Known before the fight:** works (they grow at turn end), faction modifiers, barricades, generals and traits, unit bonuses, fatigue, weather (rolled before planning), fortifications, odds steps. The estimate already holds them; the pane shows only the pass, which becomes a row. **Not known:** the die, anyone's moves, air missions. Pass and amphibious are guessed from a March, not the ticked mode. Ground Support is +6 here because nothing contests the air; the contested case isn't drawn.

Cards visible (full; over half), yours 12, defenders 12, 61 px each, 10 units and 2 aircraft ticked (round 1: 10 units):

| | Top | After 500 px | Odds card |
|---|---|---|---|
| Today (round 1) | 0; 0 | 0; 0 | 419 px |
| Desktop, (a) after units | 2; 3 | 6; 6 | 298 |
| Desktop, (b) header | 2; 2 | 6; 6 | 298 |
| Desktop, (c) odds card | 2; 2 | 6; 7 | 343 |
| 320 px pane, (b) | 0; 1 | 4; 5 | 331 |
| Pixel 7 at 86%, (b) | 0; 1 | 5; 5 | 296 |
| Pixel 7 at 46%, (b) | 0; 0 | 2; 2 | 296 |

Defenders appear only near the end (8 of 12 at the bottom).

**Recommend (b).** Only it stays on screen after ticking the last card: (a) is 12 cards down, (c) scrolls away. It sits in the pane's fixed header, so it covers no card. Costs: 15 px; the label omits the aircraft (the accessible name has both); a second row at 320 px; on phones it takes End Turn's place. The phone's 86% sheet hides most of the map and its highlights.

**Highlight** uses `.unit-counter[data-selected="true"]`. Groups have no selected state (the single-region view expands one territory), so I added a glow and "4 of 5" badge (question 5). Ticks live in `MusterView` and must move to the store. **Code:** `MusterView`, `MusterBoxes`, `invadeOdds`, `mapView`, `GroupCounter`, `MapPane`, `_actions.scss`.

## 5. Casualties (`r3b-9-casualties`)
Skull and crossbones on the 16-unit grid. 37k is real: 36,993 men in seed 42's 19 recorded battles to turn 7, battles only; the rest isn't kept yet. Header height unchanged, no sideways scroll. **Code:** `GameHeader`, an accumulator.

## 6. Upkeep (`r3b-6-upkeep-ui`, `-disband`)
Republic, turn 3: 24 units, 15.65k, net +7.35k on 23k income. The Republic is never near short on turns 2 to 6 (South not checked), so the warning uses lowered stock and income. **Code:** `ledger.ts`, `ResourceChips`, unit cards, the new order.

## 7. Build (`r3b-7-build-row`)
Mines, turn 1: 1 + 2 + 5 - 2 = turn 6; on turn 3 the same row says 8. **Code:** `projectTerms`, costs.

## Questions
1. **Role on aircraft cards?** (A) letter at overview, word when zoomed (recommended); (B) only zoomed; (C) none.
2. **Order button?** (a) after units; (b) header (recommended); (c) odds card.
3. **Fractional upkeep?** (A) fractions in data, each side's total rounded once a turn (recommended); (B) fractional stock; (C) whole numbers per unit.
4. **Disbanded men?** (A) gone, no Manpower back, not casualties (recommended); (B) return as Manpower; (C) gone, counted (9a lists "disbanded units").
5. **Ticked units in a group?** (A) glow and "4 of 5" (recommended); (B) expand every ticked territory; (C) glow only.

## Not verified
Screen readers, keyboard, touch, 200% text, Recruit on phone, crowded fronts, whether raids damage fortifications or fatigue changes mid-turn.
