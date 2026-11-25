# Owner answers to the balance plan (2026-11-24)

Answered 27 of 27. "Merge rev 4 into main, we can safely skip the play tests, then start on the balancing. Oh and I guess all this balancing stuff is actually Rev 5. I forgot about rev 4 work from yesterday."

| # | Answer | Note |
|---|---|---|
| B-1 fair | A. 28 to 39% a seat | |
| B-2 length | A. Median in 20-30 and at least 60% of games inside | |
| B-3 early wins | A. At most 5% by turn 8 | |
| B-4 late lead | **B. Territories only, as measured now** | |
| B-5 economy | **B. A player that never builds wins at most 5%** | "the tricky thing here is that we don't have human players to simulate this, so we need a mix of AI strategies to test this from different angles, then make a change to the game, and see if those cheesy bots still win as much." |
| B-6 mixed army | **C. Winners give at least three arms 10% or more of their combat recruits** | |
| B-7 history | **Most games reach winter 1937 only** | "None of these are super necesarry." |
| B-8 want to win | Builder, combined arms, aggressor, turtle, city hunter | |
| B-9 cheese first | Rush, denier, air stacker, threshold attacker, no-build, single arm, elite core (not waiter) | |
| B-10 too strong | A. More than 10 points above its seat's normal rate, or over 50% | "Any strategy that enables a player to win 50% of the games, regardless of the other player's strategies, is OP and should be nerfed. Strategies like the waiter, or elite core, or threshold attacker aren't bad, so may not need a change to the game base." |
| B-11 personas | **C. All in the scenario data** | |
| B-12 standard player first | A. Fix aircraft, anti-air and trucks, then a new baseline | |
| B-13 win targets | **12 territories only** | "Try twelve, but I worry that is too many, I think 10 is fine." |
| B-14 numbers | Starting Funds, air support and cap, development, digging-in cap, unit prices and upkeep, barricades (all) | |
| B-15 rule changes | **None** | |
| B-16 when | B. Early, alongside numbers | Moot: no rule change is approved. |
| B-17 garrisons | A. Yes, after the win target and money | |
| B-18 money | **B. 6 cells of 200** | "We can run more and run them faster locally" |
| B-19 kit | C. Skip it | |
| B-20 mixed games | A. After each persona alone: 400, then 1,200 | |
| B-21 stop | A. Goals met, or three changes in a row that don't improve them | |
| B-22 tokens | **C. Up to 2M** | |
| B-23 language model | A. Not yet | |
| B-24 early-win check | C. Leave it (10 games) | |
| B-25 branch | **C. Merge Rev 4 to main first** | Merged as one commit, 7ebaff5, not pushed. Work is Rev 5 on `m3r5`. |
| B-26 air losses | A. Keep as built | |
| B-27 one-turn units | A. Keep the Rev 4 rule | |

## How they are read

- **Rule changes:** B-15 says none, so this revision is numbers and personas only. If numbers fail, the owner is asked.
- **Winter 1937:** January and February 1937 (turns 12-15). December 1937 is turn 34, past the 20-30 target.
- **Arms:** foot (infantry, militia, veterans, security forces, cavalry), guns, tanks, aircraft (fighters and bombers). Trucks, anti-air and recon don't count.
- **Too strong, two tiers:** over 50% against any mix of opponents is always nerfed, judged in mixed lineups. The +10 rule applies to rush, denier, air stacker, no-build and single arm. Threshold attacker and elite core are legitimate styles; only the 50% rule applies to them.
- **Win target:** 10 against 12 only. The city target stays 19 unless the owner says otherwise. 11 may be simulated for comparison but not adopted.
- **South starting Manpower:** approved on 2026-11-24, after Round 1 ("May I change starting Manpower for the South? Yes"). The South only; B-14 itself names starting Funds.
- **Barricades:** last, one point at most. On Rev 3 one point swung 25 to 34 points between seats.
