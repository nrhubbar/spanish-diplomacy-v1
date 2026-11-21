# Milestone 3 Rev 2: owner's answers to the review (21 Nov 2026)

> Internal. Nothing here may be imported into or rendered by the player-facing application.

The owner answered all 25 questions on https://claude.ai/artifact/WHoKWXtvx5DQDnzrt3PeJW. The owner's copy is below, verbatim. Where a note overrides the ticked option, the **Resolved** table wins; implement that, not the tick.

## Resolved where a note overrides the tick

| Question | Ticked | Resolved |
|---|---|---|
| Q-R2-6c pass cost | extra turn, no Motor, defender bonus | **No extra turn.** No Motor across a pass; defenders beyond a pass get a bonus. |
| Q-R2-3b air on the d20 | +3 per unit, max 2, Patrol cancels one for one | +3 per unit, max 2, but **only one side gets it**: when both sides bring air (or the defender has AA), a pre-battle air resolution decides which. Patrol's one-for-one cancel is replaced by that resolution. |
| Q-R2-15 Orders vs Territory Info | B tabs on desktop, A on phone | **Superseded by the note.** Orders are decoupled from the pane: right-click / long-press quick actions (Invade, Reinforce, Info, Build), Invade and Reinforce panes, Global Recruitment and Global Building views, End Turn above the map (orange/red, icon), hamburger menu (Settings, Save disabled, Exit Game). |
| Q-R2-10 report | own faction first | Also: recall last turn's report while planning. |
| Q-R2-16 ledger | with expenses | One flat list of rows; contested rows show their minus inline. No held/contested sections. |
| Q-R2-2a North | two fewer | Also: **remove the AI blunder mechanic entirely.** |
| Q-R2-13 factory | one-time ~6 Manpower, AI builds factories | Also: the AI must know how to do every action in the game. |
| Q-R2-C baselines and smoke test | — | The owner handles these; Rev 2 does not touch them. |

## Owner's copy (verbatim)

Answered 25 of 25 questions. Copied 2026-11-21.

- Q-R2-0: A. Pockets (Recommended)
- Q-R2-1: Leave Málaga sealed: it can leave only by sea
- Q-R2-2a: Two fewer: the Salamanca regiment and the Sierra column (Recommended). Notes: "Also, we should remove the blunder mechanic all together."
- Q-R2-2b: Keep today's army
- Q-R2-2c: Accept about 15% for now, and revisit after playtests (Recommended). Notes: "Yes, I suspect some of the road mechanics may nerf the north even more"
- Q-R2-3a: Four: drop Airlift and Interdict
- Q-R2-3b: Ground Support +3 per aircraft unit, at most 2 per side; enemy fighters on Patrol cancel one each; rain and snow ground all air (Recommended). Notes: "Yes, only one side gets the bonus, if both sides bring air (or AA), there is a pre-battle air resolution, that feeds into the main battle"
- Q-R2-3c: Yes (Recommended)
- Q-R2-6a: Yes, one link type in the scenario's map data (Recommended). Notes: "Yes, links should have a list of modifiers defined for that scenario. Instead of bezier curves, should we draw the roads/rails?"
- Q-R2-6b: Three move modes (Recommended). Notes: "Unreachable territories should only show a note if the player hovers over the unreachable territory. Mobile should probably show the card as a modal if the user tries to order to an unreachable spot."
- Q-R2-6c: An extra turn; no Motor moves across passes; defenders beyond a pass get a bonus (Recommended). Notes: "No motor across passes, and defneders get a bonus. adding a turn creates a bunch of side effects. Like, where is a unit if its stuck in a pass."
- Q-R2-6d: Both: a new line takes many turns, and an upgrade is cheaper (Recommended)
- Q-R2-6e: The researched 1936 province table, with every inferred or unknown link checked against a period map before shipping (Recommended)
- Q-R2-12a: Pips 1/2/3, roll −2/−4/−6, level 3 everywhere
- Q-R2-12b: Leave it at +1
- Q-R2-13: A one-time cost (about 6), and teach the AI to build factories (Recommended). Notes: "lets make sure the AI knows how to do all actions in the game."
- Q-R2-5: An explicit list on every sub-territory. Notes: "We don't need to normalize this with a rule, it is fine to just list everthing on each sub-terr in the map data."
- Q-R2-14: Yes. If both sides are wiped out, holders keep what they held, and aircraft never count (Recommended)
- Q-R2-8: A bottom toolbar whose first three buttons are presets (Orders, Logistics, Economy), with the switches under a More menu; layers also switch on automatically while you give an order (Recommended)
- Q-R2-15: B (two lasting tabs) on desktop, A (switch with a back link) on phone (Recommended). Notes: "But I don't think you're getting the point, I want to decouple "orders" even more from the existing UX that this detail pane will show everything. Right, like of course I can create "orders" from a territory, but that doesn't mean the panel should be so overly coupled that orders and territory info is so crowded. We should support other ways to create orders in rev 2, like right clicking(mobile long-press) on a territory will show options(drop down on desktop/wheel on mobile) with quick actions (Invade, Reinforce, Info, Build). Where invade is valid on a contested or enemy territory, and brings up a new UX on the right that shows the odds, and a list of cards of each unit that can reach that territory grouped by source territory. This makes it easier to do collaborative invasions. Similarly reinforce shows a similar pane as Invade but is for friendly territories that can move to that friendly territory. / I also want to be able to bring up a Global Recruitment View and Global Building View that can show me everything that I have in progress/queued grouped by territory.I should be able to tell whats actively being worked on, how many turns it has left, and whats in the queue behind it. / Also lets move the "End Turn" button to above the map, and it should have an icon and likely be a red or orange button. Something that indicates its a serious button. Making it green makes people want to click it. Then, where we have exit game today should be a hamburger button that opens a menu with Settings, Save(grayed out/not implemented), and Exit Game. This should help fix the floating "Give Selected units order" wonkiness."
- Q-R2-10: Your own faction, then the others (Recommended). Notes: "I should also be able to bring back the turn summary from the previous round when planning. This also goes into trying to decouple the right pane from just bing about orders."
- Q-R2-11: A. One action for the selection, naming skipped units and why (Recommended)
- Q-R2-16: Yes, with the total matching the chip (Recommended). Notes: "We don't need a held whole and contested section, we can just have every row together, then on the rows that are contested, we'll show the minus."
- Q-R2-17: TypeScript language-server plugin; A diff-scoped reviewer agent; Hooks: block bare git stash; lint after edits; Project skills: sims, screenshots, merge and worktree removal; Project rules in the existing CLAUDE.md (brings forward part of the M5 deferral); Playwright MCP
- Q-R2-C: I'll handle it myself

## Close-out answers (21 Nov 2026, https://claude.ai/artifact/2Wmv8q1BfsbYK12Bzkfy4k)

| Question | Answer |
|---|---|
| Q-R2B-0 Málaga sea exit | Add a coastal lane from Málaga to the Republic's ports (Almería, then Cartagena/Murcia) |
| Q-R2B-1 Recruit quick action | Yes: five actions (Invade, Reinforce, Recruit, Build, Info) |
| Q-R2B-2 Air in the Invade pane | Yes, a small group under the units, capped at 2 |
| Q-R2B-3 Global views | Top bar buttons with counts, opening in the pane |
| Q-R2B-4 End Turn confirm | Only when some armies have no order, listing them |
| Q-R2B-5 Order lines | **Every line follows links, March included** |
| Q-R2B-6 Pass bonus | −2 on the attacker's roll; stacks with dug-in; lost to flanking |
| Q-R2B-7 Air battle losses | No losses; it only decides who gets Ground Support |
| Q-R2B-8 Start | Yes, with changes (below) |

Owner's notes, verbatim:
- Q-R2B-5: "Yes, but I think it should be something more like links: [{"a": "madrid", "b": "guadalajara", "modifiers": [{"@type": "road", "@data": {...}}, {"@type": "rail", "@data": {...}}, {"@type": "pass", "@data": {"name": "Somosierra", ...}}, ...],}... It should be flexible and self descriptive in the data model. Please extend these types of patterns to the rest of our data model. Using a JsonSchema inspired syntax."
- Q-R2B-8: "The AI should be able to use every action, not necesarrily they must use every action, we don't want to disadvantage the ai into over building useless buildings."

Resolved: road and rail are modifiers on a link (`{"@type", "@data"}`), not fixed fields; the typed-modifier pattern extends across the data model (scope to be planned). The AI coverage guard checks that the AI *can* produce every action, not that it must use each one.
