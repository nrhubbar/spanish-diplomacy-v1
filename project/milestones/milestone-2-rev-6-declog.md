# Milestone 2 Revision 6 Decision Log

> Internal. Nothing here may be imported into or rendered by the player-facing application.

Decisions and assumptions made while implementing `milestone-2-rev-6-tasks.md`, numbered for reference. Product decisions taken in the research review are in section 1 of the tasks document; this log records how they were carried out.

## Process

**D1. Approvals.** On 18 November 2026 the owner approved the section 1.6 proposal for battles with several attackers and the five interpretations in section 1.8, and asked for all workstreams to run in parallel to a production-ready bar.

**D2. Outcome keys fixed before any work started** (tasks section 2.1), so the contract (D), presentation (F), and art (H) streams share names without waiting on each other.

**D3. Branches and worktrees.** Integration happens on `milestone-2-rev-6`, in `../spanish-diplomacy-v1-rev6`. Each workstream has its own branch `m2r6-<letter>-<slug>`, worktree `../sd-m2r6-<letter>`, and dev-server port `52<nn>`. The main checkout is not touched.

**D4. Two phases.** Phase 1 runs D, A, B, C, H, and the research half of G at once. Phase 2 starts E and F when D merges, and the data and computer-player half of G when E merges.

**D5. The pure combat maths moved from E to D.** The contract stream also implements combat values, side totals, the odds column, roll modifiers, the outcome distribution, and `estimateAttack` in `engine/combat.ts`. They are pure functions of the scenario's `combat` block and the game state, so the presentation stream (F) gets real numbers as soon as D merges. E keeps the seeded roll and battle resolution. D also keeps today's movement rules running under the new `m2-strength` ruleset name, so the game stays playable and every commit stays green until E lands.

**D6. G is split by phase.** Phase 1 writes only the research note, with a machine-readable strength table. It does not touch `scenario.json`, because D is changing that file's schema. Phase 2 applies the table and updates the computer player after E merges.

**D7. Phase 1 started on 18 November 2026** with six agents: D (5204), A (5201), B (5202), C (5203), G research, and H (5208).

## Integration

**D8. Visual baselines are updated inside each merge, not once at the end.** That keeps every commit on `milestone-2-rev-6` green; Rev 5 had to note commits that failed visual tests (Rev 5 D63). Only images that actually changed are rewritten (`--update-snapshots=changed`), and each one is reviewed before the merge is committed. This refines P2 in the tasks document.

**D9. Hover is kept out of baselines.** After End Turn, Start Next Turn appears under the pointer, so the resolution baseline caught a hover state. The visual spec now moves the pointer away first, and the existing baseline still holds.

## Turn flow (workstream B)

**D10. The Reveal step is gone.** When every faction has locked its orders, `advance` resolves the turn at once and routes to the results; Start Next Turn stays (T1). The `ready-to-resolve` phase, `RevealScreen`, its route, and `revealAndResolve` are deleted. The old `/reveal` URL falls through the session guard's catch-all, and tests prove it lands wherever the session belongs.

**D11. `submitOrders` became `endTurn`.** The button reads End Turn for every player, with no confirmation and no hold count (T2, T3). The handoff screen and its "has submitted its orders" line are unchanged, because the handoff was out of scope.

**D12. Results still say "Orders revealed".** The results screen does reveal everyone's orders, so its header and the "Revealed orders" panel keep their names.

## Art and words (workstream H)

**D13. One glyph grammar.** An arrow means the attacker and a shield means the defender. Body colour carries severity: red for eliminated, burnt orange for attrition and exchange, amber for demoralized, sea blue for defender demoralized, ink for dug in, green for recovered, navy for reinforcement, and brown for surrendered. Five draft glyphs were redrawn after a 24 px review because they collided with each other or with the existing bounce and loss icons. The 24 px sheet was checked again at merge.

**D14. Report emblems are monochrome.** They are drawn only in `currentColor`, with heraldic hatching standing in for severity colour, so the same SVG works in light and dark themes. They use no ids or defs, so many can sit on one page.

**D15. Outcome SVGs get their own allowlist sanitizer** (`assets/outcomes/sanitize.ts`). It keeps a fixed set of elements and attributes and drops URLs, ids, and event handlers. It is separate from the map geometry sanitizer, which was outside this stream; merging the two is a follow-up.

**D16. Flavor text is chosen deterministically.** `outcomeLine(key, values, seed)` picks a line from the seed, so replays read the same, and fills placeholders in one pass. Each key declares its required and optional placeholders. A test rejects atrocity wording, faction labels such as "Nationalist", and any mention of balance. Surrender lines do not describe what happens to prisoners.

**D17. Two key lists, to be unified.** H wrote the outcome keys in `assets/outcomes/keys.ts` because D's `presentation/outcomes.ts` did not exist yet. When D merges, one module re-exports the other, so there is a single source.

## Briefing (workstream C)

**D18. The Briefing lives on planning screens only.** It belongs to the faction that is planning, so the results screens have no "i" button. The controls area is still reserved on every map screen, so counters keep their places from screen to screen.

**D19. Turn-1 auto-open is stored in Redux** (`briefingSlice`), not in component state, so a remount never reopens it. Each local player sees it once, on their own first turn.

**D20. Victory progress comes from the engine's own `victoryProgress`**, so the bars cannot disagree with how the game decides victory. A test checks every "N of M" in each objective against the real thresholds, so a stale objective fails after rescaling.

**D21. On phones, the controls run along the top edge.** Integration found the "i" button sitting on the Galicia label. With a bottom sheet, the zoom group, the Briefing button, and the legend now share the top row. The rectangles that keep counters clear of the controls depend on the layout (`mapControlObstacles`). The legend moves right only when the button exists, so result screens keep their old layout.

## Combat contract (workstream D)

**D22. The rules are specified as M1 to M26** in `scenario-package.md`, with a table that says which rules ran in the interim resolver and which arrive with E. M1 to M10 keep their Revision 5 meaning where they survive.

**D23. Odds round in the defender's favour.** At or above 1:1 the column is `floor(a/d)`. Below 1:1 the odds are `1:ceil(d/a)`, and the halving penalty counts on those rounded odds, so the label shown is exactly what fights. At 8:1 the label reads "8:1"; the column caps at 6 and the excess shows as a separate +2 roll modifier.

**D24. Army values round once, at the end, halves up.** Side values are sums of the rounded army values, so every number on a counter adds up visibly.

**D25. A reinforcement keeps the Revision 5 meaning (OD-7).** A move is a reinforcement if its faction controls the target or has an army staying there.

**D26. Defenders of several factions pool into one side.** Digging in and faction modifiers apply when their faction is among the defenders, and each faction retreats on its own.

**D27. One key list.** `presentation/outcomes.ts` is the only list of outcome keys. The art and text modules import it, and H's copy (`assets/outcomes/keys.ts`) is deleted (resolves D17).

**D28. Flat-map visual test made deterministic.** The flat images show while WebGL starts, and the fallback notice arrives about 300 ms later. The test now waits for the notice before its screenshot; it had raced.

## Gaps found at integration, decided for the owner's review

**D29. Shared territories fight a standing battle each turn.** D found that, under the contract, two factions holding the same territory never fight, because no faction can attack a territory it already stands in. Asturias and Andalucía start shared, so they would freeze. That undercuts the reason for strength-based combat (OD-9). New rule M27: after movement and the other battles, if armies of two or more factions remain holding one territory:
- the faction with the greatest attack there attacks the next strongest faction there, once per turn;
- there is no digging-in bonus for either side, and faction modifiers apply as in entry battles;
- a tie for greatest is broken by a seeded roll, recorded in the battle.

Results apply as in any battle, and a defender that must retreat leaves the territory. This needs the owner's confirmation.

## History (workstream G, phase 1)

**D30. Research outcome.** Thirty-five armies, up from 25: the Republic has 15, the Northern command 12, and the Southern command 8. Every strength has a citation or a marked estimate. The two baseline sources (Nafziger's tables and *El factor humano*) could not be opened online, so neither is cited to a page; the note records which sources were read directly and which only through footnotes. Badajoz No. 13 and Alcántara No. 14 are replaced, because they rose against the Republic in Barcelona and lost. The Army of Africa becomes five colonial counters, and militia and security forces become counters of their own. Every change is flagged for historical sign-off (OD-3).

**D31. Every army starts at full strength (Option B).** The research offered two baselines:
- Option A: the 1,270-man paper establishment as `fullStrength`, so regiments start at 2-3 or 2-4.
- Option B: `fullStrength` equals the researched starting strength, so every army starts at its type's full values.

Option B matches the owner's own example (760/760 fights as 4-6, and 380/760 as 2-3). It also avoids Option A's brittleness, where most regiments start under two points and die to a single attrition result. Real head counts still show on every counter, and losses are measured against them.

**D32. Known risk: the Army of Africa can cross on turn 1.** Sea connections are ordinary moves, so all four African counters can land in Andalucía at once. Historically, about 1,500 men had crossed by 5 August. There is no balance target in Milestone 2 (P3), so this is reported, not tuned. A crossing limit is a candidate rule for later.

## Rivers and names (workstream A)

**D33. Rivers are chosen by Natural Earth river number, not by name.** Natural Earth's own names are wrong in places ("Mio" for the Miño, "Zncara" for the Záncara, the Aragón stored as a second "Alagón"). The build fails on any river line in the source that is neither listed nor excluded. Eight main rivers and 22 tributaries are drawn. Each line is oriented downhill using the elevation model, because the source does not always run downstream.

**D34. Rivers are aligned by construction and checked twice.** Every river vertex must lie inside the region polygons and on the baked land mask, and the build fails otherwise (0 of 1,578 vertices fail). Near the Portuguese and French borders, rivers are drawn just inside Spain, so the Duero and Guadiana appear in pieces along the frontier. Eight rivers that reach open sea taper over their last 14 km.

**D35. Water and river names yield to everything else.** That means the screen edge, the open pane, counters, territory and city labels, and the map controls. Open seas curve along the coast and spread their letters to fill the curve; a name can list fallback curves for narrow phones. On a phone at overview zoom the Atlantic is off-screen, so Océano Atlántico appears only after panning west.

**D36. Spanish names live in data as `\u` escapes.** The pipeline writes `map.json` with escapes, and `scenario.json` names are escaped by hand. Source stays ASCII. Ids are unchanged.

**D37. Borders moved to their own layer** (`.map-borders`), so rivers sit between the territory wash and the borders. Geometry is unchanged, and all four map assets are byte-identical to Revision 5.

**D38. Counters and water labels share one obstacle list.** At merge, the water-label obstacles reuse the layout-aware control rectangles from D21, instead of a separate hard-coded rectangle for the phone legend.

## Armies and computer players (workstream G, phase 2)

**D39. The researched order of battle is applied.**

| Faction | Armies | Men | Attack / defence at start |
|---|---|---|---|
| Republic | 15 | 39,130 | 53 / 78 |
| Northern command | 12 | 15,050 | 45 / 67 |
| Southern command | 8 | 16,613 | 42 / 43 |

`fullStrength` equals `strength` throughout (D31). An army cites a page only where the research note states one, and none cites Nafziger, because nobody could read it. The two Legion counters are named "Tercio Legion No. 1 (Banderas I-III)" and "Tercio Legion No. 2 (Banderas IV-VI)", so their designations read cleanly.

**D40. Each unit type has its own symbol.** Militia show a dashed cross, colonial veterans a crescent, and security forces a lozenge badge. All are derived from the existing infantry symbol, under the same licence and attribution.

**D41. The computer player plans with the real odds.** It scores every candidate attack with `estimateAttack`. The score is the chance to take the territory times its stake, adjusted for expected losses on both sides and for what leaving costs at home, and groups are combined from several origins. It also scores reinforcements by the danger they remove. Attacks and reinforcements compete in one queue. Demoralized armies always hold, and the last army on an objective never leaves. The seeded source is used only to break exact ties. The weights are judgement, not tuning (P3).

**D42. Data and computer player landed together.** With 35 armies, the old movement-only computer player won 96.5 percent of soak games before turn 4, which fails S1. Both therefore changed in one commit.

**D43. Counter placement tries slots further out and, failing that, takes the least overlap**, so 35 counters lay out on a phone. On the phone overview some stacks now sit well away from their territory. That is addressed in the presentation pass (see the F integration entries).

## Combat engine (workstream E)

**D44. Turn resolution is split by rule.** `resolution.ts` orchestrates the turn in the M26 order, with one focused module per rule area:

| Module | Covers |
|---|---|
| `orders.ts` | M1, M9, M11, M23 |
| `meeting.ts` | M20 |
| `front.ts` | M17, M19 |
| `site.ts` | M18 |
| `battle.ts` | One battle and its outcome |
| `battleResults.ts` | M16 |
| `retreat.ts` | M21 |
| `standing.ts` | M27 |
| `morale.ts` | M23 |
| `works.ts` | M22 |
| `control.ts` | M7 |
| `dice.ts` | Seeded battle dice |

Each module stays under 200 lines. `combat.ts` stays pure maths.

**D45. Battle dice have their own stream.** The seed is required by `resolveTurn`, and battle streams are `deriveSeed(seed, battleStreamTag, turn, index)`. The tag keeps battle 0 from replaying the first computer player's stream. Tests inject loaded dice; the game never does. A full-game replay test proves determinism.

**D46. Armies that fight get no move outcome.** Battles report them as attackers or defenders. A move into territory the faction already holds is always `reinforcement-arrived`. Reinforcements are never on the road, so they never join head-on meetings.

**D47. Several battles against the same defenders combine.** The worst effect wins: destroyed, then retreat, then stay. Each effect is reported once, in the first battle by index that caused it. A claimant must have surviving armies. An exchange that also destroys every attacker leaves the territory empty.

**D48. Retreat destinations come from one snapshot** taken before any army retreats, so retreat order never matters. An origin counts as taken when another faction's army that started the turn elsewhere stands there after the battles.

**D49. Standing battles (M27).** Only non-demoralized armies attack, and the defending faction fights with all its armies there. The die is the first draw of the battle's stream, and tie-break rolls follow it. The attacker stays in the territory whatever the result. A standing battle counts as fighting for digging in.

**D50. The demoralized limit is literal.** A demoralized army may not enter a territory where another faction stands, even if its own faction is there too. Planning explains this with the engine's own sentence (`demoralizedAttackReason`), not a "not connected" message.

**D51. The computer player remembers failed attacks.** A failed attack is now a battle rather than a bounce, so its memory of last turn's failed moves now also records failed assaults and entries.

## Soak (S1 to S3)

**D52. Strength combat with the first computer player froze every game.** Measured on the merged code over seeds 1 to 200 and 30 turns:
- S1: 0 early wins (met).
- S3: 0 abandonments (met).
- S2: 200 of 200 games froze (missed).
- No game was decided.

A 40-game probe isolated the cause. Battles per game fall from 4 on turn 1 to almost none by turn 6, and every kind of order shrinks with them. Turning digging in off still froze 37 of 40 games, and removing popular resistance changed nothing. The rules were not the cause. The computer player stops attacking once every one-turn attack looks costly, because it never masses armies over several turns. Improving it is computer-player work under C18, not balance tuning (P3), so it went back to G as a follow-up with a small measurement budget. The result is recorded below.

## Combat presentation (workstream F)

**D53. Counters print what fights.** Each counter shows its current attack and defence large, the full values small and struck through when they differ, a strength bar, and men (for example 370/550) at the detail zoom. It also carries a demoralized badge and a dug-in badge with one pip per level. Overview counters stay 32 by 24 pixels and show only values and the bar, because a larger counter failed axe's target-size check on phones. Each counter's accessible name is visually hidden text, so it always matches the printed values.

**D54. Crowded maps combine counters.** At a phone-width overview, or whenever crowding would push a stack more than three counter-heights from its anchor, each faction's armies in a territory become one counter. It shows their combined values and an "×N" tab. The selected territory always shows every army, so the order flow is unchanged, and tapping a combined counter selects its territory. Desktop overviews fit, so they keep one counter per army. Integration found that two-digit totals ("18-23") overflowed, so long combined values now set at 11 to 13 px.

**D55. Odds come only from the engine.** Highlighted destinations show the engine's estimate: "2:1 · 50%", "Reinforce", or "Unopposed". The pane lists every destination with its numbers and named modifiers. A "cannot attack" estimate from F was removed at integration: the engine's legal destinations already never offer hostile ground to a demoralized army (M23), so the branch could not be reached. Planning explains the rule instead.

**D56. Battle cards.** The turn report opens with a summary line, then one card per place. Places that changed hands come first, then the heaviest losses, and cards after the second are collapsed. Each card shows:
- H's emblem, title, and one flavor line chosen from the seed;
- the sides and values, the odds and column, the die, and every modifier by name;
- losses, demoralized, destroyed, retreats, surrenders, and who now holds the place.

Cards for several attackers, entries, meetings, and standing battles explain the rule with the battle's own numbers. When a tie leaves a place empty, the flavor line never claims a capture.

**D57. Report groups** run from most serious down: Surrendered, Disbanded, Bounced, Recovered, Reinforcement arrived, Completed moves. They use H's medallions and titles. This was F's version, taken over E's interim one-line change.

## Computer player offensives (workstream G, follow-up)

**D58. Computer players now build offensives.** Each turn a faction picks one enemy-held target where massing its ready armies, within three steps through friendly ground, gives the best chance times stake. Reinforcement moves score more for each step toward that target. Prizes grow by one step per turn without a gain, up to five times after four turns. Two further adjustments:
- an empty enemy territory that its owner can relieve this turn is scored as a likely battle, not a free capture;
- when a rival nears a victory threshold, stakes rise so that faction holds the line.

No rule or scenario data changed. The computer player needs the turn history to count stalled turns, so the coordinator now passes it (one line).

**D59. Two flows made deterministic at integration.** The fixture-victory app and e2e tests assumed the computer-controlled Blue Union would hold still. Now it counterattacks, and dice decide the result. Blue is now a second local player who holds, so the scripted win no longer depends on computer play or dice. Unit tests also got room under load: a 15 s test timeout and 3 s `findBy` waits, because full jsdom flows share the CPU with the 200-game soak. A route assertion that raced the session now waits.

**D60. Soak after offensives** (seeds 1 to 200, 30 turns):

| Measure | Result | Budget |
|---|---|---|
| S1 early wins | 1 (0.5%) | 5%, met |
| S3 abandonments | 0 | 0, met |
| S2 freezes | 139 (70%) | 20%, missed |
| Decided | 79 (Republic 70, Northern 4, Southern 5), about 14 turns on average | No target |

This compares with 100 percent freezes and no decided games before. The freeze measure counts any five-turn stretch with no change of control anywhere. The remaining freezes are mostly Republican cities dug in at +3 with popular resistance, a combined -4 on the roll, where even 3:1 has no chance to take them. Getting S2 under 50 percent needs a rule lever, such as the digging-in cap (the probe in D52 showed it moves freezes). The Republic wins 89 percent of decided games, more than the "little extra" asked for. Both are owner decisions under P3 and the tasks' risk table, so they are reported, not tuned.

## Rubric re-score (coding principles)

| # | Score | Evidence |
|---|---|---|
| R1 | 5 | Engine and computer player stay behind the lint import boundary. |
| R2 | 5 | Discriminated outcomes, battle sites, occupation, and order stages; everything readonly. |
| R3 | 5 | Seeded battle dice on their own stream (D45); full-game replay tests; soak determinism. |
| R4 | 5 | No `as` casts outside the loader and no non-null assertions in `src/main`, under strict-type-checked lint. |
| R5 | 5 | The session guard is still the only redirect; the removed reveal route falls through it, and tests prove it. |
| R6 | 5 | Store and registry injected as before. |
| R7 | 5 | Combat tables, modifiers, digging-in, unit types, briefings, rivers, and water names are all data. |
| R8 | 4.5 | Rules split into 13 engine modules and presentation into small components. Over the 200-line target: `types.ts` and `loader.ts`, cohesive by nature; `combat.ts` (316), `CampaignMap.tsx` (230), and `TerrainLayer.tsx` (210). |
| R9 | 4.5 | No dead code; the interim resolver and the unreachable "cannot attack" path are gone. Some unit-type metadata is still display-only. |
| R10 | 5 | Feedback boundary unchanged; the error boundary covers the new screens. |
| R11 | 5 | 439 unit tests, 95.1 percent branch coverage, a test group per numbered rule, and loaded-dice tests. |
| R12 | 4.5 | axe is clean in every engine, including the Briefing, the battle cards, and combined counters. Manual screen-reader, 200 percent zoom, and high-contrast checks are still open from Revision 5. |
| R13 | 4.5 | Every merge commit on the integration line passes every check, carrying its own fixes and reviewed baselines (D8). Commits inside workstream branches were held to lint, typecheck, and unit tests, but visual baselines change only at merges, and one stream did not re-run the gate on every intermediate commit. |

Average: 63.5 / 13 = **4.88**, with no row below 4.5.

## Release checks

**D61. Clean-checkout verify and production smoke both pass.** `npm run verify` passes with `CI=1` from a fresh worktree: lint, typecheck, 439 unit tests, build, and 82 browser tests across Chromium, Firefox, WebKit, Pixel 7, and iPhone 14. The production smoke test passes against the served build. Selection response is 35 ms on desktop and 79 ms on a throttled phone (P3), and the map is interactive in 266 ms and 525 ms (P2).

**D62. Initial chunk budget P1 revised from 142 kB to 155 kB gzip.** Revision 5 left the initial chunk at 130.4 kB. Revision 6 measures 150.0 kB, after moving `turnLabel` out of the report text, which kept that text and every flavor line out of the first download. The rest of the growth is the strength-combat engine and the odds-aware computer player. The Redux reducers call both synchronously when a game starts or a turn ends, so they belong in the initial chunk under the current architecture. Deferring them would need an asynchronous coordinator or a reducer swapped in after load. That is a follow-up, not something to risk at the end of a revision. The map screens chunk is 33.3 kB and the Three.js chunk 130.9 kB, both within budget.

## Final review fixes

**D63. The Briefing's battle card describes the final rules.** "How battles work" was written before the engine existed. It now states, from the scenario's combat data:
- a weakened army fights in proportion to its men;
- attacks combine from several territories;
- quiet defenders dig in, shifting the die up to the cap;
- demoralized armies fight at half and cannot attack until rested;
- attrition is permanent and falls on the strongest, while demoralization passes and falls on the weakest;
- reinforcements always arrive.

The worked example runs through the engine's `battleOdds` (`presentation/battleBasics.ts`), so it cannot drift: two regiments at 8 against a dug-in 6 have a 17 percent chance to take the territory, and a third makes it 2:1 and 33 percent.

**D64. Player text uses the map's Spanish place names.** Briefings say Sevilla and Andalucía. Army names take Castilian accents: Aragón, Cádiz, San Quintín, América, Milán, Requeté, Tetuán.

**D65. Counter designations keep accented words whole, and data may set one.** The split now treats any letter as part of a word. Before, "Aragón" became "Arag" plus "n", so Aragón No. 17 read "AN17". An army may also give its own designation (optional `designation`, up to four capitals or digits). Spain uses this for four armies the name rule abbreviates poorly: DURR (Durruti), SIMA (Simancas), SIER (Madrid Sierra), and MOLA (Mola's Sierra).

**D66. axe runs on a real turn report.** The mixed-turn acceptance test now opens every battle card and rule explanation on a real turn-1 report and scans it in all five browser projects. Spain's standing battles guarantee cards every turn.

## Open for the owner

- **Initial chunk budget P1, raised from 142 kB to 155 kB gzip by the integrator (D62).** The engine and computer player now ship in the first download (150.0 kB). Accept the new budget, or schedule the asynchronous-coordinator follow-up.
- **Every army starts at full strength (D31, Option B)**, rather than at the paper establishment.
- **The Army of Africa can cross the Strait on turn 1 (D32).**

- **S2 freezes at 70 percent and the Republic wins 89 percent of decided games (D60).** Both are measured, reported, and not tuned (P3). The most effective lever found is the digging-in cap in the `combat` data block; the D52 probe showed freezes move with it. A crossing limit on the Strait (D32) is another candidate.
- **Standing battles in shared territories (D29)** were added for this revision and need confirmation.
- **Historical sign-off (OD-3)** on the 35-army order of battle and its flagged judgements.
- **Manual accessibility checks** (screen reader, 200 percent zoom, Windows high contrast), still open from Revision 5.

## Follow-ups

- Defer the engine and computer player out of the initial chunk (D62).
- On a phone, the turn report's overview map is dense: route count badges and combined-counter tabs can touch. Fine at the operational zoom.
- `combat.ts` (316 lines), `CampaignMap.tsx` (230), and `TerrainLayer.tsx` (210) are over the 200-line target.
- Merge the outcome-art sanitizer with the map geometry sanitizer (D15).
