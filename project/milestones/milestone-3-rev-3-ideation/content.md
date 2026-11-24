<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Revision 3 · Design review</p>
<h1>Milestone 3 Rev 3 Review</h1>
<p class="meta"><span>22 Nov 2026</span><span>Mockups drawn over the live Rev 2 build</span><span>Research: <code>milestone-3-rev-3-ideation/research/</code>, branch <code>m3r3-ideation</code></span></p>
</header>

<p class="summary-line">Your 12 notes hold up. The economy ones share a single cause: Funds are scarce, Manpower is almost free, and militia is priced in the free one. Two notes have complications: the South can't pay any upkeep without an allowance, and Popular Resistance is worth three points on the die, so removing it needs something in its place.</p>

**How to use this page.** There are 29 questions, each with a recommended answer. **Use recommended for blanks** fills the rest, and **Copy my answers** gives Markdown to paste back. Choices I think are clear-cut are listed under "Settled unless you object" near the end.

**What the numbers are.** No simulations were run. Economy figures come from the scenario data, the engine's own income and price functions, and a ten-turn projection with no battles in it. They compare prices well. They can't predict who wins.

<!-- section:verdicts -->
## Verdicts at a glance

| # | Note | Verdict | Size |
|---|---|---|---|
| 1 | Resizable right pane | **Yes.** Grip on the left edge; sheet height on phones | M |
| 2 | Aircraft markers | **Yes.** They never got the card. Also a bug: fighters are tagged BOMB | M |
| 3 | Music and sound effects | **Yes, with strict limits.** Music split into four files | L |
| 3.a | Bandwidth | **Yes.** 83% of a first visit is three map pictures | M |
| 4 | Recruit page effects | **Yes.** Nothing shows them today | S |
| 5 | Battle balance sheet | **Yes.** Every roll bonus is already recorded; unit strength inputs are not | M |
| 6 | Troop costs and upkeep | **Yes.** Upkeep by a unit type's size, which makes militia pay most without a special rule | L |
| 7 | Mines and Industry payback | **Yes.** Mines 10 turns to 6, Industry 13 to 7 | S |
| 8 | Invasion pane | **Partly my regression.** Zero of 12 unit cards are visible today; the fix shows 4 | M |
| 9 | Casualties by the turn counter | **Yes,** once surrendered and disbanded men are counted and the top bar fits | M |
| 10 | Computer stops a rival one step short | **Yes.** It guards on purpose today; it should strike | M |
| 11 | Remove Popular Resistance | **Yes, with a replacement.** It is worth 10 to 15 points of success chance in city fights | S |
| 12 | Right resources, adjust the values | **Agreed.** Incomes are left alone | – |
| + | Code pruning | **Yes.** Cleaner than it feels, with one large decision | M |

<!-- section:why -->
## Why the economy plays this way

The Republic earns 14 Funds and 27 Manpower a turn. Militia costs 2 Funds and 3 Manpower, so Funds are the limit: seven columns a turn, every turn. Recruit slots never bind (the Republic has 17).

| Per Fund spent, today | Attack | Defence | Training |
|---|---|---|---|
| Militia column | **1.50** | **2.00** | **1 turn** |
| Colonial veterans | 0.75 | 0.63 | 2 |
| Infantry regiment | 0.67 | 1.00 | 2 |
| Security forces, cavalry | 0.50 | 0.83, 0.50 | 2 |

Over ten turns, spending everything on militia adds **208%** of the attack that infantry would for the Republic, 252% for the North and 167% for the South.

**Your claims, checked.**
- **Security forces:** worse than you said. Infantry beats them on every number at the same price. Their 2,000 men buy nothing, because strength, losses and Replenish all work by share, not by head count.
- **Mines, 11 turns:** right. A mine ordered on turn 1 breaks even at the end of turn 10 and profits from turn 11.
- **Industry, 12 turns:** I get later. It breaks even on turn 13 and profits from turn 14.

<!-- section:tenets -->
## Twelve provisional tenets

These are tests for any set of values, and each can be recomputed from the scenario file. Today's game passes 2 of 12. The **Moderate** package passes 11 and **Bold** passes 10. Moderate was tuned against these tests, so a pass means it does what it was designed to do; only play shows whether it is balanced.

<!-- widget:tenets -->

- **The one every package fails** is "Manpower is scarce enough to plan around". The North earns 27 to 31 Manpower but only 5 to 7 Funds, so it can't employ its men. Paying for labour works partly in Manpower helps; fixing it fully means changing incomes, which you like.
- **The thinnest pass** is the North's militia, at 92% of what its regulars add against a limit of 95%. If the North still spams in playtests, that is the first number to move.
- **Where they come from:** Schreiber on cost curves and game length; Axis & Allies' cheap-infantry problem; Warcraft III's stepped upkeep and Company of Heroes 2's gradual one; Sirlin on slippery slopes. Links are in `research/economy.md`, which marks what was read in full and what was only a search extract.

<!-- section:upkeep -->
## Note 6: upkeep

Four shapes were worked through for all three sides. A flat cost per army bankrupts the South at the end of turn 1, because its opening income is **zero** Manpower. Charging by literal men punishes the Republic's historical 10,000-man column, which fights like a 2,500-man one.

<div class="recommend"><strong>Recommended:</strong> each turn a unit costs half a Manpower per 1,000 men of its type's full size, scaled by its current strength. The first 6 are free to every side. Militia pays 1.25 and infantry 0.35. At the start the bill is about 5 of the Republic's 27, and nothing for the North and South.</div>

**When a side can't pay,** it can't recruit or Replenish, and the missing men leave: at most 10% of a unit a turn and never below half. A smaller army costs less, so the bill shrinks to fit and no unit starves to death.

Try other shapes and rates:

<!-- widget:upkeep-lab -->

The lab assumes no battles and no lost ground.

<div class="questions" data-idea="upkeep"></div>

<!-- section:values -->
## Notes 6 and 12: troop values

Militia holds ground and regulars take it. Security forces become a quick garrison. Machines get cheaper, so trucks, tanks and aircraft appear before the game is over.

| Unit | Funds | Manpower | Attack/defence | Training | Upkeep a turn |
|---|---|---|---|---|---|
| Infantry regiment | 6 → **5** | 1 | 4/6 | 2 | 0.35 |
| Militia column | 2 → **3** | 3 | 3/4 → **2/4** | 1 | 1.25 |
| Colonial veterans | 8 → **7** | 2 | 6/5 | 2 | 0.9 |
| Security forces | 6 → **4** | 2 → **1** | 3/5 | 2 → **1** | 0.5 |
| Artillery group | 8 → **7** | 1 | 3/3 | 3 → **2** | 0.3 |
| Cavalry regiment | 6 → **4** | 1 | 3/3 | 2 | 0.3 |
| Tank company | 12 → **10** | 1 | 3/2 → **5/3** | 4 → **3** | 0.15 |
| Truck column | 5 → **4** | 1 | 0/0 | 2 | 0.1 |
| Anti-air battery | 7 → **5** | 1 | 0/1 | 2 | 0.15 |
| Reconnaissance flight | 8 → **5** | 1 | 0/1 | 3 → **2** | 0.05 |
| Fighter squadron | 10 → **8** | 1 | 0/1 | 3 | 0.05 |
| Bomber squadron | 12 → **10** | 1 | 0/1 | 3 | 0.05 |

Edit any value and see which units become pointless:

<!-- widget:unit-value -->

The same money, spent two ways:

<!-- widget:militia-vs-mixed -->

**Side effect.** Cutting militia attack from 3 to 2 takes 5 of the Republic's 64 opening attack and 1 of the North's 48. No source gave a price per regiment, so unit prices are judgement.

Your answers to 6d, 6e, 7a and 7b override the package you pick in 6c. Pick C there and the prices in this table stay as they are today.

<div class="questions" data-idea="values"></div>

<!-- section:payback -->
## Note 7: builds worth ordering

Past computer games ran a median of 12 to 15 turns on older builds. Yours end before 10, partly because the spam ends them. A ten-turn game wants builds that pay back in five to seven.

| Build | Price | Build time | Pays back on turn |
|---|---|---|---|
| Farms | 6 → **3** Funds | 3 → **2** | pays Manpower |
| Mines | 8 → **5** Funds | 3 → **2** | 10 → **6** |
| Industry | 10 → **6** Funds | 4 → **2** | 13 → **7** |
| Factory | 12 F + 6 M → **10 F + 4 M** | 4 → **3** | unlocks units |
| Fortifications | 6 F → **3 F + 2 M**, worth 2 on the die | 2 | – |
| New rail line | 24 F → **10 F + 6 M** | 8 → **5** | – |
| Road upgrade | 6 F → **3 F + 2 M** | 2 | – |

The full list is in `research/economy.md`. Under these prices, spending half the Republic's opening Funds on mines and Industry leaves it 6% behind in army value on turn 5 and 4% ahead on turn 10. Today it is behind on both.

<!-- widget:payback -->

**Realism.** Catalan industry was organised for war from 7 August 1936 and delivered within a few months. Two turns is one month, so this is quick. The other route, a bigger yield per level, also doubles the industry already standing and hands the Republic 10 Funds a turn.

<div class="questions" data-idea="payback"></div>

<!-- section:republic -->
## Note 11: Popular Resistance

It takes **3 off every attacker's roll** in a city the Republic holds. That is one whole odds column. A separate bonus, barricades, gives −1 to the attacker in any side's city, and it stays.

<!-- widget:city-defence -->

Where the attacker has the numbers (Asturias, País Vasco, Extremadura), taking the place becomes 10 to 15 points likelier. Madrid, Cataluña and Valencia stay near 0% at the start.

**Combined with upkeep.** In the projection, the Republic's best army on turn 10 falls from 115% of both rivals' attack together to 99%. That is the lost spam advantage. It won 10 to 16% of past computer games *with* Popular Resistance, so some compensation looks wise.

<div class="questions" data-idea="republic"></div>

<!-- section:ai -->
## Note 10: stopping a rival one step short

The computer does see a human leader. It responds by guarding, and that was on purpose: its own deciding ground counts ×4, the leader's ×2.5, and the last army on deciding ground may never leave. When the leader can win through any one of several territories, guarding can't stop it.

Main gaps found in the code (nine in `research/economy.md`, eight with a change proposed):
- Only ground the leader holds **whole** raises the alarm. Ground it is contesting counts for nothing.
- Ground a third side holds is ignored, even if the leader would win with it.
- It looks one territory ahead. You take two or three a turn.
- Gaining a foothold counts half, though one foothold takes the territory off the leader's count.
- Recruiting and building ignore the alarm completely.
- Generals and trucks next door count as threats, which pins armies against nothing.

Each change comes with a test, including one where a human leader and a computer leader produce the same orders.

<div class="questions" data-idea="ai"></div>

<!-- section:music -->
## Note 3: music

Your mix is at a good level already (−18 LUFS). Delivery is the problem. On a fast local link, **Firefox and Safari's engine downloaded all 16 MB within 20 seconds** of pressing play; Chrome took 6 MB. Splitting by track is what limits that.

| Delivery | First listen | Notes |
|---|---|---|
| One file | 6 to 16 MB | Always opens with the same 6:47 of "Shadows and Dust" |
| **Four files, fades built in** | 1.4 to 3.4 MB | Can open on any track; small change to your mix script, not yet tried |
| Decoded into memory | 16 MB, then about 500 MB of RAM | Crashes phones |

**Listen before you answer 3b.** Twenty seconds of "Unraveling", encoded straight from your original MP3. Use headphones. The Opus samples need a recent Safari.

<div class="table-wrap"><table>
<tr><th>Opus 64 (10.8 MB in all)</th><td><audio controls preload="none" src="audio-samples/unraveling-opus-64.ogg"></audio></td></tr>
<tr><th>Opus 96 (16.3 MB in all)</th><td><audio controls preload="none" src="audio-samples/unraveling-opus-96.ogg"></audio></td></tr>
<tr><th>AAC 96, for iPhone (16.2 MB)</th><td><audio controls preload="none" src="audio-samples/unraveling-aac-96.mp4"></audio></td></tr>
</table></div>

<p><small>'Unraveling-' by Scott Buckley, released under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. www.scottbuckley.com.au. Excerpted and re-encoded.</small></p>

**Credits are required.** The licence needs credit players can see, so Settings gets a Credits section, linked from the start screen.

**Volume.** Three independent sliders (Master, Music, Effects) and a mute button, in Settings and in the game menu. Music at zero also stops downloading.

<figure class="mockup"><img src="{{IMG}}r3-3-volume.webp" alt="Volume sliders in Settings and in the game menu, on desktop and phone"><figcaption>Sound controls in Settings and in the game menu, desktop and phone.</figcaption></figure>

<div class="questions" data-idea="music"></div>

<!-- section:sfx -->
## Note 3: sound effects

I found no earlier sound-effects notes in the project beyond one line about a sound at 10 seconds. Fourteen clips total 216 kB. Their licence pages were checked on 22 Nov 2026 (one was made for the game). **No one has listened to them,** so your ears decide. Some are public previews, and the originals must be fetched before shipping.

<!-- widget:sfx-board -->

**How they stay out of each other's way:**

| Rule | Detail |
|---|---|
| One action, one sound | Ordering ten armies at once plays once |
| Cooldowns | A special sound at most every 4 s; in between, a quiet tick |
| At most four at once | A more important sound replaces a lesser one; nothing queues up late |
| Always fade | Short fades in and out, so nothing clicks |
| Frequent means short and soft | Only End Turn and special moves last 2 s |
| Small variation | Slight pitch and volume changes, so repeats don't grate |
| Music dips | Only for End Turn and the battle report |
| Shared device | Every order plays the same tick, so a train whistle doesn't reveal a plan |
| Silent on purpose | Hover, scroll, zoom, select, panels, the computer's orders |
| Never the only signal | Anything you hear is also shown |

Hear the difference. Ten rail orders at once peak about 5 dB over the maximum without the rules, and 15 dB under it with them (estimated):

<!-- widget:mix-lab -->

<div class="questions" data-idea="sfx"></div>

<!-- section:bandwidth -->
## Note 3.a: bandwidth

Measured on the live site with an empty cache:

| Step | Downloaded |
|---|---|
| Start screen | 244 kB |
| Create Game | 67 kB |
| Start Campaign | 2,748 kB, of which 2,531 kB is three map pictures |
| **First visit** | **3.06 MB** |

**Already right:** compression, year-long caching of hashed files, and partial downloads. Streaming music needs no infrastructure change.

| Change | Saves on a first visit | Where |
|---|---|---|
| Load the detailed map picture on zoom | up to 1.8 MB | App |
| Split music by track | 5 to 13 MB against one file | Build, app |
| Re-encode the map pictures | about 0.8 MB, once you've looked at them | Build |
| Move the rules and computer player out of the first script | about 50 kB from the start screen (estimate) | App |
| Check the scenario at build time, not in the browser | about 40 kB (estimate) | Build |
| Leave historical notes out of the download | 11 kB | Build |
| Stop publishing source maps | nothing for players; 7 MB a release | Build |

**A size limit already exists and is already missed:** 159.4 kB against 155 kB for the first script. Nothing runs the check.

**Publishing traps to fix first:** iPhone music may get the wrong file type, and the guard that stops placeholder files being published covers only images.

**Cost:** $0 a month at 10,000 players inside CloudFront's free terabyte, which your other sites share; about $16 without it. Assumptions are in `research/bandwidth.md`.

<div class="questions" data-idea="bandwidth"></div>

<!-- section:pane -->
## Note 1: resizable pane

A grip runs down the pane's left edge. Drag it, use the arrow keys, or double-click to reset. The pane goes from 300 px up to 640 px, and the map always keeps at least 720 px. The width is remembered in the browser. On phones, the sheet has three heights: bar, half and nearly full.

<figure class="mockup"><img src="{{IMG}}r3-1-resize.webp" alt="The pane at its default, at 640 px, and at its limits on a 1280 px screen"><figcaption>Default and dragged wide at 1440; the minimum and maximum at 1280.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r3-1-phone.webp" alt="The phone sheet at its three heights"><figcaption>Phone sheet heights.</figcaption></figure>

<!-- section:markers -->
## Note 2: aircraft markers

Rev 1 drew the NATO symbol itself as the aircraft marker, at one fixed size, and it never got the card. Aircraft now use the same card as every other unit, at all three zooms. Their attack is always 0 and their defence 1, so the card prints what the squadron does. **Bug found:** fighters are tagged BOMB.

<figure class="mockup"><img src="{{IMG}}r3-2-air-cards.webp" alt="Aircraft markers today and as cards, at three zooms"><figcaption>Today on the left, the card on the right, at each zoom.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r3-2-air-states.webp" alt="Every aircraft card state"><figcaption>Every state: idle, planned, selected, grounded, stacked, enemy.</figcaption></figure>

<div class="questions" data-idea="markers"></div>

<!-- section:recruit -->
## Note 4: Recruit effects and overflow

No recruit row shows a unit's special effects today, and the hover card doesn't include them. The mock builds the wording from the scenario data. I couldn't reproduce overflowing text in the rows at normal size; what overflows is the tab strip, by 32 px at the default width. If you saw something else, a screenshot would help.

<figure class="mockup"><img src="{{IMG}}r3-4-recruit-chips.webp" alt="Recruit list today, with chips, and with fold-out lists"><figcaption>Today, chips (recommended), and the fold-out alternative.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r3-4-recruit-narrow.webp" alt="Chips at 320 px, at 150% text, and on a phone"><figcaption>At 320 px, at 150% text, and on a phone. The Hide button covering the title is an existing bug, also on the fix list.</figcaption></figure>

<div class="questions" data-idea="recruit"></div>

<!-- section:battle -->
## Note 5: battle balance sheet

Units and totals, the odds, every effect with its sign, the modifier total, the die, the final number and the result. Signs are always from the attacker's side. These are three real battles; Popular Resistance still appears in one because it is still in the game.

<figure class="mockup"><img src="{{IMG}}r3-5-ledger-busy.webp" alt="Ledger for a busy fight with an air battle, and for a three-sided fight"><figcaption>A busy fight with an air battle, and one attacker's sheet from a three-sided fight.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r3-5-ledger-options.webp" alt="Ledger for a simple fight beside the running-total alternative"><figcaption>The ledger on a simple fight, and the running-total alternative.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r3-5-ledger-phone.webp" alt="The ledger on a phone"><figcaption>On a phone.</figcaption></figure>

Every roll bonus is already recorded. Three names are vague and get fixed: which general, which aircraft, which building. What isn't recorded is why a unit's strength is what it is.

<div class="questions" data-idea="battle"></div>

<!-- section:invade -->
## Note 8: Invasion pane

Reproduced on Andalucía, turn 3. My Rev 2 fix pinned the whole odds box to the top, and that box holds an unlimited list of defenders. Two more causes: each unit card repeats the reasons it can't march or drive, and the phone sheet opens too short. Unpinning the box alone doesn't fix it.

| Whole unit cards visible, of 12 (top / scrolled) | Desktop | Phone |
|---|---|---|
| Today | 0 / 0 | 0 / 0 |
| Unpinned only | 0 / 1 | 0 / 0 |
| **A. One-line odds bar, defenders folded (recommended)** | **4 / 4** | **2 / 3** |
| B. Everything scrolls | 2 / 5 | 0 / 4 |
| C. Two tabs | 4 / 5 | 2 / 3 |

<figure class="mockup"><img src="{{IMG}}r3-8-invade-before.webp" alt="The Invade pane today, with no unit cards visible"><figcaption>Today.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r3-8-invade-recommended.webp" alt="The recommended Invade pane on desktop and phone"><figcaption>Recommended. The defenders line folds out and scrolls away.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r3-8-invade-options.webp" alt="Options B and C"><figcaption>Options B and C.</figcaption></figure>

<div class="questions" data-idea="invade"></div>

<!-- section:casualties -->
## Note 9: casualties

One running total of men lost by all sides, with the split by side on tap. Battles are public to every player, so the total gives nothing away. Today the game records men lost in battle and to the cold, but not when a unit surrenders or is disbanded, so a counter would read low until that is added.

**The top bar has to be fixed first.** It is 1,354 px wide, so at 1280 and 1024 the whole page scrolls sideways.

<figure class="mockup"><img src="{{IMG}}r3-9-casualties.webp" alt="The casualty chip at several screen widths"><figcaption>The chip at each width. The numbers are examples.</figcaption></figure>

<div class="questions" data-idea="casualties"></div>

<!-- section:pruning -->
## Code and data pruning

The code is in better shape than it feels: no unused npm packages, 0.17% duplicated lines, and no leftover blunder rules in the engine or the shipped scenario. All of the duplication is between the old dice code and the new.

| Remove now | Saves |
|---|---|
| Historical notes and source lists in the download (kept in the source) | 67.6 kB raw, 11.4 kB compressed: half the scenario file |
| 59 unused exports and 43 unused exported types, after checking the tests | about 100 lines |
| 8 unused styles, 2 unused unit icons, 1 unused screen, 4 uncited sources | small |
| Stale TODO comments, duplicate and unreferenced scripts | small |

| Your decision | Size | Why it's a decision |
|---|---|---|
| The old six-sided-die battle rules | about 1,000 lines at most | The shipped game uses the twenty-sided die, but the test helper for the Spanish map, used 205 times, still runs on the old one |
| Superseded mockups and images | about 14.7 MB of image storage | History only |

**To stop it growing back:** run the unused-code check in CI, fail a test when a scenario field has no reader, and put a size limit on the scenario file.

**Kept:** the rule options other eras would use, the published schemas and the map topology file. Of these, only the rule options are in a player's download. **Not audited:** whether some tests only cover behaviour Rev 2 removed, and the old capture scripts, which the CI work overlaps with.

<div class="questions" data-idea="pruning"></div>

<!-- section:carry -->
## Left open from Rev 2

Rail hubs stay at level 2 and the Barbastro garrison stays, with its source checked during Rev 3, unless you say otherwise.

<div class="questions" data-idea="carry"></div>

<!-- section:settled -->
## Settled unless you object

- **Pane:** left-edge grip, 300 to 640 px; three sheet heights on phones; Invade, Reinforce and Recruit open tall.
- **Aircraft** at the same airfield combine into one card at the far zoom, like ground units.
- **Battle sheet** starts closed on fights with no effects and open on the rest.
- **Shared-device games** use one plain tick for every order.
- **Popular Resistance** goes from the data; the mechanism stays for other eras.
- **Historical notes** leave the player's download and stay in the source.
- **Sound files** go in Git LFS, with a credits list players can see.
- **Bugs fixed on the way:** sideways page scroll at 1280 and 1024, fighters tagged BOMB, the overflowing tab strip, the Hide button covering titles, cards showing under the pinned Order button.

<!-- section:plan -->
## How Rev 3 would run

1. **CI first.** Several items change the Linux screenshots, so Rev 3 should start from the branch that makes the browser tests pass. That work is still running.
2. **Safe pruning,** if you agree above.
3. **Engine:** upkeep, values, Popular Resistance, casualties, battle record, with the tenets as unit tests.
4. **In parallel after that:** computer player; sound; downloads; pane and Invade; aircraft markers and Recruit; battle sheet and top bar.
5. **Your playtest,** and sims only if you allow them.

Expected cost is 2.5 to 3M tokens, a judgement from Rev 2's 3.11M for nine streams.

<div class="questions" data-idea="plan"></div>

<!-- section:unverified -->
## What nobody has checked

- **Win rates.** Nothing here predicts them, and the Rev 2 build has never had a balance run.
- **How any effect sounds,** and anything on a real iPhone.
- **Music files with built-in fades.** The script change hasn't been tried.
- **Download savings marked as estimates.**
- **Screen readers, and aircraft cards on phones or a crowded front.**
- **Some sources** (players' Hearts of Iron rules of thumb, militia pay, some sound-design articles) were seen only as search extracts.
