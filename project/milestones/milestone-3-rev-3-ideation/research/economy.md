# Economy and the computer player near a rival's win (notes 6, 7, 10, 11, 12)

> Internal. Nothing here may be imported into or rendered by the player-facing application.

Marks: **[code]** read in source; **[engine]** the engine's pure functions on the opening state, no game played; **[data]** `scenario.json`; **[model]** arithmetic in `widgets.js`; **[sim]** an earlier run; **[web]** a page read; **[extract]** search extract only; **[judgement]**.

## Headline

1. **Funds are scarce and Manpower is almost free.** Militia costs 2 Funds and 3 Manpower; the Republic earns 14 and 27 a turn, so spam wins. **[engine]**
2. **Builds pay back too late.** A mine started on turn 1 breaks even on turn 10, Industry on turn 13. **[engine]** The owner's games end before that; sims ended at a median of 12 to 15. **[sim]**
3. **The South has no Manpower income.** Upkeep without an allowance bankrupts it in its first turn or two. **[engine, model]**
4. **Recommended:** each unit eats half its type's full size in Manpower each turn, the first 6 free; dearer, weaker-attacking militia; cheaper regulars; faster, cheaper builds (package "Moderate").
5. **Popular Resistance is worth 3 on the die, one whole odds column,** not the 1 in the old d6 block.

## The tenets

Targets are provisional. **The Moderate package was tuned against these tests, so a pass means it does what it was designed to do, not that the game is balanced.** Projections are 10 turns, no battles, contested ground paying its main holder from turn 3. **[model]**

| # | Tenet | Measured by | Today | Moderate | Bold |
|---|---|---|---|---|---|
| 1 | **A build started on turn 1 pays back by turn 7** | order turn + build turns + cost ÷ yield − 2 | **Fail**: Mines turn 10, Industry turn 13 | Pass: Mines turn 6, Industry turn 7 | Pass: Mines turn 6, Industry turn 7 |
| 2 | **A build started on turn 3 still profits in a 10-turn game** | payments by turn 10, less cost | **Fail**: Mines −2, Industry −5 | Pass: Mines +2, Industry +1 | Pass: Mines +2, Industry +1 |
| 3 | **An economy opening is behind at turn 5 and ahead by turn 10** (target: behind, then at least 2% ahead) | army value, half the Republic's opening Funds in builds against none | **Fail**: turn 5 −7%, turn 10 −2% | Pass: turn 5 −6%, turn 10 +4% | Pass: turn 5 −7%, turn 10 +2% |
| 4 | **No unit is strictly worse than another** | pairwise on price, upkeep, training, values, abilities, buildings | **Fail**: Security forces (worse than Infantry regiment) | Pass: none | Pass: none |
| 5 | **No foot unit leads on more than two of five measures** | best per Fund, per Manpower, by training | **Fail**: Militia column leads 3 (attack per Fund, defence per Fund, training speed) | Pass: Militia column leads 2 (defence per Fund, training speed) | Pass: Militia column leads 2 (defence per Fund, training speed) |
| 6 | **Militia alone adds less attack than regulars on the same income** (target: 95% or less) | attack added by turn 10, militia-only ÷ infantry-only | **Fail**: Republic 208%, North 252%, South 167% | Pass: Republic 24%, North 92%, South 38% | Pass: Republic 10%, North 63%, South 13% |
| 7 | **By turn 10 a full-size army eats at least 30% of its Manpower income** (target: 30% to 100%) | best mix's upkeep ÷ Manpower income | **Fail**: Republic 0%, North 0%, South 0% | Pass: Republic 87%, North 92%, South 35% | **Fail**: Republic 124%, North 64%, South 65% |
| 8 | **Nobody starts broke** (target: opening upkeep under 40% of Manpower income, no shortage in 4 idle turns) | opening army's upkeep ÷ income; 4 idle turns | Pass: no upkeep to pay | Pass: Republic 19%, North 0%, South 0% | Pass: Republic 37%, North 0%, South 0% |
| 9 | **A shortage costs men gradually and can be undone** (target: at most 10% of strength a turn, never below half) | the rule's cap and floor | Pass: no upkeep, so no shortage | Pass: cap 10% a turn, floor 50% | Pass: cap 10% a turn, floor 50% |
| 10 | **Manpower is scarce enough to plan around** (target: a regular army uses at least 40% of it) | infantry-only: Manpower spent ÷ received, 10 turns | **Fail**: Republic 12%, North 4%, South 11% | **Fail**: Republic 55%, North 10%, South 32% | **Fail**: Republic 93%, North 14%, South 48% |
| 11 | **Sides differ by armies and land, not by a permanent die bonus** | faction entries in `d20.factionModifiers` | **Fail**: Republic 3 (one odds column) | Pass: none | Pass: none |
| 12 | **The side one step from winning draws the fire** (target: valued at least x4, like own ground) | 1 + (steps − 1) × perStep against 1 + critical | **Fail**: x2.5 | Pass: x4 | Pass: x4 |

**Where they come from.**
- *Payback and tempo (1–3).* Schreiber: the right cost curve depends on the intended game length; costs and benefits should match numerically [S1, web]. Hearts of Iron players argue the same trade; a rule of thumb is three years for a civilian factory to repay itself [S2, extract, player opinion].
- *Unit prices (4–5).* Schreiber: when benefits don't match the price, the thing is undercosted or overcosted [S1].
- *Militia (6).* Axis & Allies had this exact problem: cheap infantry was the best buy. Revised curbed it by capping what an industrial complex can produce [S3, web]. Our recruit slots are that cap, but they never bind (below).
- *Upkeep (7, 9, 10).* Warcraft III cuts income in two steps as the army grows, to favour smaller armies and aggressive play [S4, web]. Another designer finds that hard cutoff frustrating and prefers Company of Heroes 2's gradual Manpower upkeep [S5, web].
- *Opening and shortage (8, 9).* Sirlin: a slippery slope, where falling behind makes you fall further behind, is usually bad [S6, web]. Upkeep must not become one: the bill shrinks as units do.
- *Equal dice and the leader (11, 12).* **[judgement]**: keep negative feedback on the board.

The `tenets` widget recomputes all twelve from `econ-data.json`; a Vitest file could assert the ones adopted.

## 1. How it works today

- **Income timing.** A build makes its first progress on the turn it is ordered (`economy/queues.ts:179`), step 10; income is step 11 and reads the new state (`queues.ts:207`). So a mine ordered on turn 1 first pays at the end of turn 3, Industry turn 4. **[engine]** It is spendable the turn after.
- **Contested ground pays nobody** (`economy/income.ts:37`), pauses builds (`queues.ts:176`), blocks recruiting (`recruitment/rules.ts:54`) and Replenish, and pauses training except militia.
- **Capital and city.** You recruit only where you hold the whole territory and its capital; the capital's buildings unlock types. If the capital falls, training under way is lost. Cities count for victory and allow Industry; they add no income. Captured buildings stay.
- **Slots.** 2 recruits a territory a turn, plus 1 per Factory (`rules.ts:98`). Opening: Republic 17, North 8, South 4. **[engine]**
- **Replenish.** Up to half strength a turn; costs half the recruit price times the *share* restored (`rules.ts:294`), so the number of men doesn't matter. A Depot takes 25% off the Funds; a Hospital raises the cap to 75%.
- **Opening** **[engine]**:

| | Stock F/M | Income F/M | If contested ground goes to its main holder | Upgrades available (farms/mines/industry) |
|---|---|---|---|---|
| Republic | 40 / 10 | 14 / 27 | 20 / 28 | 15 / 17 / 7 |
| North | 15 / 10 | 5 / 27 | 7 / 31 | 14 / 15 / 5 |
| South | 15 / 5 | 1 / 0 | 11 / 16 | 2 / 2 / 0 |

The six contested territories hold 25 Funds and 27 Manpower; Andalucía alone holds 10 and 15. Asturias and Extremadura, even splits, stay contested in that column.

## 2. The owner's claims

| Claim | Verdict |
|---|---|
| Mines take 11 turns | **Right.** Break-even at the end of turn 10, so turn 11 is the first with a profit to spend (also 8 + 3). **[engine]** |
| Industry takes 12 | **Doesn't reproduce.** Break-even is the end of turn 13, profit from turn 14 (10 + 4). 12 could be 8 + 4 or the Factory's 12 Funds. |
| Does the interface show payback? | **No.** The option line shows price, turns and yield (`presentation/economy.ts:126`). **[code]** |
| Security forces are worse at equal cost | **Right, and stronger than claimed: infantry beats them on everything.** Same 6 Funds, 2 turns and Barracks; 1 Manpower against 2; 4/6 against 3/5. The 2,000 men buy nothing: value is type value × strength ÷ full strength (`d20/rules.ts:55`), losses are percentages, Replenish charges by share, break-up is a share. No live rule reads absolute men. (Only the old d6 code does, `battleResults.ts:92`.) |

**Why militia wins, today** (per Fund: attack / defence): militia **1.50 / 2.00**, colonials 0.75 / 0.63, infantry 0.67 / 1.00, security and cavalry 0.50. Militia also trains in 1 turn, needs no building and trains in contested ground. Its one price is Manpower: 1.0 attack a point against infantry's 4.0. The Republic's Funds buy 7 militia a turn and its Manpower 9: **Funds is the limit.** The 17 slots never bind.

Turn 10, whole army **[model]**:

| | Militia only | Infantry only | Militia adds, of infantry's attack |
|---|---|---|---|
| Republic | 318 / 433 | 184 / 275 | 208% |
| North | 157 / 217 | 90 / 135 | 252% |
| South | 133 / 165 | 98 / 127 | 167% |

Replenish adds to it: a point of militia costs about half the Funds of a point of infantry to refill, and a 10% loss on a 3/4 unit rounds away.

## 3. Upkeep options

Upkeep a turn in Manpower, **today's prices**, against a plausible army (opening units, 12/8/6 militia, then infantry with the remaining Funds, no losses) and the militia-only army **[model]**. Income is 27/27/0 at the opening and 28/31/16 from turn 3.

| Model | Side | Opening | Turn 6 | Turn 10 | Militia-only, turn 10 |
|---|---|---|---|---|---|
| **A. Flat:** 1 per ground unit | Republic | 17 | 43 | 56 | 103 |
| | North | 12 | 23 | 28 | 49 |
| | South | **9 of 0** | 19 | 26 | 38 |
| **B. By men under arms,** 0.5 per 1,000 | Republic | **20** | 40 | 45 | 128 |
| | North | 7 | 18 | 19 | 53 |
| | South | **9 of 0** | 18 | 20 | 45 |
| **C. By the type's full size,** 0.5 per 1,000, first 6 free | Republic | 7 | 26 | 31 | 114 |
| | North | 0 | 11 | 13 | 46 |
| | South | 0 | 9 | 11 | 36 |
| **D. As C, plus 0.5 Funds a machine** | Republic | 7 + 1.5 F | 26 | 31 | 114 |
| | North / South | 0 + 0.5 F | 11 / 9 | 13 / 11 | 46 / 36 |
| **E. Supply limit:** 3 units a whole territory, then 1 each | Republic | 0 | 25 | 38 | 85 |
| | North | 0 | 11 | 16 | 37 |
| | South | **3 of 0** | 13 | 20 | 32 |


| Model | At zero stock | Spiral risk | Computer player | Player wording |
|---|---|---|---|---|
| A | Can't recruit | High for the South (broke at the end of turn 1) | Same checks as C | "Every army costs 1k Manpower a turn." |
| B | Men leave | Republic hit hardest: its 10,000-man column fights like a 2,500-man one but costs four times as much | Same | "Armies eat by the men they have." |
| **C** | **Can't recruit or Replenish; men leave** | **Low** | **Below** | **"Each turn a unit costs half its full size in Manpower. Your depots feed the first 6k."** |
| D | As C; a machine without Funds can't move or fly | Low | Also caps machines | "...and half a Fund for each machine." |
| E | Over-limit units lose men | Medium: losing a territory lowers the limit at once | Must know the limit | "Each whole territory feeds three armies." |

**The lead tested:** "upkeep by men" does *not* work as literal men, because the Republic's historical columns are 2,500 to 10,000 strong. It does work by the *type's* size: militia costs 1.25 a turn against infantry's 0.35: 3.6 times a unit, 7 times a point of attack at the new values, with no special rule.

**Recommended: C.**
- **Zero stock:** no recruiting or Replenish, and the shortfall comes out of men (1 Manpower is 1,000 men), shared over all units, at most 10% a turn and never below half. Strength scales the bill, so it shrinks to fit. **No new order kind for the AI.**
- **Spiral:** you can't recruit your way into it: the 3 Manpower price runs out first (reckless spam stops at 18 extra militia for the Republic with no shortage **[model]**). Only losing ground can: if such a Republic army's income halved from 28 to 14 with nothing in stock, hand arithmetic settles it near 60% strength in six turns, none destroyed.
- **Build:** fractions reuse Replenish's thousandths carry (`rules.ts:224`, `chargeReplenish` at `:257`). One step after income, one ledger row, one schema block (`upkeep: {share, free, lossCap, floor}`). Aircraft count; generals don't.
- **Computer player:** (1) `worth()` (`ai/orders/recruit.ts:53`) adds 6 turns of upkeep to the price; (2) it stops recruiting when upkeep would pass income, unless stock covers 6 turns; (3) farms score higher when Manpower is the scarcer net income (`scarcestResource`, `build.ts:139`); (4) tests for each.

**Crossover** (Moderate, turn 10): the Republic feeds 18 extra militia (today 86), the South 13; the North buys 24, limited by Funds.

**Tenet 10 fails in every version.** The North's 5 to 7 Funds a turn can't employ 27 to 31 Manpower. The levers: price labour works partly in Manpower (both packages do), trim the North's farms, or raise its Funds. The owner likes the incomes, so I left them.

## 4. Values

Upkeep is a turn's Manpower at full strength: today 0; Moderate 0.5 × size; Bold 1.0 × size (first 12 free) plus 0.5 Funds a machine.

**Units**

| Unit | Funds | Manpower | Attack/defence | Turns | Upkeep, Moderate | Bold | Why |
|---|---|---|---|---|---|---|---|
| Infantry regiment | 6 to 5 | 1 | 4/6 | 2 | 0.35 | 0.7 | The standard: best all-round per Fund. |
| Militia column | 2 to 3 | 3 | 3/4 to 2/4 | 1 | 1.25 | 2.5 | Holds, no longer storms. |
| Colonial veterans | 8 to 7 | 2 | 6/5 | 2 | 0.9 | 1.8 | Best attack per Fund; pays for it in men. |
| Security forces | 6 to 4 | 2 to 1 | 3/5 | 2 to 1 | 0.5 | 1 | A quick garrison, not a worse regiment. |
| Artillery group | 8 to 7 | 1 | 3/3 | 3 to 2 | 0.3 | 0.6 | Same +1 a group, a turn faster. |
| Cavalry regiment | 6 to 4 | 1 | 3/3 | 2 | 0.3 | 0.6 | Cheap mobility. |
| Tank company | 12 to 10 | 1 | 3/2 to 5/3 | 4 to 3 | 0.15 | 0.3 | Was a dearer artillery; now an attacker, still +1 a company. |
| Truck column | 5 to 4 | 1 | 0/0 | 2 | 0.1 | 0.2 | Cheaper, so Motor is used. |
| Anti-air battery | 7 to 5 | 1 | 0/1 | 2 | 0.15 | 0.3 | Was too dear for a niche. |
| Reconnaissance flight | 8 to 5 | 1 | 0/1 | 3 to 2 | 0.05 | 0.1 | Scouting should be affordable. |
| Fighter squadron | 10 to 8 | 1 | 0/1 | 3 | 0.05 | 0.1 | Aircraft in time. |
| Bomber squadron | 12 to 10 | 1 | 0/1 | 3 | 0.05 | 0.1 | Same. |

In Moderate, per Fund (attack / defence): colonials 0.86 / 0.71 (best attack), infantry 0.80 / 1.20, security 0.75 / 1.25, cavalry 0.75 / 0.75, militia 0.67 / 1.33 (best defence). Militia holds; regulars take ground.

**Side effect:** militia attack 3 to 2 costs the Republic 5 of 64 opening attack and the North 1 of 48 (the Requetés; retype them if that jars). Defence is untouched.

**Builds**

| Build | Price | Turns | Pays back, turn | Why |
|---|---|---|---|---|
| Farms | 6 F to 3 F | 3 to 2 | (pays Manpower) | Manpower you can use sooner. |
| Mines | 8 F to 5 F | 3 to 2 | 10 to 6 | Was too late. |
| Industry | 10 F to 6 F | 4 to 2 | 13 to 7 | Was too late; cities only. |
| Barracks | 6 F to 5 F | 2 | – | Regulars sooner. |
| Factory | 12 F + 6 M to 10 F + 4 M | 4 to 3 | – | Slots never bind; its value is the unlocks. |
| Depot | 8 F to 6 F | 2 | – | Unlocks machines. |
| Fortifications | 6 F to 3 F + 2 M | 2 | – | Now 2 on the die, part labour. |
| Hospital | 6 F to 5 F | 2 | – | Niche. |
| Airfield | 8 F to 6 F | 3 to 2 | – | Aircraft in time. |
| Paved airfield | 6 F to 4 F | 2 | – | Cheap upgrade. |
| Rail yard | 8 F to 6 F | 3 to 2 | – | Rail pays sooner. |
| Rail repair | 6 F to 3 F + 1 M | 3 to 2 | – | Part labour. |
| Port | 8 F to 6 F | 3 to 2 | – | Landings. |
| New rail line | 24 F to 10 F + 6 M | 8 to 5 | – | 8 turns is most of a game; part labour. |
| Rail upgrade | 10 F to 5 F + 3 M | 4 to 3 | – | Part labour. |
| Road upgrade | 6 F to 3 F + 2 M | 2 | – | Part labour. |

**Bold** also has artillery at 6 Funds, fighters and bombers trained in 2 turns and a 1-turn Barracks; every other price is Moderate's. Manpower binds for the Republic (93% used) and the South (48%), but the Republic's turn-10 army eats 124% of income and fails tenet 7.

**History check.** Militia were not cheap: the Republic's militia pay was fixed at 10 pesetas a day, whatever the rank [S7, S8, extract]. Security forces were 53,000 to 70,000 trained men, about 60% Republican [S9, web]; quick garrisons fit. The Army of Africa was about 24,500 [S9]. Catalan industry was organised for war from 7 August 1936, some 500 workshops and 50,000 to 80,000 workers in all [S10, web], with results in a few months [S11, extract]. So one month (2 turns) to convert a factory is quick. I found no price per regiment, so unit prices are **[judgement]**.

## 5. Payback and game length

Break-even for an order on turn *t*: *t* + build turns + cost ÷ yield − 2.

From turn 1, mines and Industry break even on turns 10 and 13 today, 6 and 7 under Moderate. A 10-turn game wants 5 to 7; the sims' 13 to 15 turns want 7.

An economy opening on half the Republic's starting Funds is 6% behind in army value on turn 5 and 4% ahead on turn 10 under Moderate; today it's 7% behind and 2% behind.

| Lever | Effect | Realism against play |
|---|---|---|
| Cheaper and faster (Moderate) | Breaks even on 6/7 | Data only. One month for conversion is quick. |
| Bigger yield | Industry at 2 a level doubles standing levels too: Republic +10 Funds, North +2, South 0 | A hidden Republic buff; not first. |
| Pay during construction | A third per turn of progress | Needs a rule and wording. |
| One-time grant on completion | Same break-even, less tempo | Gamey. |
| Higher opening stock | More early builds | Also more early militia. |
| Longer games (raise 51% or 75%) | Every build benefits | Under-10 games are partly the spam itself. Fix it first. |
| Higher AI build limit | It keeps 1 development item queued (`developmentProjects`) **[data]** | With cheaper builds, 2. |

Past lengths **[sim]**: Rev 1 build, 1,000 games, median 12 (`milestone-3-rev-1-sitrep-01.md`); Rev 2 ideation variants on it, 400 games each, 13 to 15 (`milestone-3-rev-2-ideation/content.md`). Both had AI blunders on. **The shipped Rev 2 build has no balance run.**

## 6. Popular Resistance and militia upkeep together

**Popular Resistance is 3** (`d20.factionModifiers`, read at `d20/modifiers.ts:60`). The `combat.factionModifiers` value of 1 is the d6 path (`combat/odds.ts:83`); the d20 ignores `when` and uses `holdsCity`. Removing it means emptying both lists (the d6 list is a required key, so `[]`). Barricades, −1 for any side in a city, is separate and stays. **Each 3 on the die is one odds column**. Taking the opening Republic garrisons, against the strongest enemy able to attack **[engine]**:

| Republic holds | Attack : defence | Take chance today | Without |
|---|---|---|---|
| Asturias | 23 : 4 | 60% | 75% |
| País Vasco | 19 : 4 | 45% | 60% |
| Cantabria, Extremadura, Murcia | about 3:1 to 4:1 | 30% | 45% |
| Andalucía | 42 : 6 | 90% | 100% |
| Madrid, Catalunya, Valencia | under 1:1 | 0% | 0% (some ground: 0% to 15%) |

So **+10 to +15 points of take chance where the attacker has the numbers,** and nothing where it's weak.

**Upkeep** costs the Republic 5.1 of 27 Manpower a turn (19%), the North and South 0. The spam fix: in the best-mix projection the Republic's turn-10 attack goes from 115% of the North and South combined to 99%, and defence from 119% to 102%. If everyone plays regulars nothing moves (98% before and after), so the shift is the lost *spam* advantage.

| Lever | Size | Note |
|---|---|---|
| Barricades 1 to 2, every side | Returns 5 of the 15 points | In both packages. Symmetrical. |
| Alarm starts at 3 steps, not 4 | Removes a ×1.5 stake on Republic ground from turn 1 | **[engine]** |
| Fortifications at Madrid and Barcelona from the start, worth 2 | 10 points in those two capitals | Data only; Madrid was fortified that autumn. |
| More free upkeep for the Republic (9, not 6) | 3 Manpower a turn | Volunteers. |
| Republic stock 40 to 50 Funds | 2 regiments | Bank of Spain reserves. |
| One more North unit cut | Rev 2: two cuts gave the Republic +5.8 points (10.0% to 15.8%) **[sim, Rev 1 build]** | |

**No sims run:** the win share was 9.6% (Rev 1) to 15.8% (Rev 2 variant). Removing Popular Resistance will lower it; by how much is unknown.

## 7. The AI near a rival's win

**Seen:** any rival, human or computer. `assess` uses `victoryProgress` for every faction (`ai/assessment.ts:114`) and doesn't ask who plays it. Gap = the smaller of territories short and half the cities short (`:120`). So the human one short is seen, and both AIs are already alarmed by the Republic at 3 short.

**Weights at one step:** leader's territory ×2.5 (1 + 0.5 × 3); own deciding territory ×4 (`:144`). The scenario note says holding outranks attacking *on purpose*. I'd change that: guarding can't stop a leader who needs any one of several territories.

| # | Gap | Where | Change |
|---|---|---|---|
| 1 | Guarding beats striking, and the last army on deciding ground may never leave, so a leader one short freezes the whole border | `assessment.ts:144`, `plan.ts:59` | Make the leader's ground ×4 at one step (data: steps 3, perStep 1.5); drop the pin for armies whose attack hits the leader |
| 2 | Only ground the leader **controls** whole is alarmed (`:147`); ground it contests is 0 | `assessment.ts:144` | Alarm contested ground that includes the leader |
| 3 | Deciding ground counts only if the AI holds some of it; ground another rival or nobody holds is ignored | `:141` | Alarm any territory the leader can reach and would win with |
| 4 | "Deciding" means one territory. A human takes two or three a turn | `:131` | When the leader is 2 short, alarm any two reachable together |
| 5 | A partial win counts half the prize, though a single foothold makes the territory contested and takes it off the leader's count | `attacks.ts:150` | At alarm, count gaining any ground in full |
| 6 | Own losses cost 0.75 a point even when the alternative is losing the game, so bad odds score negative | `attacks.ts:153` | Scale own losses and caution down by alarm (floor 0.25) |
| 7 | Recruit and Build planners ignore the alarm. Build keeps a 30% Funds reserve; recruits ignore training time except 15% a turn | `build.ts:122`, `recruit.ts:53` | At alarm 1.5+, no reserve, and prefer 1-turn units at sites in reach |
| 8 | Enemy generals, trucks and anti-air count 1 attack and "reach" in the threat count, though they can't take ground (aircraft are already filtered, `computerPlayer.ts:30`). False alarms pin armies | `assessment.ts:67,82`; `combat/values.ts:39` | Filter with `canFight`, as the engine does |
| 9 | Each AI plans alone | `computerPlayer.ts:38` | Accept. Changes 1 to 6 make both choose the leader |

Reach isn't the limit (`reach.ts:46` covers rail, trucks and sea); values and which ground counts are.

**Tests that prove it** (next to `computerOffensive.test.ts:112`, tiny-front and Spain fixtures): leader 1 short, the AI attacks its ground at 1:1 and above instead of holding; leader 1 short with the deciding ground held by a third side, the AI's stake there is raised; leader 2 short with two adjacent threats, both are alarmed; an enemy general or truck column next door does not make ground critical; a 2:1 attack with 20% take and 50% gain beats holding at one short; a human-controlled leader produces the same orders as a computer one.

## 8. Not verified

The win-share effect of anything (sims need the owner's word). How often AIs spam (`worth()` turns to militia once Manpower piles up). Why the owner's Industry figure is 12. S2, S7, S8 and S11 were seen only in search extracts.

## Sources

- **S1** Schreiber, *Game Balance Concepts*, level 3: https://gamebalanceconcepts.wordpress.com/2010/07/21/level-3-transitive-mechanics-and-cost-curves/ (read)
- **S2** Hearts of Iron IV factory payback, players: https://steamcommunity.com/app/394360/discussions/0/6670425060423867165 (extract)
- **S3** Axis & Allies infantry push: https://axisandallies.org/p/infantry_push_mechanic_alive_and_well_or_dead_and_buried (read)
- **S4** Warcraft III upkeep: https://classic.battle.net/war3/basics/upkeep.shtml (read)
- **S5** RTS "speed bumps": https://www.gamedeveloper.com/game-platforms/the-importance-and-challenge-of-speed-bumps-in-rts-economies (read)
- **S6** Sirlin, slippery slope: https://www.sirlin.net/articles/slippery-slope-and-perpetual-comeback (read)
- **S7** Gaceta, 6 September 1936: https://boe.es/gazeta/dias/1936/09/06/pdfs/GMD-1936-250.pdf (extract; scan not machine-readable)
- **S8** Militia database, Ara: https://en.ara.cat/culture/are-you-looking-for-relatives-who-fought-in-the-civil-war-database-of-37-002-militiamen-is-born_130_5801925.html (extract)
- **S9** Break-up of the armed forces, 1936: https://en.wikipedia.org/wiki/Breakup_of_Spanish_armed_forces_(1936) (read)
- **S10** War Industries Commission: https://en.wikipedia.org/wiki/War_Industries_Commission (read)
- **S11** Catalan war industry photographs and note: https://vscw.ca/en/node/446 (extract)
