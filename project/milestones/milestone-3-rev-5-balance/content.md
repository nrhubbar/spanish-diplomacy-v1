<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Revision 4 · Balance</p>
<h1>Rev 4 Balance Plan</h1>
<p class="meta"><span>24 Nov 2026</span><span>27 questions</span><span>No new games run, no code changed</span></p>
</header>

<p class="summary-line">We tune for long, close games that need an economy and a mixed army, then attack the result with computer players built to cheese it. A number is accepted only when 400 fresh games meet the goals and no cheese player beats its limit.</p>

Every question has a recommended answer and a notes box. Choose an option, add your reasons or a different idea, and your answers save as you go. **Use recommended for blanks** fills the ones you skip, for you to review; **Copy my answers** gives you Markdown to paste back here. Plan numbers come from the [200 recorded games](https://claude.ai/artifact/E76Q1uwaM3BGvs3qmSBUUU) and the Rev 4 code.

<!-- section:goals -->
## What we're optimizing for

| Goal | Today | Proposed target |
|---|---|---|
| 20 to 30 turns | Median 15; 25% of games inside | Median inside, 60% of games inside |
| No snap wins | 27.5% over by turn 8 | At most 5% |
| Winner leads only briefly | Leads alone a median of 3 turns | Under 2 |
| Economy needed | Not tested; early developers win 20% of longer games | A player that never builds wins at most 10% |
| Mixed army needed | Not tested; 97% of winners have three arms | Each banned arm costs 10 points |
| Fair seats | 43.5 / 37 / 19.5% | 28 to 39% each |
| History | Not recorded yet | Your pick, in half of games |
| No cheese | Not tested | No strategy more than 10 points above its seat |

<div class="questions" data-idea="goals"></div>

<!-- section:findings -->
## What still holds from the cloud analysis

It ran on Rev 3, so its four recommended numbers are starting points. I checked each claim against the Rev 4 code and the recorded games.

| Claim | On Rev 4 |
|---|---|
| One unit stops a territory paying | **True, and worse.** Contested land also stops recruiting and replenishing, and pauses building |
| Ratios round down, so 1.9:1 fights as 1:1 | **True** |
| A full-strength unit is the best value | **True.** Upkeep is per unit at any strength, and replenishing is half price per man |
| Two fighters give +6 | **Partly.** One anti-air battery cuts their chance of support to 45% |
| Militia can be raised in enemy territory | **False.** You must hold the ground whole |
| Security forces are 57% of recruits | **No longer.** 4.7%, so leave their price alone |
| Early wins come from a solved opening | **True.** The winner led alone at turn 1 in 93% of games over by turn 8, and in 22% of the rest |
| Buildings are captured intact | **True** |
| Long games take 10 seconds a turn | **No.** A 20 to 30 turn game takes about 4 seconds here |

<!-- section:static -->
## Static analyses, before any games

1. **Price per roll point:** what +1 on the roll costs from aircraft, guns, forts and digging in, next to more men. A fighter's +3 is one odds column for 6 Funds; doubling a 20-attack army with infantry costs 25.
2. **Exact odds:** where the cliffs are.
3. **Dominance:** any unit that is at least as good and cheaper. Colonial veterans beat infantry on attack per Fund, and the Republic can't recruit them.
4. **Reachability:** how soon each side could reach the win target if nobody answered. The Republic starts with 6 whole territories and part of 6 more, so 4 of those 6 reach 10.
5. **Economy limits:** what army each side can keep, and when each building pays back.
6. **Denial:** what one cheap unit takes from a rival, and what that first province costs to take. Andalucía is worth 10 Funds and 9 Manpower a turn.

A script prints all six and reruns after each accepted change.

<!-- section:strategies -->
## Strategies and personas

**Kinds of player.** Weight personas change the computer player's numbers only. Cheese bots are the standard player plus one override, and each records how often it used its trick, so a harmless result can't mean a broken bot. Nothing is written against a named territory or unit.

**Fixes to the standard player come first** and are a new baseline. The standard player is frozen inside each round.

<div class="questions" data-idea="strategies"></div>

<!-- section:changes -->
## Changes to the game

Order: win target, then money, then unit prices, then rules. Barricades stay at 2. If the win target changes, the Republic briefing's "10 of 18 territories or 19 of 25 cities" must change with it.

<div class="questions" data-idea="changes"></div>

<!-- section:sims -->
## Experiments and sim strategy

| Run | What it tests | Games |
|---|---|---|
| 1. Baseline | Rev 4 with the standard-player fixes | 400 |
| 2. Length | Win targets | 50 each, best at 400 |
| 3. Fair seats | Starting money | Depends on B-18 |
| 4. Strategies we want | Each in every seat, beside two standard players | 400 for builder and combined arms; 50 for the rest |
| 5. Strategies we don't want | The cheese list in every seat | 50 each, flags at 400 |
| 6. Arms | Ban guns, tanks or aircraft in one seat | 400 each |
| 7. Mixed games | Three different personas per game | 400, then 1,200 |
| 8. History | Markers read from the 400-game runs | 0 extra |

<svg viewBox="0 0 760 330" role="img" aria-label="Only a change that survives 400 fresh games and the cheese bots becomes the baseline" style="width:100%;height:auto;font-family:var(--sans)" font-size="13"><defs><marker id="rr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink-soft)"/></marker></defs><g fill="none" stroke="var(--ink-soft)" stroke-width="1.25"><path d="M166 98H198" marker-end="url(#rr)"/><path d="M338 98H370" marker-end="url(#rr)"/><path d="M510 98H564" marker-end="url(#rr)"/><path d="M628 54V34H96V72" marker-end="url(#rr)"/><path d="M628 142V204" marker-end="url(#rr)"/><path d="M548 240H484" marker-end="url(#rr)"/><path d="M400 188V160H96V122" marker-end="url(#rr)"/><path d="M316 240H210" marker-end="url(#rr)"/></g><g fill="var(--surface)" stroke="var(--ink-soft)" stroke-width="1.25"><rect x="26" y="74" width="140" height="48" rx="8"/><rect x="198" y="74" width="140" height="48" rx="8"/><rect x="370" y="74" width="140" height="48" rx="8"/><polygon points="564,98 628,54 692,98 628,142"/><rect x="548" y="204" width="160" height="72" rx="8"/><polygon points="316,240 400,188 484,240 400,292"/></g><rect x="30" y="216" width="180" height="48" rx="8" fill="var(--surface-2)" stroke="var(--accent)" stroke-width="2"/><g fill="var(--ink)" text-anchor="middle"><text x="96" y="102">Pick one change</text><text x="268" y="102">Static check</text><text x="440" y="102">Screen: 50 games</text><text x="628" y="102">Helps?</text><text x="628" y="228">Confirm: 400 fresh</text><text x="628" y="246">games, then the</text><text x="628" y="264">cheese bots</text><text x="400" y="236">Goals met,</text><text x="400" y="254">no cheese?</text><text x="120" y="244" font-weight="600">Accept: new baseline</text></g><g fill="var(--ink-soft)" font-size="11.5" text-anchor="middle"><text x="362" y="28">no: drop it</text><text x="250" y="152">no: undo it, try another</text><text x="263" y="232">yes, you agree</text><text x="650" y="178">yes</text></g></svg>

- **Screens:** 50 games in the seat, compared with that seat's own normal rate, flagged at 5 points above it. That is a trigger for a 400-game run, not a result.
- **Confirmations:** 400 games on unused seeds, where a lift is good to about 7 points. **Close calls:** 1,500.
- **Cost:** about 25 seconds for 50 games and 3.5 minutes for 400, so compute isn't the limit. A script prints one table per run.

<div class="questions" data-idea="sims"></div>

<!-- section:run -->
## Running it

Five rounds, stopping for you after each: **0** harness, static tables, personas' plumbing and the fixes (500k); **1** win target and money (150k); **2** personas and cheese (500k); **3** rules, only if agreed (400k); **4** mixed games and the final check (150k).

<div class="questions" data-idea="run"></div>

<!-- section:rev4 -->
## Left over from Rev 4

<div class="questions" data-idea="rev4"></div>
