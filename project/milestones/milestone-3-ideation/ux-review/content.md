<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Step 3 of 4 · UI pass</p>
<h1>Milestone 3 UX Options</h1>
<p class="meta"><span>19 Nov 2026</span><span>Captured from the running app (Revision 7 build)</span><span>Sources: <code>ux-pass/</code> on branch <code>m3-ideation</code></span></p>
</header>

<p class="summary-line">Each image is a screenshot of the real app with the new UI added on top, using the app's own styles. All the images share one mock world, so every option is shown next to the other new features.</p>

**How these were made.**
- A script starts the game, adds the mock UI to the live map and the Orders pane, and captures each option at 1440 × 800 (desktop) and as a Pixel 7 (phone).
- The province borders are real (geoBoundaries ADM2, in the map's own projection). Baleares is split by island. The Asturias and Madrid splits are not drawn.
- The mock world is **Turn 7, Late October 1936, from the Republic's seat**, drawn over the real turn-1 armies.
- **The battle images sit on whatever turn 1 actually resolved,** so their battles differ from one capture to the next.
- **Every number is example data:** costs, yields, odds and weather.

**Defaults.** Each image changes one feature and leaves the rest at these defaults:
- resources in the header;
- sub-territories shown only where a territory is contested;
- every rail line drawn;
- the tabbed territory pane;
- the list-style recruitment panel.

<figure class="mockup"><img src="{{IMG}}ux-world.webp" alt="The mock world: header with timer, Funds and Manpower, readiness chips; map with rail and contested provinces; Cataluña's pane with Units, Build and Recruit tabs"><figcaption>The mock world at its defaults. Header: timer, Funds and Manpower, and readiness chips (the computer players are always ready). Map: rail, and provinces drawn in the six contested territories: Asturias (with an illustrative Oviedo pocket), País Vasco (Álava), Aragón, Extremadura, Baleares and Andalucía. Pane: Cataluña with its weather and next turn's forecast, its income, and three tabs.</figcaption></figure>

<!-- section:interpret -->
## First, five readings of your answers

The stack designs below depend on these readings. Correct any that are wrong before judging the images.

<div class="questions" data-idea="interpret"></div>

<!-- section:header -->
## Header: date, timer, resources, readiness

- **The date** reads "Turn 7 · Late October 1936".
- **The timer** is the dark chip.
- **Readiness:** the faction chips show who is planning and who is ready. Computer players are always ready.
- **Short names:** on desktop the chips switch to REP, NIC and SIC, so everything fits on one line.

<figure class="mockup"><img src="{{IMG}}ux-header-a.webp" alt="Option A: Funds and Manpower chips in the header beside the timer"><figcaption><b>A.</b> Funds and Manpower in the header, each with next turn's income. They are always visible, on every screen.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-header-b.webp" alt="Option B: Funds and Manpower as a ledger at the top of the Orders pane"><figcaption><b>B.</b> Only the timer stays in the header; the balances sit at the top of the pane. The header is lighter, but the balances disappear whenever the pane is hidden.</figcaption></figure>

<div class="questions" data-idea="header"></div>

<!-- section:subterr -->
## Sub-territories on the map

<figure class="mockup"><img src="{{IMG}}ux-subterr-a.webp" alt="Option A: contested territories show province fills in each holder's colour with faint diagonal lines"><figcaption><b>A. Provinces only where contested.</b> In a contested territory, each province takes its holder's colour, and faint diagonal lines keep the "contested" cue. Territories held whole stay one clean colour.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-subterr-a-zoom.webp" alt="Option A zoomed on Andalucía: province names, capital star, Republican Málaga, Jaén and Almería"><figcaption>A, zoomed on Andalucía: province names and the capital's star appear. Málaga, Jaén and Almería are Republican; the other five provinces are Southern.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-subterr-b.webp" alt="Option B: faint dotted province borders everywhere, fills where contested"><figcaption><b>B. Provinces everywhere.</b> As A, plus faint dotted province borders inside every territory. You can see where development lives, at the cost of more lines.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-subterr-c.webp" alt="Option C: today's hatch kept, with a small split bar under each contested territory's name"><figcaption><b>C. Keep today's hatch.</b> Contested territories keep their stripes and gain a small bar showing the split. Provinces appear only when you zoom in on a territory (next image).</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-subterr-c-zoom.webp" alt="Option C zoomed: provinces and a heavy front line between holders"><figcaption>C, zoomed in: the provinces appear, and a heavy line marks the front where the two holders meet.</figcaption></figure>

<div class="questions" data-idea="subterr"></div>

<!-- section:pane -->
## The territory pane: units, builds and recruiting

Your note asked for options. A territory now has three things to order: its units, each sub-territory's build queue, and recruiting at the capital.

<figure class="mockup"><img src="{{IMG}}ux-pane-a-units.webp" alt="Option A: tabs Units, Build, Recruit; Units tab with a general, fatigue and demoralized pills, and a unit in training"><figcaption><b>A. Tabs:</b> Units, Build and Recruit. The Units tab shows a general, a fatigued unit, a demoralized unit, and a regiment in training (dashed).</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-pane-a-build.webp" alt="Option A Build tab: sub-territory cards with development pips, buildings and queues"><figcaption>A, the Build tab: one card per sub-territory showing:
<ul>
<li>development levels (Industry, Farms, Mines, Rail, Port);</li>
<li>buildings;</li>
<li>the queue: the build in progress has a bar, and the next one waits.</li>
</ul></figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-pane-b.webp" alt="Option B: one scroll with Units, Sub-territories and Recruit sections"><figcaption><b>B. One scroll</b> with sections that open and close. Everything is in one place, but the pane gets long.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-pane-c.webp" alt="Option C: sub-territory cards first with Build and Recruit buttons, units below"><figcaption><b>C. Sub-territories first.</b> Each card has its own Build button, and the capital's card also has Recruit. Units come below. The economy leads, and the armies are further down.</figcaption></figure>
<div class="phone-row"><figure class="mockup"><img src="{{IMG}}ux-phone-pane-a.webp" alt="Phone, option A: bottom sheet with tabs"><figcaption>Phone, A: the tabs fit, but the sheet shows about one card.</figcaption></figure><figure class="mockup"><img src="{{IMG}}ux-phone-pane-b.webp" alt="Phone, option B: bottom sheet with sections"><figcaption>Phone, B: sections in a short sheet mean a lot of scrolling.</figcaption></figure></div>

<div class="questions" data-idea="pane"></div>

### Focusing one sub-territory

<figure class="mockup"><img src="{{IMG}}ux-pane-focus.webp" alt="Zoomed on Cataluña with Barcelona outlined; the pane shows Barcelona with a back link, its card, and build options"><figcaption>Zoom in and click Barcelona: the same pane, focused on it, with "← Cataluña" to go back. Below its card, "Add to the queue" lists what it can build. Options that can't be built say why (for example, "max level is 3").</figcaption></figure>

<div class="questions" data-idea="focus"></div>

<!-- section:orders -->
## Orders in contested ground, and Replenish

<figure class="mockup"><img src="{{IMG}}ux-orders-contested.webp" alt="Andalucía: contested pills, a unit attacking by default with fatigue, a demoralized militia holding, and the order menu with Attack and Withdraw, the rest greyed out"><figcaption><b>Contested ground.</b>
<ul>
<li>Pills say what contested means here: no income, builds paused, no recruiting.</li>
<li>Units attack by default and gain fatigue.</li>
<li>A demoralized unit holds, and says it has no general to rally it.</li>
<li>The menu offers only Attack (the default) and Withdraw, which names the route through your own sub-territories. Move, Entrench, Rest and Replenish are greyed out with the reason.</li>
</ul></figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-orders-replenish.webp" alt="Cataluña: the Durruti Column 700 men short, with the order menu showing Replenish with its men, cost and the cancel rule"><figcaption><b>Replenish.</b> A unit below strength says how many men it is short. Replenish shows the men it brings, what it costs and when they arrive, and that it is cancelled (and refunded) if the unit fights.</figcaption></figure>

<div class="questions" data-idea="orders"></div>

<!-- section:recruit -->
## Recruiting

Every unit type is listed. A type you can't train yet is greyed out and says what it needs; hovering adds the details.

<figure class="mockup"><img src="{{IMG}}ux-recruit-a.webp" alt="Option A: a list of unit types with values, costs, quantity steppers, locked rows with reasons, and a hover tooltip"><figcaption><b>A. List.</b> Each row shows values, cost, training time and a quantity. Locked rows give the reason inline. The basket line shows what this turn costs and what is left.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-recruit-b.webp" alt="Option B: a grid of unit type cards, locked ones dimmed with a lock"><figcaption><b>B. Grid of cards.</b> Compact and easy to scan by symbol. Costs and reasons appear on hover or tap.</figcaption></figure>
<div class="phone-row"><figure class="mockup"><img src="{{IMG}}ux-phone-recruit-a.webp" alt="Phone: recruitment list in the bottom sheet"><figcaption>Phone, A: the list is readable, but the locked reasons wrap.</figcaption></figure></div>

<div class="questions" data-idea="recruit"></div>

<!-- section:move -->
## Moving units: weather, terrain, rail and odds

Four units are leaving Madrid; under the new rule, units leaving one territory with the same order form one army for the turn. A summary at the top shows the army and its moves left. Each destination shows its weather; the map chips show it too.

<figure class="mockup"><img src="{{IMG}}ux-move-a.webp" alt="Option A: destination rows with weather, mountain entry and fatigue chips; rail destinations added"><figcaption><b>A. Chips on every destination:</b>
<ul>
<li>weather;</li>
<li>"Mountain entry (Ávila) · last move";</li>
<li>"Fatigued −2 on 1 unit";</li>
<li>rail destinations ("By rail · Reinforce" to Valencia, "Rail, then attack" to Aragón), drawn as dashed lines on the map.</li>
</ul></figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-move-b.webp" alt="Option B: the focused destination opens a card listing every modifier and the forecast"><figcaption><b>B. A card for the destination you hover over or tap.</b> It lists every modifier and its value: odds, the below-1:1 penalty, fatigue, the general, weather, and the chance to take ground. It also says that mountain entry ends the move, and gives next turn's forecast.</figcaption></figure>
<div class="phone-row"><figure class="mockup"><img src="{{IMG}}ux-phone-move-a.webp" alt="Phone: while choosing a destination the sheet folds away; odds chips carry weather"><figcaption>Phone: while you choose a destination, the sheet folds away (as it does today). So on a phone, the map chips are where weather and rail must show.</figcaption></figure></div>

<div class="questions" data-idea="move"></div>

<!-- section:rail -->
## Rail

Rail belongs to sub-territories, as you asked:
- **Stations:** each province with rail has a station square; bigger squares are higher levels.
- **Lines:** adjacent rail provinces join with a thin curve. Level 2 and up get cross-ties and a heavier line.

<figure class="mockup"><img src="{{IMG}}ux-rail-a.webp" alt="Option A: every rail connection drawn at overview"><figcaption><b>A. Every line, always.</b> Complete, but busy at full-map zoom.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-rail-a-zoom.webp" alt="Option A at operational zoom over the Meseta"><figcaption>A at operational zoom, which reads well at this scale.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-rail-b.webp" alt="Option B: only level 2 and 3 lines at overview"><figcaption><b>B. Main lines only at full-map zoom</b> (levels 2–3); every line once you zoom in.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-rail-c.webp" alt="Option C: rail hidden until units are selected; the Republic's reachable network shown in blue"><figcaption><b>C. On demand.</b> Rail is hidden until you select units; then the network they can ride (provinces your faction holds) lights up in blue.</figcaption></figure>

<div class="questions" data-idea="rail"></div>

<!-- section:battle -->
## Battle results on the d20

Only the column for this battle's odds is shown, as you asked. The die, every modifier and the final score come first.

<figure class="mockup"><img src="{{IMG}}ux-battle-a.webp" alt="Option A: a 20-cell strip coloured by grade with the score outlined"><figcaption><b>A. Strip.</b> Twenty cells coloured by grade, with the score outlined and a key underneath. You see the spread at a glance, but you have to decode the colours.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-battle-b.webp" alt="Option B: grade bands with score ranges and their effects, the hit band outlined"><figcaption><b>B. Bands.</b> One row per grade: its score range, its name, and what it does. The band that was hit is outlined.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-battle-icon.webp" alt="Hovering a battle icon on the map shows a tooltip naming the result"><figcaption>Your missing note: hovering over a battle icon on the map names its result, and clicking opens the battle card.</figcaption></figure>

<div class="questions" data-idea="battle"></div>

<!-- section:air -->
## Air

<figure class="mockup"><img src="{{IMG}}ux-air-a.webp" alt="Option A: aircraft counters at airfields, range ring, raid arrow to Sevilla, mission buttons in the pane"><figcaption><b>A. Counters on the map.</b> Aircraft sit at their airfields:
<ul>
<li>selecting one shows its range ring and mission buttons;</li>
<li>a raid shows its target, its modifiers and the four outcome chances;</li>
<li>a red arrow on the map marks the raid on Sevilla.</li>
</ul></figcaption></figure>
<figure class="mockup"><img src="{{IMG}}ux-air-b.webp" alt="Option B: an Air list in the pane with every aircraft's mission"><figcaption><b>B. One Air list</b> with every aircraft and its mission; arrows on the map show where each one goes. Assigning missions is quicker, and you see less of where each aircraft can reach.</figcaption></figure>

<div class="questions" data-idea="air"></div>

<!-- section:setup -->
## Setup: the turn timer

<figure class="mockup"><img src="{{IMG}}ux-setup-timer.webp" alt="Setup screen with a Turn timer choice: Off, 1, 5, 10 minutes, and 30 min and 1 h disabled as online"><figcaption>Setup screen: a turn timer with Off, 1, 5 and 10 minutes. 30 minutes and 1 hour are shown greyed out, for online play later. One line explains how the timer works.</figcaption></figure>

<div class="questions" data-idea="setup"></div>

<!-- section:phone -->
## What the phone captures show

- **The header takes three rows:** the timer and the two resources, then the readiness chips.
- **The territory sheet shows about one card** below the territory header.
- **Choosing a destination folds the sheet away,** so the map chips carry all of the move information.

<div class="questions" data-idea="phone"></div>

<!-- section:singles -->
## Single designs to approve

Each of these has one design in the images above.

<div class="questions" data-idea="singles"></div>

<!-- section:notmocked -->
## Not mocked in this pass

- **The hot-seat handoff screen.** With balances hidden, it must not show the previous player's Funds. That needs no new design.
- **Generals:** the roster screen and the sacking order. Only the general badge on a unit appears above.
- **Recon results:** the enemy balances and queues a recon flight reveals.
- **The simulation harness output.** It is JSON only, so there is no UI.
- **Timer details:** the Pause button (local play), the 1-minute and 10-second warnings, and the "time ran out" line in the turn results.

