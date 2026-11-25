# Static tables (Rev 4 data, 2026-11-24)

From `static_tables.py`; no games played. Read with `goals.py` results.

## 1. Price per roll point (attack side)
| Source | Roll | Funds | Manpower | Funds per +1 |
|---|---|---|---|---|
| Artillery group (first +1 takes 1) | +1 (max 3) | 6 | 1 | 6.0 |
| Tank company (first +1 takes 1) | +1 (max 2) | 8 | 1 | 8.0 |
| Fighter squadron on Ground Support (unopposed, max 2) | +3 | 6 | 1 | 2.0 |
| Bomber squadron on Ground Support (unopposed, max 2) | +3 | 7 | 1 | 2.3 |
| Fortifications (defence) | -2 to the attacker | 3 | 2 | 1.5 |
Dig in: -2 a pip to the attacker, free, one pip a turn, at most 3 pips.
One odds column is worth 3 points. Doubling attack 20 (5 infantry, 25 Funds) moves 1:1 to 2:1; a fighter's +3 does the same for 6 Funds.

## 2. Exact odds: chance to take the whole territory, by ratio and modifier
| Ratio | -10 | -6 | -3 | +0 | +3 | +6 |
|---|---|---|---|---|---|---|
| 1.0:1 | 0% | 0% | 5% | 20% | 35% | 50% |
| 1.2:1 | 0% | 0% | 5% | 20% | 35% | 50% |
| 1.5:1 | 0% | 0% | 5% | 20% | 35% | 50% |
| 1.9:1 | 0% | 0% | 5% | 20% | 35% | 50% |
| 2.0:1 | 0% | 5% | 20% | 35% | 50% | 65% |
| 2.5:1 | 0% | 5% | 20% | 35% | 50% | 65% |
| 2.9:1 | 0% | 5% | 20% | 35% | 50% | 65% |
| 3.0:1 | 0% | 20% | 35% | 50% | 65% | 80% |
| 4.0:1 | 15% | 35% | 50% | 65% | 80% | 95% |
| 5.0:1 | 30% | 50% | 65% | 80% | 95% | 100% |
| 6.0:1 | 45% | 65% | 80% | 95% | 100% | 100% |
Cliffs at +0: 1.9:1 and 1.0:1 are the same column; 2.0:1 steps up a column.

## 3. Dominance: combat value per Fund (Manpower counted as 1) and per upkeep point
| Unit | Attack/Defence | Funds+Manpower | Attack per Fund | Attack per upkeep | Men per recruit | Training |
|---|---|---|---|---|---|---|
| Colonial veterans (north/south only) | 6/6 | 7+1 | 0.75 | 24.0 | 1800 | 2 |
| Infantry regiment | 4/6 | 5+1 | 0.67 | 16.0 | 700 | 2 |
| Cavalry regiment | 3/3 | 4+1 | 0.60 | 10.0 | 600 | 2 |
| Tank company | 5/3 | 8+1 | 0.56 | 33.3 | 300 | 3 |
| Security forces | 2/6 | 4+1 | 0.40 | 2.0 | 1000 | 1 |
| Militia column | 2/5 | 3+3 | 0.33 | 1.3 | 2500 | 1 |
| Artillery group | 2/3 | 6+1 | 0.29 | 20.0 | 600 | 2 |
- Infantry regiment dominates Militia column (at least as strong, no dearer, no more upkeep)
- Security forces dominates Militia column (at least as strong, no dearer, no more upkeep)

## 4. Start and reach: whole territories, shared territories, cities
- Republican Government: 6 whole, 6 shared, 13 cities; needs 4 more territories for 10, 6 for 12, 6 cities for 19
- Northern Insurgent Command: 4 whole, 4 shared, 8 cities; needs 6 more territories for 10, 8 for 12, 11 cities for 19
- Southern Insurgent Command: 2 whole, 2 shared, 4 cities; needs 8 more territories for 10, 10 for 12, 15 cities for 19

## 5. Economy: opening income if every shared territory counted, and paybacks
- Farms: {'funds': 3}, 2 turns, +0.6 manpower a level: pays back in 7 turns in Funds terms
- Mines: {'funds': 5}, 2 turns, +1 funds a level: pays back in 7 turns in Funds terms
- Factory: {'funds': 6, 'manpower': 4}, 2 turns, +1.5 funds a level: pays back in 6 turns in Funds terms
- Infantry regiment: upkeep 0.25 Manpower a turn, 1 Manpower to raise
- Militia column: upkeep 1.5 Manpower a turn, 3 Manpower to raise
- Colonial veterans: upkeep 0.25 Manpower a turn, 1 Manpower to raise
- Security forces: upkeep 1 Manpower a turn, 1 Manpower to raise
- Artillery group: upkeep 0.1 Manpower a turn, 1 Manpower to raise
- Cavalry regiment: upkeep 0.3 Manpower a turn, 1 Manpower to raise
- Tank company: upkeep 0.15 Manpower a turn, 1 Manpower to raise
- Truck column: upkeep 0.1 Manpower a turn, 1 Manpower to raise
- Anti-air battery: upkeep 0.15 Manpower a turn, 1 Manpower to raise

## 6. Denial: what one contested territory costs its owner a turn, with its opening garrison
| Territory | Funds | Manpower | Provinces | Opening defence value |
|---|---|---|---|---|
| Andalucía | 10.0 | 9.0 | 8 | 31 |
| Castilla y León | 4.5 | 4.8 | 9 | 13 |
| Castilla-La Mancha | 3.5 | 5.4 | 5 | 0 |
| Asturias | 7.0 | 0.6 | 2 | 23 |
| País Vasco | 6.5 | 0.6 | 3 | 11 |
| Cataluña | 3.0 | 3.6 | 4 | 17 |
| Galicia | 1.5 | 4.2 | 4 | 6 |
| Valencia | 1.5 | 4.2 | 3 | 12 |
| Aragón | 2.5 | 2.4 | 3 | 18 |
| Murcia | 2.5 | 1.2 | 1 | 6 |
| Cantabria | 2.5 | 0.6 | 1 | 6 |
| Extremadura | 0.0 | 3.0 | 2 | 12 |
| Madrid | 1.5 | 1.2 | 3 | 25 |
| Navarra | 0.0 | 1.2 | 1 | 11 |
| La Rioja | 0.0 | 1.2 | 1 | 0 |
| Melilla | 1.0 | 0.0 | 1 | 12 |
| Islas Baleares | 0.0 | 0.6 | 3 | 12 |
