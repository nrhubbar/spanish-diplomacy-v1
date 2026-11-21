# Milestone 3 Revision 2: sitrep 1

> Internal. Status of Rev 2 on branch `milestone-3-rev-2`, for the owner's playtest.

**21 Nov 2026.** Every R and U decision in `milestone-3-rev-2-tasks.md` is implemented. The exceptions are listed under **What isn't done**. All nine workstreams are merged into `milestone-3-rev-2`; nothing is on `main` and nothing is pushed.

## Checks on `milestone-3-rev-2`

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test:unit` | 114 files, 1,507 tests pass |
| Coverage gate (93/92/92/92) | branches 94.78%, functions 98.73%, lines 99.41%, statements 98.53% |
| `npm run build` | builds |
| Headless game (`npm run sim -- --games 1`, a run, not a balance study) | seed 1 plays to the end in 15 turns with no errors; the North wins |
| AI coverage guard | passes: every order kind, air mission, move mode and build project has an AI path |
| Playwright (`test:e2e`, baselines, smoke) | not run or fixed, per the owner (declog D1); the new UI will change them |

## What landed, by stream

| Stream | Delivered |
|---|---|
| `contract` | `@type`/`@data` typed entries across the scenario and map data, converted at load time (D1). Links with road, rail and pass modifiers, sourced from the 1936 research (D2, D3). Explicit `buildable` lists, with no port in Madrid or the inland provinces (D4). Blunders removed (D5). North −2 units, Málaga's sea lane, the foot flag, link-project prices, dug-in and factory data. The Barbastro garrison in Aragón, so the turn-1 flip doesn't hand it over. |
| `ui-shell` | The top bar with End Turn (orange-red, hourglass) and the hamburger menu (Settings, Save disabled, Exit Game). The End Turn confirm, shown only when armies have no order. The pane stack with a back link. "This turn". The selection bar, replacing the floating order button. The selection resets to none after an order. Last turn. The report grouped by faction, yours first. |
| `ui-economy` | Global Recruitment and Global Building views. One shared queue component, also used by Territory Info's tabs (Units, Buildings, Recruit, Production). The flat balance view with contested losses inline, then expenses. Replenish for the whole selection. |
| `network-engine` | March, Motor and Rail through `reachFor`, with plain-English reasons. Passes: no Motor, and −2 unless the attack flanks. Rail along the links, ranging by the weakest level. Link works: new rail line, rail upgrade, road upgrade. Order-line paths. |
| `pockets-control` | Pockets in contested ground: armies leave only across their own pocket's borders. The whole-territory flip when one side has ground armies there. Málaga leaves only by sea. The flip-order side effect is fixed. |
| `air-rules` | Patrol, Ground Support, Raid and Recon. The air battle (d20 + 2 per fighter + 1 per bomber, defender plus AA) decides who gets Ground Support: +3 per aircraft, at most 2. Dug-in pips 1/2/3, at −2/−4/−6. The factory costs 6 Manpower. The battle card's air section. |
| `map-layers` | The Layers toolbar (Orders, Logistics, Economy, More), with layers switching on automatically while ordering. Sub-territory borders past 250%. The Roads layer with pass chevrons. Raid lines end on the target sub-territory. Aircraft get air orders only. |
| `map-orders` | Quick actions on right-click and long-press: Invade, Reinforce, Recruit, Build, Info. The Invade pane: live odds with the air battle and pass bonus; units by source territory with mode chips; "already here"; Ground Support. The Reinforce pane. Hover-only (desktop) or modal (phone) notes on unreachable ground. Order lines along the links. |
| `ai` | The AI can use every action: modes and passes, pocket exits, joint attacks, trucks where Motor pays, factories, link works (only when useful), Patrol and Ground Support weighed by the air-battle odds. The coverage guard test. The last-stand fix (S3). |

## Decisions the owner should check

1. **Paved airfields in rain and snow (AR5).** You chose "rain and snow ground all air". The air worker kept Rev 1's exception that a paved airfield still flies, because otherwise the building does nothing. Keep the exception, or ground everything?
2. **Motor is rare (NE2).** Motor needs main roads all the way, and on the turn-1 map only Madrid–Valencia qualifies. The Republic also starts with no trucks. If you want Motor to matter, the simplest lever is letting it use any road.
3. **Rail hubs are level 2, not 3 (D6, NE1).** Station levels now come from the best link (single 1, main 2), so Madrid, Barcelona and the other hubs drop from 3 to 2. Rail range now comes from the links: single 2, main 4.
4. **The Barbastro garrison (D8)** in Aragón was added so the turn-1 flip doesn't hand Aragón to the North. Its size is estimated and its citation is unverified.
5. **The balance view (ui-economy).** The chip shows "now" (after this turn's Build and Recruit orders) and "next turn" (the list's total). Replenish now comes off "next turn", so it isn't counted twice.
6. **Training shows each unit.** The engine trains every recruit at once, so each gets its own progress bar. Only this turn's new Recruit orders wait behind them.

## What isn't done

- **The resolution screen's order lines** are read against the end-of-turn board, so a route through ground that changed hands falls back to a straight line. Fixing it means keeping the start-of-turn board in the resolution session.
- **The "Show route" button** on the phone's out-of-reach card isn't built.
- **The Economy layer preset** doesn't show per-sub-territory yields, because nothing on the map draws that yet.
- **Per-file coverage below the gate**, all already below before Rev 2 and none lower now:
  - `ai/orders/move.ts` 91.7% branches (up from 89.8);
  - `map/CampaignMap.tsx` 79%;
  - `map/VectorLayer.tsx` 85%;
  - `AirLayer.tsx` 84%;
  - `AirPane.tsx` 87%;
  - `d20/battle.ts` 75%;
  - `standing.ts` 82%;
  - `ArmyLine.tsx` 80%;
  - `partition/flips.ts` 91% (up from 85);
  - `partition/orders.ts` 90%.

  The global gate passes.
- **Speed.** The vitest smoke game doubled to about 42 s, because the engine's pass check rebuilds link arrays on every call (`linksOf`, `linkBetween`). It's a straightforward cache per scenario.
- **The AI's new tuning constants** (`supportWorth`, `routeScore`, `countedRoutes`) are untuned. A balance sim only if you ask.

## Screenshots

`npm run e2e:capture` ran on the merged branch. Its tests stop partway, because they drive the old pane (the Playwright suites are the owner's, D1). Those that got through show the new shell:

- ![Turn 1 planning: the new top bar, the Layers toolbar and the briefing](m3r2-progress/images/sitrep-planning.webp)
- ![Territory info for Cataluña: tabs, sub-territory cards, the selection bar](m3r2-progress/images/sitrep-territory-info.webp)

**Browser check of the new actions.** A throwaway Playwright script, not committed, drove the real app on turn 1. It tested right-click quick actions, Invade (two units ticked and ordered), Reinforce, the End Turn confirm and the hamburger menu at 1440×800, and the long-press wheel on a Pixel 7. Every step worked, with no page errors, and order lines follow the rail.

- ![The quick-action menu on Castilla y León](m3r2-progress/images/verify-context-menu.webp)
- ![After ordering two units to invade: lines along the rail, the pane confirms](m3r2-progress/images/verify-invade-ordered.webp)
- ![Reinforce Valencia](m3r2-progress/images/verify-reinforce.webp)
- ![Phone: the long-press wheel](m3r2-progress/images/verify-phone-wheel.webp)

It found five problems, all now fixed (`verify-fixes.webp` shows the first three):

1. The Invade odds scrolled away with the unit list. They are now pinned to the top of the pane.
2. The End Turn confirm, listing 15 armies, scrolled its title off the top. Now only the list scrolls.
3. The phone top bar overflowed the screen width. The readiness chips now wrap, and Last turn, Recruitment and Building show icons and counts only, with their names kept as accessible labels.
4. Reinforce was left off the menu on enemy ground, and Invade on your own. All five actions are now always listed, and one that doesn't fit is greyed out with a reason (U5).
5. The pane's hide button lowercased place names ("Hide invade castilla y león"). Only the first letter is lowercased now.

![The three layout fixes](m3r2-progress/images/verify-fixes.webp)

**Not yet seen in a browser:** the air-battle card in a real turn report, Global Recruitment and Building with real queues, and the phone's out-of-reach modal.

## Where the tokens went

Per-agent counts are what the harness reported when each agent stopped.

| Agent | Tokens | Cap |
|---|---|---|
| `contract` | 487k | 450k |
| `ui-shell` | 403k | 400k |
| `map-orders` | 402k | 400k |
| `air-rules` | 333k | 350k |
| `network-engine` | 330k | 400k |
| `ui-economy` | 320k | 350k |
| `ai` | 290k | 300k |
| `pockets-control` | 276k | 300k |
| `map-layers` | 218k | 300k |
| `contract` diff review | 53k | |
| **Workers and reviews** | **3.11M** | |
| Coordinator (this session: planning, merges, conflict fixes, the browser check, this report) | roughly 0.6–0.9M, an estimate; the harness doesn't report it | |
| **Revision total** | **about 3.7–4.0M**, against a 5M limit | |

The workers came to 3.11M, against Rev 1's 9.27M. What kept it down:
- A complete contract up front: shared functions had one owner each and were stubbed first.
- Each worker ran the diff reviewer on its own diff, at 50–60k per review, instead of whole-codebase reviewers at around 290k each.
- Per-file coverage rules.
- At most four workers at once.
- No worker handed back stuck or out of scope, so the supervisor agent, though defined (`.claude/agents/supervisor.md`), was never started, and the principal engineer (`.claude/agents/principal-engineer.md`) was never called. The files still below the per-file gate are mostly UI (`CampaignMap`, `ArmyLine`, `AirLayer`, `VectorLayer`, `AirPane`). That is exactly the principal engineer's job, and it can run as an optional pass.
