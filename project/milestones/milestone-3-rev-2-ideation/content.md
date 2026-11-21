<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Revision 2 · Design review</p>
<h1>Milestone 3 Rev 2 Review</h1>
<p class="meta"><span>20 Nov 2026</span><span>UI samples drawn over the live Rev 1 build</span><span>Sources: <code>project/milestones/milestone-3-rev-2-ideation/</code> on branch <code>m3r2-ideation</code></span></p>
</header>

<p class="summary-line">Your 17 notes for Rev 2, checked against the code, the 1936 record and how other strategy games handle the same problems. Most of them hold up. Two are plain bugs (notes 7 and 11). Two more (notes 1 and 14) are rules you chose in Rev 1 and now want changed. Three need reshaping before we build them: Mallorca, dug-in, and roads.</p>

**How to read this page.**
- Each note has a verdict, the evidence for it, and at most a few questions. The questions show a recommended answer, and **Use recommended for blanks** fills them all in.
- **Copy my answers** produces Markdown keyed by question id, the same as in Rev 1.
- **UI samples** are screenshots of the real app on turn 2 of a seeded game (seed 42, Republic). The new parts are mocked in the app's own styles. Numbers marked as example data are not real.
- **Sources** are in `research/history.md` and `research/design.md`, with a URL on every claim. Code findings are in `milestone-3-rev-2-probe.md` on branch `m3r2-probe`, with failing tests that pin each bug.
- **Sims.** The code probe also ran 400-game balance sims. You didn't ask for them; I added them. They're reported where they bear on a note.

**The lens I used.** The game works best when each turn is one clear decision per army, the odds can be read at a glance, and history pushes the players rather than being simulated in detail. Every new rule should force a choice the player can see. If it only adds bookkeeping, I flagged it.

<!-- section:verdicts -->
## Verdicts at a glance

| # | Note | Verdict | Size |
|---|---|---|---|
| 1 | Málaga moves through enemy ground | **Change a Rev 1 rule (P6).** Fix the rule and the map data together | M |
| 2 | North 1–2 fewer armies; no army on Mallorca | **North: yes. Mallorca: no.** A pinned garrison, not an empty island | S |
| 3 | Fighters and bombers as real units | **Yes, refined:** six orders, and one capped die bonus | L |
| 4 | Sub-territory borders past 250% | **Yes** | S |
| 5 | Per-sub-territory building lists | **Yes.** A rule in the data, with overrides | S |
| 6 | Rail as a graph | **Yes.** The largest change in Rev 2 | L |
| 6a | Roads, terrain and trucks | **Yes, reshaped:** road levels and named passes, not a road/no-road switch | L |
| 7 | Raid lines to the target sub-territory | **Bug.** Fix | S |
| 8 | Map Layers toolbar | **Yes** | M |
| 9 | Queue and progress at a glance | **Yes.** One shared queue component | M |
| 10 | "What happened" grouped by player | **Yes** | S |
| 11 | Group Replenish; select none after an order | **Bug** (selection) **plus UX** (Replenish) | S–M |
| 12 | Dug-in 1/2/3 pips, 2/4/6 on the roll | **Yes, but it softens dug-in.** Today it is 3/6/9 | S |
| 13 | Factory costs Manpower | **Yes, but it won't fix the Manpower pile-up on its own** | S |
| 14 | Contested ground clears when one side leaves | **Change a Rev 1 rule (the sweep).** Keep one safeguard | S–M |
| 15 | Orders pane and Territory Info pane | **Yes.** Keep "what I ordered" and "what is here" apart | L |
| 16 | Funds and Manpower balance view | **Yes** | M |
| 17 | More agent tooling | Three setup items worth doing; one conflicts with your M5 deferral | S |

**The thread through 1, 6, 6a, 7, 14 and 15.** Today an army stands in a *territory*, never in a sub-territory. Your notes assume armies have a place inside a territory: Málaga's regiment is "in Málaga", rail runs between sub-territories, and clicking a sub-territory opens its card. The first decision below settles how far to take that.

<!-- section:position -->
## Decision 0: where does an army stand?

**Today.** An army's position is its territory. In a contested territory it may Attack or Withdraw. A withdrawal may leave through *any* sub-territory its side holds in that territory (rule P6, `partition/paths.ts`). So the Republican regiment at Málaga walks out through Jaén or Almería, even though South-held Granada sits between them. A Rev 1 test pins this as intended.

**Options.**
- **A. Pockets (recommended).** In a contested territory only, each side's armies belong to a *pocket*: a connected group of sub-territories that side holds. An army can leave only across the borders of its own pocket. Uncontested territories work exactly as today. The scenario names each army's starting pocket, and the engine works out pockets from the map at the end of each turn.
- **B. Every army stands in a sub-territory.** This is the most faithful option, and it touches everything: combat, movement, orders, the map counters and the AI. It roughly doubles the number of places on the board, which works against the one-decision-per-army feel.
- **C. Keep territory positions.** Fix Málaga with data only.

Pockets give you the Málaga result, Oviedo under siege, and a real meaning for "cut off", without changing the game's grain everywhere else. They also give rail (note 6) a natural rule: a line runs through your pocket or it doesn't.

<div class="questions" data-idea="position"></div>

<!-- section:malaga -->
## Note 1: Málaga

**History refines this note.** From 18 August 1936 Málaga was a Republican *peninsula*, not an island. It was joined to Almería by one thin coastal road through Motril. There was no railway: Málaga's only line ran north through Bobadilla, which the Nationalists held. Floods cut the road at Motril in January 1937. The Italian corps took Ventas de Zafarraya on 6 February, overlooking the road, and Málaga fell on 3–8 February. The refugees fled east along that same road (La Desbandá).

**The game can't show that corridor.** Granada is a single South-held sub-territory, and the coast around Motril sits inside it. So with pockets, Málaga is sealed. That is too harsh, both historically and for play: the Republican player has a regiment with no way out.

**Recommendation.** Split coastal Granada, with Motril, into its own sub-territory, Republican at the start. Join it to Málaga and Almería by **road only**. That gives the Republic a corridor the South can cut, which is the real Málaga campaign. It also makes Málaga a natural first test for roads (note 6a).

<div class="questions" data-idea="malaga"></div>

<!-- section:balance -->
## Note 2: balance

**Today's armies:** Republic 16, North 14, South 9. Rev 1's 1,000-game run gave the Republic 9.6% of decided games, the North 64.8% and the South 25.6%, against a target of about 20% for the Republic (H7).

**The North. History supports a cut.** Mola was short of ammunition, not men: 26,000 rounds, against the 600,000 Franco later sent him. Serrador took the Alto del León with 200–300 men. The Sierra front then froze until 1939. Three of the North's 14 units are historically besieged garrisons: two at Oviedo, and the Simancas barracks at Gijón.

**Mallorca. History argues against removing the army.** Mallorca and Ibiza went with the rising, and Menorca stayed Republican until February 1939. About 1,500 regulars and Guardia Civil threw back Bayo's landing of about 8,000 men (16 August to 12 September 1936), with Italian aircraft arriving from 27 August. The island then served as an Italian air and naval base. Bombers from Palma flew the March 1938 Barcelona raids.

**What the sims say** (400 games each, the same seeds, blunders on):

| Variant | Republic | North | South | Median turns | Early wins |
|---|---|---|---|---|---|
| Today | 10.0% | 65.8% | 24.2% | 13 | 0 |
| North −1 (Salamanca regiment) | 12.5% | 58.8% | 28.8% | 14 | 1 |
| North −2 (+ Sierra column) | 15.8% | 56.2% | 28.0% | 14 | 0 |
| No army on Mallorca | 10.8% | 60.8% | 28.5% | 13 | 2 |
| North −2, no Mallorca | 15.8% | 54.2% | 30.0% | 15 | 5 |

**What this shows.**
- Cutting the North works. Cutting one army mostly helps the South. Cutting two gives the Republic the larger share (+5.8 points) and the South +3.8. At 400 games, differences under about 6 points are within noise, so the Republic's gain is borderline.
- Emptying Mallorca does almost nothing for the Republic. It also brings back the free sweep of the Baleares that Rev 1 closed (D23), and that is where the early wins come from.
- No unit cut reaches 20% for the Republic. That lever is the Republic's own strength (stocks, yields, AI), and it can wait for playtests.

**Recommendation.**
- **North −2,** taking out the Salamanca regiment and the Sierra column. The Sierra column is the historical one to cut: Mola's men stalled in the passes.
- **Mallorca:** keep a garrison that can't leave the island. That stops Bayo's landing from being a walkover without adding to the South's field army. Optionally, base Italian bombers at Palma, which is what the island really contributed.

<div class="questions" data-idea="balance"></div>

<!-- section:air -->
## Notes 3 and 7: fighters and bombers

**Today.** Aircraft take one order, an air mission, of four kinds: raid, intercept, support and recon. They are off the board for steps 1 to 8 (D17). A bomber flying support adds +2 to a ground battle. Fighters add nothing to a battle.

**History.** Air power decided things locally:
- the airlift of the Army of Africa (Franco "probably would have been defeated" without it);
- Guadalajara;
- Asturias (200 aircraft against 35);
- the Ebro bridges (about 500 aircraft).

Bombing cities hardened morale rather than breaking it. Interdiction of roads and bridges was the real bomber work: Guernica, and the Málaga road.

**How other games do it.**
- **Axis & Allies:** air can't take ground, a raid is that bomber's only action for the turn, and raid damage is capped.
- **Europe Engulfed:** air support is a small, capped bonus that weather can cancel.
- **Hearts of Iron IV:** air missions are flown over regions, not over individual battles.

All three agree that air shapes battles but never holds ground. The risk for us is an air subgame that muddies the turn.

**Recommendation: units you can see, with a short list of orders.**
- **On the map.** Aircraft are counters at their airfields. You select them and give orders like any unit, and the order menu shows only air orders.
- **Six orders, one per aircraft per turn:**
  - **Patrol** (fighters): air cover over a territory. It intercepts raids and cancels enemy Ground Support one for one.
  - **Ground Support** (fighters or bombers): **+3 on the d20 per aircraft unit, at most 2 per side per battle.** +3 is exactly one odds column on our table, so players will feel it.
  - **Interdict** (bombers): hit a sub-territory or a road or rail link. Enemy moves through it cost more, and units there take fatigue.
  - **Raid** (bombers): a building or port, using today's raid table.
  - **Recon:** as today.
  - **Airlift** (Ju 52 only, scenario-gated): moves one small unit between airfields.
- **Weather.** Rain and snow ground all air.
- **Air never takes or holds ground.**
- **Note 7 is a bug.** The raid line ends at the territory's label, not the target. It should end on the target sub-territory, or on the target link for Interdict.

<figure class="mockup"><img src="{{IMG}}r2-07-raid.webp" alt="A real raid on Guadalajara: the line ends on a crosshair over the outlined Guadalajara sub-territory; a faint ghost line shows today's end point"><figcaption>Note 7. The real raid on Guadalajara. The line now ends on a crosshair over the target sub-territory. The faint line shows where it ends today.</figcaption></figure>

<div class="questions" data-idea="air"></div>

<!-- section:transport -->
## Notes 6 and 6a: rail and roads as a network

**Today.**
- Rail is a level from 0 to 3 on each sub-territory. Any two bordering sub-territories that both have rail are joined, and range is 2 × the lowest level on the route.
- There are no roads at all. A one-territory step always fits, so mountains only stop the second step of a truck move. You're right that the north is too cheap to cross.

**History strongly supports a graph.**
- The 1936 network was radial around Madrid, with clear junctions: Medina del Campo, Venta de Baños, Miranda, Alcázar de San Juan, Linares-Baeza, Bobadilla, Zaragoza.
- It had dead ends and single links:
  - Cuenca stopped at Aranjuez.
  - Galicia's only link to the Meseta ran through León until 1958.
  - The Cantabrian coast was joined east to west only by narrow gauge.
  - Despeñaperros was the one Sierra Morena pass, for both road and rail.
- `research/history.md` has a province-to-province rail table rated by confidence, which is a starting graph to check.

**Roads.** One part of 6a needs reshaping. In 1936 roads ran almost everywhere at *some* quality. The strategic barriers were a handful of mountain passes, not missing roads. A strict "no road, so infantry only" border would be rare on a Spanish map. The thing that slowed armies was the pass. So the edge should carry the pass, not a yes or no.

**Recommendation: one link type, three move modes.**
- **Data.** Each border between two sub-territories gets one link record: a road level (none, track or main), a rail level (none, single or main), and an optional named obstacle (a pass or major river) with its cost. It lives in the scenario's map data, so the Seven Years' War or WW1 can set different conditions.
- **March** (any unit): one territory. Across a link with no road, infantry only. **Crossing a named pass takes an extra turn,** as marked on the images below, and Motor moves can't use passes. Defenders holding the far side of a pass get a bonus, as on the Guadarrama front, and at El Mazuco where 5,000 men held for 33 days.
- **Motor** (units moving with a truck unit): up to two territories along **main roads**, never into contested ground, capped by the number of trucks. This is your "road plus trucks acts like rail".
- **Rail** (as today, on the graph): the route must follow rail links through sub-territories your side holds. Range is set by the weakest link. Laying a new line takes many turns. The Republic's 91 km bypass line (the Vía Negrín, Torrejón to Tarancón) was a major wartime project. Upgrading an existing line is cheaper.
- **The planner does the pathfinding.** Select a unit and the reachable territories light up, with a reason on each one that isn't reachable. No player should trace routes by hand.
- **Keep your rail drawing exactly as it is.** Roads are quieter lines, and passes get a glyph.

**Your example.** If Madrid joins Toledo, and Toledo joins Extremadura and Valencia, a train from Madrid can't reach Andalucía. That is exactly what the graph gives. Historically, though, Madrid did reach Andalucía, through Alcázar and Despeñaperros.

<figure class="mockup"><img src="{{IMG}}r2-06-graph.webp" alt="Rail drawn as today plus main roads (thin brown), minor roads (dashed) and pass glyphs, at 150%"><figcaption>The network at 150%. Rail is drawn exactly as today. Main roads are thin brown lines, minor roads are dashed, and costly passes have a glyph. Illustrative 1936 data.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-06-passes.webp" alt="Cantabrian range at 275% with named passes marked +1 turn and red crosses on links with no road"><figcaption>The Cantabrian range at 275%. Named passes (Pajares, Reinosa, Escudo, Orduña, Piedrafita, Padornelo) are marked, and red crosses show links with no road (infantry only). Illustrative data.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-06-reach.webp" alt="A real Move order from Valencia: rail highlighted only along connected Republic-held links to Barcelona and Murcia; cut lines dashed red with callouts"><figcaption>A real Move order from Valencia. Only connected links through Republican ground light up: Barcelona and Murcia are in reach. Callouts say why Almería (the line runs through South-held Granada) and Madrid (cut at Albacete) are not.</figcaption></figure>

<div class="questions" data-idea="transport"></div>

<!-- section:digin -->
## Note 12: dug-in

**Today it is stronger than you think.** Works grow by 3 each quiet turn, up to 9, and the counter shows the works value itself. So players see 3, 6 or 9 pips and "Dug in +9", and the attacker's roll drops by that much. **Your 2/4/6 would soften entrenchment, not strengthen it.** Please check this against what you've seen on screen.

**Odds on today's table** (the chance that the attacker takes *all* the ground):

| Defender's works | 2:1 | 3:1 | 4:1 |
|---|---|---|---|
| None | 35% | 50% | 65% |
| Today, full (−9) | 0% | 5% | 20% |
| Today, full, in a Republican city (−13) | 0% | 0% | 0% |
| Yours, full (−6) | 5% | 20% | 35% |
| Yours, full, in a Republican city (−10) | 0% | 0% | 15% |

**History favours the softer values.** Bilbao's Iron Belt fell in under two days to about 150 guns plus aircraft. Madrid held through numbers and street fighting, not prepared works. The Ebro ridges were too rocky to dig. Today's −9 is a WW1 stalemate engine in a war of manoeuvre. The sims show 2/4/6 doesn't move the balance, and games end about a turn sooner.

**Recommendation.**
- Make your change: pips 1, 2 and 3; the roll takes −2, −4 and −6.
- Cap works by terrain: level 3 only in mountains and cities, level 2 elsewhere.
- Ground Support (note 3) gives attackers a real counter, as flanking and artillery do in WW1 designs like Paths of Glory.
- The Fortifications building currently gives only +1, which is less than one quiet turn of digging. Make it start a garrison at works level 1 and raise its cap by one.

<div class="questions" data-idea="digin"></div>

<!-- section:control -->
## Note 14: contested ground

**Today.** A territory stays contested while two or more factions hold sub-territories in it, whether or not anyone has armies there. Where only one side has armies, it takes one enemy sub-territory per turn. That "sweep" was your Rev 1 rule (Q-MR-21). Both failures you describe are confirmed by tests:
- after the Republic withdraws from Andalucía, the territory stays contested;
- when the attacker is destroyed, the territory stays contested.

**Other games agree with you.**
- Axis & Allies: control goes to whoever has surviving land units, and if both sides are wiped out, the defender keeps it.
- Paths of Glory: control changes when units enter, not when they retreat.

**Recommendation.** Work out "contested" at the end of each turn from **whose ground armies are present**. If only one side has armies there, every sub-territory flips to it. Keep two safeguards:
- **If both sides are wiped out,** the holders keep what they held.
- **Aircraft never count.**

The sweep was also pacing the game. Losing it may bring back early wins. The main risk is turn 1: if any territory starts contested with one side holding sub-territories but no army there, it flips at once. Rev 1's garrisons (D30) were added to close exactly that gap, so Rev 2 checks every starting contested territory before this ships.

<div class="questions" data-idea="control"></div>

<!-- section:economy -->
## Notes 5 and 13: what can be built where, and factory Manpower

**Note 5. Today** any sub-territory can build a port, inland Madrid included. Only the max level is checked. Industry needs a city, and the Factory needs the capital and a city.

**History.** The ports and arms industry were on the coasts and in the north: Cataluña, Vizcaya and Gipuzkoa, Asturias, Cartagena, Ferrol. Madrid is inland.

**Recommendation.** Write the rule into the data (a port needs a coast, a factory needs a city) and allow per-sub-territory overrides. A rule carries over to other eras; an override handles the odd case.

**Note 13. History supports it.** Catalonia's war industry employed 50,000 to 80,000 people, and conscription competed with the factories for them. Your idea creates a real choice between the factory and the front. **But** the AI builds almost no factories (0.01 to 0.06 a game), and it spends only 30–60% of its Manpower. A factory cost alone won't fix the Manpower pile-up from the Rev 1 sitrep. In the sim, factories took 0.1% of Manpower.

**Recommendation.** Add a one-time Manpower cost, and in Rev 2 also teach the AI to buy factories, so the cost actually bites. An upkeep cost is more historical, but it adds a ledger line to every turn. Keep it in reserve.

<div class="questions" data-idea="economy"></div>

<!-- section:map -->
## Notes 4 and 8: what the map shows

**Note 4.** No zoom level draws sub-territory borders today. Only contested territories get a fill and hatch. Past 250%, draw every sub-territory border and name. Tie this to a Map Layers switch, so players can turn it off.

<figure class="mockup"><img src="{{IMG}}r2-04-zoom-225.webp" alt="225%: today's map, sub-territories only in contested ground"><figcaption>At 225%, just below the line: the app as it is today.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-04-zoom-275.webp" alt="275%: dashed sub-territory borders and names everywhere"><figcaption>At 275%: dashed sub-territory borders and names everywhere.</figcaption></figure>

**Note 8.** No layer controls exist today. Two designs:

<figure class="mockup"><img src="{{IMG}}r2-08-layers-a.webp" alt="Option A: a Layers toolbar along the bottom of the map with nine toggles"><figcaption><b>A. A toolbar along the bottom</b> with nine toggles: Sub-territories, Rail, Roads, Weather, Order lines, Supply, Contested, Battles, Labels. Every switch is in view, but nine is a lot of chrome.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-08-layers-b.webp" alt="Option B: a Layers button opening a popover with presets and switches"><figcaption><b>B. One Layers button</b> with three presets (Orders, Logistics, Economy) and the switches beneath. Here Logistics is on, so order lines are hidden.</figcaption></figure>

**Recommendation.** A, as you asked, but with B's three presets as the first three buttons, and the nine switches folded into a "More" menu at the end of the bar. Presets answer "what am I doing now"; individual switches are for fine-tuning. Also switch layers automatically while an order is being given: choosing a Rail move turns the Rail layer on.

<div class="questions" data-idea="map"></div>

<!-- section:pane -->
## Notes 9 and 15: the Orders pane and Territory Info

**Today.** The right pane is `OrdersScreen`: a "Selected territory" section (with Units, Build and Recruit tabs), then "Your orders". "Your orders" lists only moves and withdrawals. Builds, recruits, Replenish and air missions show up only where they were planned. Build cards already have progress bars, but recruit training is text only. Clicking a sub-territory focuses it only on the second click.

**History and design.** Paradox games keep the outliner ("what I've ordered") separate from the province window ("what is here"). Your note draws the same line. My concern is weight: four tabs, plus group-by modes, plus expandable cards, is a lot for one pane. The fix is **one queue component used everywhere**: the Orders list, the Buildings cards and the Recruit tab.

<figure class="mockup"><img src="{{IMG}}r2-15-orders-by-type.webp" alt="Orders mode grouped by type: unit orders, air missions, recruits, builds with progress bars, and the spend"><figcaption><b>Orders mode, by type.</b> Every order and project this turn, with the spend. The orders are the real draft.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-15-orders-by-region.webp" alt="The same orders grouped by region"><figcaption>The same orders, grouped by region.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-15-info-buildings-a.webp" alt="Territory Info for Cataluña with an Orders back control, four tabs, Girona's card open with build options"><figcaption><b>A. The pane switches.</b> Zoomed in, clicking Girona opens <i>Cataluña</i> on the Buildings tab with Girona's card open, and an "← Orders 6" link back.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-15-info-switch-b.webp" alt="Option B: two persistent tabs at the top of the pane, Orders 6 and Cataluña"><figcaption><b>B. Two lasting tabs</b> at the top of the pane: "Orders 6" and the territory's name.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-15-info-production-a.webp" alt="Production tab: Funds and Manpower by sub-territory summing to the territory's income"><figcaption>The Production tab shows where Cataluña's +3 Funds and +6k Manpower come from, sub-territory by sub-territory. The "Coming up" rows are example data.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-09-queues.webp" alt="Recruiting and building queues with progress bars, turns left and Next"><figcaption><b>Note 9.</b> Recruiting gets the same bar, turns left and "Next" as building. The queued "Next" recruit is example data.</figcaption></figure>
<div class="phone-row"><figure class="mockup"><img src="{{IMG}}r2-15-phone-info-a.webp" alt="Phone: Territory Info sheet with back link, title and four tabs"><figcaption>Phone, option A. Four tabs still fit. Girona's open card is below the fold.</figcaption></figure></div>

**Recommendation.** **A** on phone, where there's no room for two tab rows. **B** on desktop, so Orders is always one click away and you can see which mode you're in.

<div class="questions" data-idea="pane"></div>

<!-- section:report -->
## Note 10: "What happened" by player

Today the summary is grouped by kind of event (battles, air, recruiting, building). Grouping by faction first, with the existing groups inside each, matches how a Diplomacy table reads results: power by power. Put your own faction first.

<figure class="mockup"><img src="{{IMG}}r2-10-report.webp" alt="Turn 2 What happened regrouped by Republic, North, South"><figcaption>The real turn 2 report, regrouped by player, with the existing groups inside each.</figcaption></figure>

<div class="questions" data-idea="report"></div>

<!-- section:replenish -->
## Note 11: Replenish and the selection

**Bug, confirmed.** After any order, the selection resets to every unit that has no order. After Entrench, the unit you just entrenched is selected again. It should be **none**.

**Replenish.** It is offered only when *every* selected unit is below strength, so one full unit in a group hides the button. Both designs below apply it to the eligible units and say which ones were skipped, and why.

<figure class="mockup"><img src="{{IMG}}r2-11-replenish-a.webp" alt="Option A: one Replenish selected action listing skipped units and reasons"><figcaption><b>A. One action for the selection:</b> "Replenish selected (9 Funds · 1k)", naming the skipped units. Strengths and costs are example data.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-11-replenish-b.webp" alt="Option B: Replenish checkbox column with a running total"><figcaption><b>B. A Replenish column</b> of checkboxes in the unit list, with a running total.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-11-replenish-after.webp" alt="After the order: 0 of 5 selected, units read Replenishing"><figcaption>After the order: nothing is selected, and the units read "Replenishing".</figcaption></figure>

**Recommendation: A.** It works the same way as every other order: select, then act. B adds a second, parallel way of selecting.

<div class="questions" data-idea="replenish"></div>

<!-- section:ledger -->
## Note 16: the balance view

Today, clicking a chip shows totals only. The data for per-territory rows already exists (`incomeFor`, `subTerritoryYield`), and contested territories pay nobody. Victoria 3 treats nested breakdowns as essential, and ends on a total that matches the headline number.

<figure class="mockup"><img src="{{IMG}}r2-16-funds.webp" alt="Funds balance: one row per territory, contested rows with deduction, total matching the chip"><figcaption>Funds: territories held whole first, then contested ones ("Andalucía +1 −1 contested = 0"). The +12 total matches the chip.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-16-manpower.webp" alt="Manpower balance"><figcaption>The same balance for Manpower.</figcaption></figure>
<div class="phone-row"><figure class="mockup"><img src="{{IMG}}r2-16-phone-funds.webp" alt="Funds balance on a phone"><figcaption>Funds on a Pixel 7.</figcaption></figure></div>

**Recommendation.** Add expense rows below the territories (builds under way, Replenish, upkeep if note 13 adds it), so the view answers "where did my money go", not only "where did it come from".

<div class="questions" data-idea="ledger"></div>

<!-- section:tooling -->
## Note 17: tools for building the game

A Claude Code docs agent checked these against current documentation; details are in `research/tooling.md`. Ranked by payoff for how we work:

1. **A TypeScript language-server plugin.** Install `typescript-language-server`, then run `/plugin install typescript-lsp@claude-plugins-official`. Agents get go-to-definition, find-references and type errors after each edit, so they read fewer whole files. This targets the 290k-token reviewers.
2. **A diff-scoped reviewer agent,** in `.claude/agents/`. It is handed a diff and a file list and doesn't range beyond them. It replaces "read the whole codebase" reviews.
3. **Hooks** in `.claude/settings.json`: block bare `git stash` (a fixer broke that rule in Rev 1), and run lint after edits.
4. **Project skills** for the routines we repeat: running sims, regenerating screenshots, and merging a slice and removing its worktree.
5. **About 40 lines of project rules in `CLAUDE.md`.** Your infra commit added a `CLAUDE.md`, but it holds only AWS guidance. Your memory notes don't reach sub-agents, and CLAUDE.md does. Today the stash rule, the worktree rule and the screenshot SOP never reach the workers. **Adding project rules brings forward part of your M5 deferral,** so it's your call.
6. **Optional:** Playwright MCP. Our e2e capture already covers most of what it would add. Skip GitHub MCP; `gh` does the job.

<div class="questions" data-idea="tooling"></div>

<!-- section:carry -->
## Carried over from Rev 1, and the order of work

**Required before anything deploys.**
- CI's `verify` job runs the Linux visual baselines, which Rev 1 left stale. Deploy depends on `verify`, so nothing ships until they are regenerated.
- The production smoke test still expects 35 unit counters. Rev 1 added generals and aircraft, so it will fail after a deploy.
- Branch coverage is 93.39%, against a 93% gate. Rev 2's new rules need their tests written as they go.
- Add `infra/**` and `.claude/**` to vitest's exclude list.

**Rev 1 decisions these notes settle.**
- **The balance lever:** note 2.
- **Manpower piling up:** note 13, partly.
- **D17 (aircraft are never ground combatants):** kept, by note 3.
- **D27.2 and D27.3 (air):** replaced by the six orders.
- **D5, D6 and the rest of D27 and D28:** still open.

**Suggested order.**
1. **Data and fixes:**
   - the pockets model;
   - the link data and the Granada split;
   - the building rules;
   - the bug fixes for notes 7, 11 and 14;
   - the CI baselines and the smoke test.
2. **Rules:**
   - rail and Motor moves on the graph;
   - dug-in;
   - air orders;
   - army cuts and the Mallorca garrison;
   - factory Manpower.
3. **UI:**
   - the pane split and the shared queue component;
   - map layers;
   - the balance view;
   - the report grouping;
   - Replenish.

Rules come before UI because the pane, the layers and the balance view all show what the rules produce. Building them first means building them twice.

<div class="questions" data-idea="carry"></div>
