<!-- section:intro -->
<header class="masthead">
<p class="eyebrow">Milestone 3 · Revision 2 · Close-out</p>
<h1>Rev 2 Close-out</h1>
<p class="meta"><span>21 Nov 2026</span><span>Final pass before implementation</span><span>Sources: <code>project/milestones/milestone-3-rev-2-ideation/</code> on branch <code>m3r2-ideation</code></span></p>
</header>

<p class="summary-line">Your 25 answers are locked in below as rules with numbers. This pass does three things: it redraws the screens around your point that orders shouldn't live inside one crowded pane, it pins down the mechanics your notes left open (the air battle, passes, and pockets), and it asks the last 9 questions before we build.</p>

**How to read this page.**
- **Locked** means decided. It's listed so you can catch a misreading, not to re-open it. If something is wrong, say so in the last question's notes.
- **UI samples** are the live game on turn 2 (seed 42, Republic) with the new parts mocked in the app's own styles. Example numbers are illustrative.
- **Your answers** are saved verbatim in `answers-r2.md`. Where a note overrode the option you ticked, the note wins, and that file says so row by row.
- No sims were run for this pass.

<!-- section:locked -->
## Locked decisions

| Area | Decided rule |
|---|---|
| **Where armies stand** | **Pockets.** In a contested territory, each side's armies belong to a connected group of sub-territories that side holds. They leave only across that group's borders. Uncontested territories work exactly as today. |
| **Málaga** | **Sealed: it leaves by sea only.** Pockets close the Rev 1 withdraw path (P6) through Jaén and Almería. **But I checked, and today its only sea lane is the Alboran Sea to Melilla, which the South holds.** As the data stands, "sealed" means stuck. See the question just below. |
| **North** | **Two fewer armies:** the Salamanca regiment and the Sierra column. Mallorca keeps today's army. Target about 15% Republic wins for now, and revisit after playtests. |
| **AI blunders** | **Removed entirely.** That covers `blunder.ts`, `blunderChance` in the schema and scenario, the coordinator's blunder roll stream, and the scenario note. |
| **Air orders** | **Four orders: Patrol, Ground Support, Raid, Recon.** No Airlift and no Interdict. Aircraft are counters at their airfields that you select and order like other units. Rain and snow ground all air. Air never takes or holds ground. |
| **Ground Support** | +3 per aircraft unit, at most 2 per side, and **only one side ever gets it.** The air battle below decides which side. |
| **Links** | **One record per pair of bordering sub-territories:** a road level (none, track or main), a rail level (none, single or main), and a list of **modifiers** that the scenario defines. |
| **Move modes** | **March:** one territory; only infantry can cross a link with no road. **Motor:** two territories along main roads, with trucks. **Rail:** along the rail graph, through ground your side holds, with range set by the weakest link. |
| **Passes** | **No extra turn.** No Motor moves across a pass. Defenders beyond a pass get a bonus (exact rule under **Moving**). |
| **Rail building** | New lines (many turns) and upgrades (cheaper). |
| **Map data** | The researched 1936 table, with every inferred or unknown link checked against a period map before shipping. **Each sub-territory lists its buildable buildings explicitly.** No rule-based defaults. |
| **Dug-in** | Pips 1/2/3; the roll takes −2/−4/−6; level 3 is allowed everywhere. Fortifications stay at +1. |
| **Factory** | A one-time cost of about 6 Manpower. The AI learns to build factories, and **the AI must use every action in the game** (coverage table below). |
| **Contested ground** | At the end of each turn, if only one side has ground armies in a territory, all of its sub-territories flip to that side. If both sides are wiped out, holders keep what they held. Aircraft never count. Every starting contested territory gets checked against the turn-1 flip. |
| **Map** | Sub-territory borders show past 250% zoom. The Map Layers toolbar has three presets (Orders, Logistics, Economy) plus a More menu, and layers switch on automatically while you give an order. |
| **Bugs** | Raid lines end on the target sub-territory. After an order, the selection resets to none. |
| **Replenish** | One action for the whole selection, naming any skipped units and why. |
| **Turn report** | Grouped by faction, your own first. You can bring back last turn's report while planning. |
| **Balance view** | One flat list of rows. A contested row shows its loss inline. Expense rows follow, and the total matches the chip. |
| **Tooling** | All six: TS language server, a diff reviewer agent, hooks (block bare stash, lint after edits), project skills, project rules in `CLAUDE.md`, and Playwright MCP. |
| **Baselines and smoke test** | **You handle these.** Rev 2 won't touch the Linux baselines or the production smoke test. |

<div class="questions" data-idea="locked"></div>

<!-- section:actions -->
## Orders, decoupled

**What I missed last time.** I treated note 15 as a layout problem: two tabs, one for orders and one for territory. Your point is that **giving an order shouldn't depend on the pane at all.** The map is where you act. The pane shows the one thing you're doing right now, and then gets out of the way.

**The model.**
- **Top bar, above the map.** Date and readiness, then the Funds and Manpower chips. After those come **Last turn**, **Recruitment (n)** and **Building (n)**. Then **End Turn**, in a serious orange-red with an icon. A hamburger menu replaces "Exit game". On a phone, the header has no room for all of this, so End Turn moves to the collapsed pane bar. That bar is renamed This turn.
- **The pane is a stack with a back link.**
  - When nothing is selected, it shows **This turn**: the orders you've given so far.
  - Clicking a territory opens **Territory Info**.
  - Invade, Reinforce, Build, Recruitment, Building and Last turn each open on top, and **back** returns you to where you were.
- **The selection bar.** The pane's sticky footer is the action bar for whatever is selected: "3 units selected · Move · Replenish · Entrench". The floating "Give Selected Units Order" button is gone, and so is End Turn from the pane.
- **Quick actions.** Right-click a territory (long-press on a phone) to get **Invade, Reinforce, Info, Build**.
  - Invade is offered on enemy or contested ground, and Reinforce on friendly or contested ground.
  - An unavailable action is greyed out, with its reason on hover.

<figure class="mockup"><img src="{{IMG}}r2-b-topbar.webp" alt="Planning screen with the new top bar and the pane showing This turn"><figcaption>The top bar carries End Turn and the global views. The pane shows "This turn", and its footer is the action bar for the selection.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-b-menu.webp" alt="Hamburger menu open with Settings, Save disabled, Exit Game"><figcaption>The hamburger menu: Settings, Save (not available yet), Exit Game.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-b-context-desktop.webp" alt="Right-click dropdown on a contested territory with Invade, Reinforce, Info, Build"><figcaption>Right-click on contested Extremadura.</figcaption></figure>
<div class="phone-row">
<figure class="mockup"><img src="{{IMG}}r2-b-context-phone.webp" alt="Phone long-press radial wheel with four actions"><figcaption>Phone: long-press opens a wheel with the same four actions.</figcaption></figure>
</div>

**Invade and Reinforce.**
- **Invade** opens a pane for the target. At the top, a live odds bar updates as you tick units. Below it are cards for **every unit that can reach the target, grouped by the territory it starts from**, each showing its move mode (March, Motor or Rail).
- A joint attack from three territories is now one screen and one button: **Order 4 units to invade**.
- **Reinforce** uses the same layout for friendly ground. Instead of odds, it shows the defence you'll have after the moves.

**How they work with pockets** (locked unless you object):
- An arriving unit joins the pocket on the side of the border it crosses.
- **Invade** lists units that can reach a border of enemy-held ground in the target. Your units already in a pocket there appear as "already here", because they fight the standing battle anyway.
- **Reinforce** lists units that can reach a border of your own pocket.
- **On contested ground both actions are offered.** Invade means fighting for the rest of the territory, and Reinforce means holding what you have.

<figure class="mockup"><img src="{{IMG}}r2-b-invade.webp" alt="Invade pane with odds bar, air line, unit cards grouped by source territory and an Order button"><figcaption>Invade Castilla y León. The odds and the air battle sit at the top. Units are grouped by where they start, each with its move mode, and the Navacerrada pass allows March only. The Madrid–Ávila road flanks the pass, so the defenders lose their −2. Example data: the Republic has no trucks today, so the Motor chips are mocked, and the enemy's recon plane is shown for context only, because only its AA counts.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-b-reinforce.webp" alt="Reinforce pane for a friendly territory"><figcaption>Reinforce Valencia. The layout is the same, with the defence after reinforcing (12 → 22, against a threat of 16) in place of odds.</figcaption></figure>

**Global Recruitment and Global Building.** Both views open from the top bar and are grouped by territory. Each territory shows:
- the item being worked on now, with a progress bar and the turns left;
- the queue behind it, as smaller rows.

Paused contested queues say they're paused. The same queue component also drives Territory Info (note 9), so the two views always agree.

<figure class="mockup"><img src="{{IMG}}r2-b-global-recruitment.webp" alt="Global Recruitment view grouped by territory"><figcaption>Global Recruitment: what is training now, how long it has left, and what's next.</figcaption></figure>
<figure class="mockup"><img src="{{IMG}}r2-b-global-building.webp" alt="Global Building view grouped by territory and sub-territory"><figcaption>Global Building, grouped by territory and then sub-territory. A queue in contested ground shows as paused.</figcaption></figure>

**Last turn.** Opening it while you plan shows last turn's report in the pane, grouped by faction with yours first. Back returns you to This turn.

<figure class="mockup"><img src="{{IMG}}r2-b-last-turn.webp" alt="Last turn report open in the pane during planning"><figcaption>Last turn's report, recalled during planning.</figcaption></figure>

<div class="questions" data-idea="actions"></div>

<!-- section:moves -->
## Moving: modes, passes and reach

**Unreachable ground stays quiet.** While you give an order, reachable territories light up. An unreachable territory shows nothing until you **hover** over it. Then a small card says why, for example: "Motor can't cross the Somosierra pass. March reaches it in 2 turns." On a phone, the same card opens as a modal if you tap an unreachable territory while ordering.

<figure class="mockup"><img src="{{IMG}}r2-b-unreachable-hover.webp" alt="Hover tooltip on an unreachable territory explaining why"><figcaption>Desktop: hovering over Galicia shows why it's out of reach by March, Motor and Rail.</figcaption></figure>
<div class="phone-row">
<figure class="mockup"><img src="{{IMG}}r2-b-unreachable-phone.webp" alt="Phone modal card for an unreachable territory"><figcaption>Phone: tapping an unreachable territory shows the card as a modal.</figcaption></figure>
</div>

**Order lines: your question about Bézier curves.** Today every move arrow is a smooth curve from territory to territory. Once moves follow a network, a curve hides the route the unit actually takes, including the pass it can't use.

My recommendation:
- **Route Motor and Rail order lines along the links they use.** The line then shows the road or railway itself.
- **March** stays a short curve, since it's always one step.
- **Roads are drawn** as quiet lines in the Logistics preset. The rail drawing you liked stays exactly as it is.

<figure class="mockup"><img src="{{IMG}}r2-b-routes.webp" alt="Two panels: today's curved arrow versus an order line routed along roads and rail"><figcaption>Left: today's curves. Right: the same Rail move (Barcelona to Zaragoza) and Motor move (Valencia to Murcia) routed along the links, with roads drawn faintly and passes marked with chevrons.</figcaption></figure>

**The pass bonus.**
- I recommend **−2 on the attacker's roll**, the same as one level of dug-in. It stacks with dug-in, so the most a pass and full works can give is −8.
- **Flanking cancels it:** if at least one attacking ground unit comes over a link that isn't a pass, the bonus doesn't apply. That rewards going around, which is what armies actually did at Guadarrama and in Asturias.
- It's one rule on one die roll, and the odds bar shows it.

**Link data.** This is the shape, and the scenario defines its own modifiers:

```json
"linkModifiers": {
  "pass": { "label": "Mountain pass", "noMotor": true, "defenderRoll": -2, "lostToFlanking": true }
},
"links": [
  { "a": "madrid", "b": "guadalajara", "road": "main", "rail": "main" },
  { "a": "guadarrama", "b": "segovia", "road": "main", "rail": "single",
    "modifiers": [{ "kind": "pass", "name": "Somosierra" }] }
]
```

The Spanish scenario ships with passes only. Rivers or bridges can be added later as new modifier kinds, with no code change beyond the effects they use.

<div class="questions" data-idea="moves"></div>

<!-- section:air -->
## Air: the battle before the battle

**Your rule:** only one side gets Ground Support, and if both sides bring air (or AA), an air battle is rolled first. Here it is with numbers, using the same d20 as everything else.

**When it happens.** A ground battle has an air battle first when either:
- both sides have aircraft over it (Ground Support or Patrol), or
- one side's Ground Support faces the defender's anti-aircraft in that territory.

If only one side has air and nothing opposes it, there is no air battle, and its Ground Support applies.

**How it's rolled.**
- Each side rolls **d20 + 2 per fighter + 1 per bomber**.
- The defender also adds its **AA**: the same value that today lowers a raid roll, counted as a plus.
- Recon aircraft don't take part.

**What it decides.**
- The **higher total wins the air.** The winner's Ground Support applies: **+3 per aircraft unit, at most 2.** The loser's doesn't apply.
- A **tie** means neither side gets support.
- The report and the odds bar both show the two rolls and the result.

**Patrol** fighters join the air battle over their territory, and still intercept raids as they do today. This replaces the old "Patrol cancels Ground Support one for one", so only one rule decides who gets support.

<figure class="mockup"><img src="{{IMG}}r2-b-air-battle.webp" alt="Air battle shown before the main battle with both rolls and the result feeding the odds"><figcaption>The battle card in the Last turn report: the air battle over Málaga (Málaga's AA against the Ju 52s), then its winner's +3 in the ground battle. The rolls are example data.</figcaption></figure>

<div class="questions" data-idea="air"></div>

<!-- section:ledger -->
## Balance view

There's one list: each territory's row shows its yield, and a contested row shows its loss on the same line. Expense rows follow (builds under way, Replenish, upkeep), and the total matches the chip.

<figure class="mockup"><img src="{{IMG}}r2-b-ledger.webp" alt="Funds balance popover with one flat list, contested minus shown inline, then expenses"><figcaption>Funds, as one list. The contested minus appears on its own row. The planned Replenish (−3) is example data, and it moves the chip from +12 to +9 so the total matches.</figcaption></figure>

<!-- section:ai -->
## The AI must use every action

From reading `src/main/ai/`, here is what the computer player does today, and what Rev 2 has to teach it. These are implementation items, not questions.

| Action | AI today | Rev 2 |
|---|---|---|
| Move: land, rail, sea | Yes (`orders/move.ts`), odds-aware | March, Motor or Rail by mode. It respects passes, picks the pocket exit, and plans joint attacks across source territories, as the Invade pane does. |
| Withdraw | Yes, in contested ground | Leaves only through its own pocket's borders. |
| Replenish | Yes | No change. |
| Recruit, including aircraft | Yes | No change. |
| Build: development, fortifications, rail repair | Yes | Also: **factories** (paid in Manpower), **road upgrades**, and **new rail lines and rail upgrades**. |
| Air: raid, intercept, support, recon | Yes, but only bombers fly support | Patrol replaces intercept, fighters fly Ground Support too, and the AI weighs the air battle before committing. |
| Generals: move, sack | Yes | No change. |
| Entrench | Implicit (no order) | No change. |
| Blunders | 1 in 100 orders | **Removed.** |

**The guard.** A coverage test lists every order kind, air mission, move mode and build project in the engine. It fails if the AI has no path that produces any one of them. A new action can't ship without teaching the AI.

<!-- section:plan -->
## Implementation plan

The same team shape as Rev 1: a coordinator, a supervisor, and workers in sibling worktrees. Merged to `main` locally; you decide when to push.

1. **Setup.**
   - Install the tooling you approved.
   - Add project rules to `CLAUDE.md`.
   - Exclude `.claude/**` and `infra/**` from vitest, since the old worktree leak caused 185 false failures.
2. **Data.**
   - Link records and modifiers.
   - Explicit building lists.
   - The North −2 change, and removing blunders.
   - The 1936 rail and road table, checked against a period map.
3. **Engine.**
   - Pockets, with the Málaga test.
   - Control flip.
   - Move modes and passes.
   - The rail graph, plus building and upgrading rail.
   - Dug-in values.
   - Factory Manpower.
   - Air orders and the air battle.
4. **AI.** The coverage table above, with its guard test.
5. **UI.**
   - Top bar and menu.
   - The pane stack and selection bar.
   - Quick actions.
   - Invade and Reinforce.
   - Global Recruitment and Global Building.
   - Last turn.
   - The balance view.
   - The layers toolbar.
   - Sub-territory borders past 250% zoom.
   - Replenish.
   - Routed order lines.
   - Hover-only unreachable notes.
   - The two bugs.
6. **Close-out.** The coverage gate, e2e runs and a sitrep. No balance sims unless you ask for them.

<div class="questions" data-idea="plan"></div>
