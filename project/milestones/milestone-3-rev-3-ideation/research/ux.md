# Rev 3 UX research: notes 1, 2, 4, 5, 8, 9 and the volume UI

Measured in the live app (seed 42, desktop 1440x800, Pixel 7) with `ux-pass/` scripts. Images are in `images/`. Mocks are drawn over the running app with its own classes. "Unverified" marks what was not checked. Numbers in the mocks are from real recorded battles or the scenario, except the casualty total (illustrative).

## Found on the way (existing defects)
| Defect | Cause |
|---|---|
| The whole game is 1354 px wide at 1280 and 1024, so the page scrolls sideways and the menu and pane edge are off screen | `.game-header { flex-wrap: nowrap }` `_weather-timer.scss:235-236` applies above 720 px. Title 380 + meters 323 + actions 551 + gaps = 1354 |
| Fighters are tagged BOMB on the map | `presentation/airPane.ts:69-73`: `aircraftTag` tests `raid` or `support` before `patrol`; fighters fly both since R10 |
| The pane's tab strip overflows sideways by 32 px at the default 416 px (128 px at 320) | `_pane-tabs.scss:9-14`, `.pane-tab-list` does not wrap |
| The Hide button covers the pane title on narrow panes and phones | `.map-pane-header` in `_pane.scss`; seen in `r3-8-invade-recommended.webp` |
| Cards show under the sticky Order button | body padding 1rem below `.muster-footer` `_actions.scss:414-419` |

## Note 1. Resizable right pane
**Today.** Width is `paneWidthFor` (`map/MapPane.tsx`): 30% of the map, 300 to 416 px, not stored. Camera insets use it (`usePaneView.ts`). Below 720 px map width it is a bottom sheet: 46% open (`_pane.scss`, `max-height`). It collapses to a pill; the choice is not saved.
| Option | For | Against |
|---|---|---|
| **A. Grip on the left edge, full height (recommended)** | Standard, easy to find, 18 px hit area with a visible 5 px bar | Needs its own focus and pointer code |
| B. Corner grip (width and height) | Literal "box" | The pane has no free height to give; hidden on collapse |
| C. Three preset sizes (S, M, L) buttons | No dragging, good on touch | Not what was asked; less control |

**Rules.** Minimum 300. Maximum is the smaller of 640 and map width minus 732 (the pane plus its 12 px margin), so the map keeps 720 px clear. Measured: at 1440 a 640 pane leaves 754 px; at 1280 (after the header fix, map 1246) the limit is 514, leaving exactly 720. Double-click resets to the default. Keyboard: `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin/max/now`, left/right arrows 16 px, Home/End for limits, Enter resets; focus ring. Store the width per browser (a convenience, so wrap in try/catch); collapse state too. Re-clamp on window resize. Feed the width to camera insets once on drag end, not on every pixel.

**Phone.** "Larger or smaller" means sheet height: a grip at the top with three stops: bar, 46%, 86%. Swipe or drag; tap the grip toggles; buttons remain. Invade, Reinforce and Recruit open at 86% (note 8 needs it).

**Accept.** Drag, keys and double-click work; limits hold at 1280 and 1024; layout never scrolls sideways; reduced motion has no animation; width survives reload. **Tests.** Pure: `clampPaneWidth(width, mapWidth)`, `stopFor(height)`; DOM: separator keys, aria values. Images: `r3-1-resize.webp`, `r3-1-phone.webp`.

## Note 2. Aircraft markers
**Cause.** A deliberate Rev 1 choice: the Q-UX-10 answer picked "counters at airfields" with the NATO APP-6A fixed-wing symbol in a friendly unit frame, and the code took the frame itself as the counter (`_air.scss`, comment "the counter is the NATO frame itself"). `AirLayer.tsx` draws the NATO frame as the marker at a fixed 36x24 (`airCounterWidth/Height`, `airSymbol`), with the tag under it; it gets no zoom level. `CounterLayer.tsx` has three sizes (`counterMetrics` 32x24, 54x39, 58x56) and `UnitCounter.tsx` has a card, stripe, values and bar. "Still": the 36x24 size arrived in the Rev 1 commit (`d20e83e`) and `git log -S airCounterWidth` shows no later change. I found no earlier owner report in the milestone docs.

| | Ground | Aircraft now |
|---|---|---|
| Card, faction stripe, strength bar | yes | no |
| Size by zoom | 3 | 1 (36x24 at every zoom) |
| Grouping at overview | xN | none |
| Planned badge | green check | ink check |
| Selected | gold glow | gold outline |
| Grounded by weather | n/a | nothing on the marker |

Other effects of the size: `placeAircraft` lays rows out with a 36 px width and returns obstacle rectangles, so a card needs the same per-zoom metrics there and in the layout of army stacks.

**Options.** **A (recommended): the same card**, symbol inset. Overview: symbol and a letter (F, B, R). Operational: symbol, short designation, role (FTR, BOMB, RCN). Detail adds one line: "Air +2", "Supp +3", "Reach 4". Attack and defence are 0-1 for every aircraft, so printing them says nothing; print the role. B: the card with a large symbol and no figures: cleaner, but says less (not drawn). C: only re-style the current frame (border, shadow): cheap, still inconsistent. Scenario data needs a `designation` (Ni52, Br19, Ju52, Rec) on 5 units; the code already supports it.

**States to cover:** idle, hover, focus, selected, planned mission (dashed border, green check, dashed line), grounded (hatch and cloud; paved airfields still fly), two or more at one base (xN at overview), stacked above ground units at one city, enemy colours, training (never on the map), range ring. Accessible name stays as is.

**Accept.** One card component or shared wrapper; counter sizes match at all three zooms; tags fit at 11 px text; fighter tag is FTR; no overlap with army stacks; 24 px targets. **Tests.** Pure: `aircraftTag` for a type with patrol and support, recon, raid; placement with per-zoom metrics. DOM: card renders with symbol and badge. Unverified: overlap over a crowded front at all zooms. Images: `r3-2-air-cards.webp` (before and after), `r3-2-air-states.webp`.

## Note 4. Recruit: effects and overflow
**Today.** Effects live in the scenario (`unitTypes[].effects`). Nothing in the Recruit list shows them: `RecruitTab.tsx` prints cost, men, turns, and a hidden hover card (`.recruit-details`) with no effects. The hover card is `@media (hover:hover)` and only locked rows take focus, so phones and keyboards can't reach it for unlocked rows. The text exists elsewhere only for artillery ("Artillery alone turns back...", `muster.ts:287`). No effect has a short name in `presentation/`.

**Overflow, measured.** Rows do not overflow at 100% text: names wrap, rows reach 104 px at 320. The tab strip overflows (above). At 200% text and 320 px the tabs reach 414 px past the edge.

**Wording proposed** (the unit's note, then the detail):
| Unit | Chips | Detail |
|---|---|---|
| Infantry, Security forces, Colonial veterans | none | none (veterans: lock text stays) |
| Militia column | Trains in contested ground | Keeps training even while the territory is contested. Needs no buildings. |
| Artillery group | Attack bonus; Can't attack alone | +1 on the attack roll for every 3 artillery attack points, up to +3; needs another ground unit. |
| Cavalry regiment | Mounted | Needs no truck: an all-cavalry army moves +1, and rough ground does not slow it. |
| Tank company | Attack bonus | +1 for every 3 tank attack points, up to +2. Nothing in mud or snow. |
| Truck column | Carries 2 units | An army moves +1 when its trucks can carry every unit that needs one (`truckBonus`, `engine/movement/allowance.ts`). No combat value. |
| Anti-air battery | Anti-air 3 | Enemy raids here roll 3 lower; when defending, +3 to your air battle roll (`antiAirOf` counts defending units only). |
| Reconnaissance flight | Scouts | Flies recon up to 4 territories. |
| Fighter squadron | Air battle +2; Ground Support +3 | If your side wins the air. At most two aircraft count. |
| Bomber squadron | Air battle +1; Ground Support +3; Raids | Cuts income or damages a building. |

Build text from the data (per, bonus, max, weather), not literals.
| Option | For | Against |
|---|---|---|
| **A. Chips that wrap, tap for a line (recommended)** | Visible at a glance on phone; wraps at 320 | Adds 30 to 50 px to eight rows |
| B. Fold-out list per row | Short rows | Hidden until opened |
| C. Comparison table | Good for planning | Can't fit 12 units in 320 px; a later Compare view |

Also: `.pane-tab-list` wraps; `.recruit-row` becomes a container, so below 20 rem the stepper drops under the price; `overflow-wrap: break-word`; the Hide button becomes icon-only under 360 px. Measured after: no sideways overflow at 416, 320, 320 with 150% text, or phone. **Tests.** Pure: `unitEffectChips(type)` per effect kind and for every recruitable type; DOM: chips are buttons with `aria-expanded`, Escape closes. Images: `r3-4-recruit-chips.webp`, `r3-4-recruit-narrow.webp`.

## Note 5. Battle balance sheet
Fields: `research/battle-sheet.md`. Now `BattleGradedRoll` prints the die, modifiers and score in one sentence and the bands in a table; it does not group or total them.
| Option | For | Against |
|---|---|---|
| **A. Ledger (recommended)**: units per side, odds line, effects grouped (helps the attacker / defender / both), total, then die, final number, result, with a strip of the table | Answers "what decided it" in reading order | Long fights need collapsing |
| B. Running total (waterfall) | Shows the order | Harder to add up; needs width |
| C. Collapsed "How this was decided" with A inside | Short report | One more click |

Recommend A, with the sheet closed on simple fights (no modifiers) and open on others. Signs are always the attacker's view: defender bonuses show minus. Show four numbers side by side: modifier total, die, final (with "kept to 0-20" when clamped), result. Show the rounding ("59 against 66 rounds to 1:2"). Lists over 5 units show the 4 strongest and "16 more units, N".

**Real data used.** Simple: Aragón turn 2 (6 v 6, die 12, +2, final 14). Busy: Castilla-La Mancha turn 6 (59 v 66, modifiers cancel to 0, die 4, final 4, with the air battle). Three-sided: Extremadura turn 4, South's sheet (total -9, die 7, final 0, clamped from -2; North separately). Popular resistance is on the turn 4 sheet; note 11 removes it. Not shown: demoralised and under-strength inputs, which are not recorded (`BattleArmy` has only `value`); adding them needs optional engine fields.

**States:** no modifiers, score clamped, odds below 1:1 and above 6:1, air battle fought, ground support lost, three or more sides (one sheet per attacker), entry, standing, meeting. **Accept.** The rows sum to the total shown; total plus die equals the raw score; final matches the engine; total, die, final and result stay together in one row block on phone. **Tests.** Pure: `battleLedger(scenario, outcome)` with each modifier kind and role, totals, clamp. DOM: table has row headers and captions. Images: `r3-5-ledger-options.webp`, `r3-5-ledger-busy.webp`, `r3-5-ledger-phone.webp`.

## Note 8. Invade pane
**Reproduced.** Andalucía, turn 3, all 10 ground units and 2 aircraft ticked: **0 of 12 unit cards visible** at the top and after scrolling, desktop and phone. Three causes:
1. `.muster-box` became sticky in `0fc2a72` (`_actions.scss:171-183`), and it holds an unbounded Defenders list (`presentation/muster.ts:284-292`, all 12 names). It is 419 of the pane's 560 px on desktop, and 467 of 188 px on phone.
2. The phone sheet opens at 46%, so the body is 188 px even with a small box.
3. Cards are 211 to 229 px tall because each repeats the reasons March or Motor can't be used. Un-sticking the box alone shows no card at the top on desktop (1 of 12 after scrolling, and 0 on phone).

| Setup | Desktop top / scrolled (full; over half) | Phone top / scrolled |
|---|---|---|
| Now | 0; 0 / 0; 0 | 0; 0 / 0; 0 |
| Box not sticky, same cards | 0; 0 / 1; 2 | 0; 0 / 0; 0 |
| **A (recommended)** | **4; 4 / 4; 6** | **2; 3 / 3; 4** |
| B everything scrolls, small cards | 2; 3 / 5; 5 | 0; 0 / 4; 5 |
| C two tabs | 4; 4 / 5; 5 | 2; 3 / 3; 4 |

**A:** one 38 px sticky line (Attack, Defence, odds, chance to take it), a fold-out "12 defenders" that scrolls away, and compact cards: mode chip on the name row, men and works on the second, and one "Only Rail reaches it. Why not March or Motor?" line per group instead of repeats (61 px each measured, versus 211 to 229 on desktop and up to 247 on phone). On phone the pane opens at 86%. Measured by script in the real pane.

**States:** no odds yet, unopposed, artillery warning, air line, pass, refusal, blocked aircraft, long names, 0 units. **Accept.** The list gets at least half the view at the top on desktop; details reappear when scrolled to the top; the summary never covers a card; unit cards visible above 0 on every device. **Tests.** Pure: `defenderSummary(units)`, which must count units, never split the joined text: names such as "Regulares Groups Tetuán No. 1, Ceuta No. 3, and Larache No. 4" contain commas and "and" (a trap my first mock fell into); DOM: list has room (jsdom has no layout, so a Playwright check at Andalucía counts visible cards). Images: `r3-8-invade-before.webp`, `r3-8-invade-recommended.webp`, `r3-8-invade-options.webp`.

## Note 9. Casualties near the turn counter
Fields: `research/casualties.md`. Engine keeps battle losses only; a total needs a small accumulator (and men on surrender and disband outcomes). No room today: the header is already 1354 px wide, over 1280.
| Option | For | Against |
|---|---|---|
| **A. Short chip beside the faction name, tap for the split (recommended)** | Nearest the turn counter; no new column | Needs the wrap fix under 1400 px |
| B. In the kicker row after "Turn 2, early August" | Closest of all | Readiness chips already fill it |
| C. In the menu | No room problem | Not "near the turn counter" |

**Measured** with a fix at 721 to 1400 px (the bar wraps to two rows and the words Funds and Manpower drop to icons): 1280 and 1024 no longer scroll sideways. Headers: 1440 stays 110 px with the short form, 1280 is 127 (now 148), 1024 is 126 (now 143), phone 183 (now 178). **At 1440 the long form "Casualties 12,418" dropped under the name (155 px)**, so use "12.4k" plus an icon below 1500 px; the accessible name is always the full number. Use 1,234,567 or 1.2M from a million; phones use the short form. Never put a figure beside End Turn. Frozen, no animation. States: 0 ("none yet"), one side, resolution. **Accept.** Number equals the engine's; only battles, frostbite, surrender and disband count; split sums to the total; no sideways scroll at 1280, 1024 and 412. Image: `r3-9-casualties.webp`.

## Note 3. Volume UI
Master, Music and Effects sliders (0 to 100 in fives, labelled, percentage shown, mute buttons with `aria-pressed`). Quick control in the game menu (the top bar is full); the same rows in Settings (currently no sound section). Master scales the others. Phone: labels above, 44 px targets. Muted state is not colour only. Unverified: screen reader reading of range values. Image: `r3-3-volume.webp` (Settings and menu, desktop and phone).

## Not reproduced or unverified
- The owner's Recruit text overflow at 100% text: only the tab strip overflows; the list wraps. Adding effects is the real risk.
- Whether the aircraft marker looked "messed up" another way on the owner's device. Phones show the same bare symbols and the wrong BOMB tag (visible behind the sheet in `r3-1-phone.webp`); the card was mocked on desktop only.
- Reach of `placeAircraft` on a crowded front; screen-reader passes; image effects at 200% browser zoom.
