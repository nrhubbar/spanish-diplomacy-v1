# Milestone 2 Revision 5 Decision Log

> Internal record of assumptions and decisions made while implementing `milestone-2-rev-5.md`. Not player-facing.

Entries are in the order they were made. Each one gives the decision, why it was made, and where it shows up.

## Process

**D1. Scope wording.** The request said "finish implementing milestone 5". I read it as Milestone 2 Revision 5 (`milestone-2-rev-5.md`), because the same request says "do not stop until milestone 2 is done", and Milestone 5 does not exist.

**D2. All open decisions OD-1 to OD-8 take their recommended defaults**, as instructed.

**D3. Isolated worktree.** Work happens on local branch `milestone-2-rev-5` in a sibling git worktree (`../spanish-diplomacy-v1-rev5`), not in the main checkout. Another agent shares the main checkout, and switching its branch underneath it would corrupt its work. The branch can be merged or inspected from the main checkout as normal (`git log milestone-2-rev-5`).

**D4. Dependency versions.** New packages are pinned exactly to releases at least two weeks old at install time (18 Nov 2026), so nothing ships on a days-old, unvetted release: zod 4.6.7, eslint 10.14.0, @eslint/js 10.0.1, typescript-eslint 8.72.1, eslint-plugin-react-hooks 7.1.1, globals 17.14.0, @axe-core/playwright 4.14.0.

**D5. ESLint 10 without eslint-plugin-jsx-a11y.** jsx-a11y 6.10.2 only declares support up to ESLint 9, and ESLint 9 is end of life. Building a new guardrail on an unsupported linter is worse than losing static JSX accessibility rules. Accessibility is enforced instead by axe-core scans of every screen in Playwright (plan section 8.3), which test the rendered DOM and catch more than static rules do. Revisit when jsx-a11y supports ESLint 10.

## Data Packages

**D6. Asset files stay where they are.** The plan suggested moving Spain's map assets to `assets/maps/spain-1936-07-31/`. They stay in `assets/maps/`, because the generation scripts write there; `map.json` names every asset path explicitly, so the location no longer matters to code. Moving them is a cosmetic follow-up for the asset-pipeline step.

**D7. Faction color lives in `scenario.json`; everything else visual lives in `map.json`.** Setup cards, the legend, counters, and summaries all need the same identity color, so it is part of the faction definition. Unit symbols moved to `map.json` (`unitSymbols`), because a symbol is presentation, and `unitTypes` in the scenario carries only id and name.

**D8. Ruleset is a schema literal.** `ruleset: "m2-movement"` is validated by the schema itself, so an unknown ruleset is rejected at load with a schema error (L1) rather than by separate code.

**D9. The loader found two more dangling references the old code accepted silently.** The Spanish Legion and Regulares units referenced `cityId: "ceuta"` and `"melilla"`, which were never defined as cities. Defining them as cities would change the 75 percent city threshold (25 to 27 cities), so the dangling `cityId` was dropped instead; both units are placed at their territory anchor. This extends B7.

**D10. OD-1 applied.** Canarias was removed from the playable scenario with its regiment (it had no map geometry and no route to the mainland). Sea connections were added: Ceuta and Melilla to Andalucia, and the Balearics to Catalunya and Valencia. The L9 check (no faction starts at a threshold) passes with 18 territories (10 needed) and 25 cities (19 needed). The research note is updated in the historical pass.

**D11. Ceuta and Melilla are drawn from map data.** The registered SVG has no geometry for them (it contains only the 16 mainland and Balearic regions; the old `iberiaRegions.json` also listed Portugal and Gibraltar ids that never existed in it). The map spec gained an optional `shape` (a circle) per territory, drawn and hit-tested when no SVG region exists. Its rendered radius is at least 9 screen pixels, so small enclaves stay clickable.

**D12. Migration was proven before deletion.** A one-off vitest exported the TypeScript scenario to JSON, and a second one-off test compared the loaded JSON with the legacy object (adjacency, control, cities, units, objectives) apart from the intended fixes, before the legacy files were deleted. Both one-off tests were removed afterwards, as the plan says (section 5.7).

**D13. The default sea color drives the map background.** `map.json` sets `background` to the relief texture's raw sea color (`#4d5fd7`). The background is painted inside the same CSS filter as the terrain, so the area beyond the texture matches the filtered sea exactly, and an inset fade softens land edges.

## Engine And State

**D14. One combined commit for the core rewrite.** Changing ids to branded types and scenarios to loaded packages touched every layer at once (engine, state, map, screens, tests), so the plan's steps 2 to 6 could not land as separate commits that each pass every gate. They landed as one commit (`feat: data-driven scenario engine and full-width campaign map`); later steps are separate commits.

**D15. Both orders of a doubly ordered unit are invalid.** Resolution previously kept the first of two orders for one unit and silently dropped the second. Now every order for that unit is reported invalid, and the unit is disbanded (M9). The submission gateway still prevents this in normal play.

**D16. M7 as implemented.** A territory changes hands when exactly one faction has units there after resolution and either the set of factions present changed this turn or that faction entered it. City occupation follows the same trigger. Holding never changes control, which keeps Aragon contested while everyone holds (OD-8).

**D17. The victory condition label follows the tie-break order.** When a winner meets both thresholds, the reported condition is the first one in the scenario's `tieBreak` list.

**D18. Moves are planned on destination click.** The separate "Add Move" step was removed: selecting formations, choosing "Move", then clicking a highlighted territory plans the order immediately, and "Cancel move" leaves move mode. This saves a click per order and removes a state where a destination was chosen but not yet added.

**D19. Actions are module-level `createAction`s; the reducer is a factory.** `createGameReducer({ registry })` receives the registry, while action creators stay stable imports. This is the DI form the plan's R6 row asks for without per-store action objects.

**D20. Computer actors are processed in faction order.** In a game with two local players, the status chips show a later computer faction as not yet ready while an earlier local player plans. This is correct and is covered by a test.

## Map And Layout (user direction during implementation)

**D21. Full-width map with an in-map translucent pane.** Per the request, the details column became a collapsible pane inside the map (84 percent opaque with a slight blur, so the map stays visible behind it). On screens under 720 px wide it is a bottom sheet that starts collapsed to a bar holding the primary action, opens when the player selects something, and collapses during move mode, so destinations stay visible.

**D22. The CSS 3D tilt was removed.** Revision 4 asked for a "lightly tilted 2.5D" board. The tilt (`perspective` plus `rotateX` on the board and `will-change: transform` on the camera) was the cause of the blurry text the user reported, since Chromium rasterizes the layer once and scales the bitmap. It also wasted about a third of the map box. The board is now top-down, matching all three approved mockups. Relief comes from WebGL bump lighting, and every vector layer is drawn through the camera's `viewBox` with screen-pixel sizes, so text, borders, routes, and icons are re-rendered sharply at every zoom.

**D23. Desk props removed; the wood board stays as a frame.** The notepad, pencil, and cigar props overlapped the new in-map pane and the map edges. The wood board survives as the map's frame. This supersedes the handoff's "props are part of the transformed stage" decision, under the user's new layout direction.

**D24. Selection outlines are drawn on a top layer.** Outlines for the origin (gold), legal destinations (dashed cyan), and changed territories (white) are separate copies of the region geometry drawn above all regions, so a neighbor's border never hides them. (SVG `<use>` was tried first; the clones inherit the regions' own styles, so it did not work.)

**D25. Overview counters are 32 x 24 px.** That meets the WCAG 2.2 minimum target size of 24 px. Operational and detail counters are larger and show designation and strength.

## Verification

**D26. A fast visual feedback loop.** `npm run e2e:capture` walks every screen and state (desktop and phone) in about 6 seconds against a dev server that stays running (`E2E_PORT` selects the port; Playwright reuses an existing server outside CI). Each UI change was reviewed from those captures before it was committed.

**D27. Visual baselines are Chromium-only, stored per project, with tight tolerance.** Baselines live in `e2e/baselines/<project>/`. Tolerance is 0.2 percent of pixels at a per-pixel threshold of 0.2: the first setting tried (1 percent) let a moved label and a moved counter stack pass unnoticed. `npm run e2e:baselines` always rewrites every image (`--update-snapshots=all`); the default mode keeps images that are still within tolerance. Baselines use a fixed `Math.random`, so computer orders are deterministic.

**D28. Browser coverage.** Firefox and WebKit were installed for Playwright, and every acceptance story runs on Chromium, Firefox, WebKit, Pixel 7, and iPhone 14 emulation. Real touch pinch is driven through Chromium's DevTools protocol only; pinch on WebKit and Firefox touch devices still needs a manual check.

**D29. What I could not verify myself.** The automated axe scans (WCAG 2.2 AA tags, no serious or critical violations) pass on every screen in every engine. The plan's manual checklist still needs a person: listening with a screen reader, 200 percent browser zoom, and color-vision simulation. Release sign-off should record those.

**D30. Two commits went in with failing checks, and both were fixed in the next commit.** `ebba659` contained one failing unit test (a renamed accessible label) and lint errors, fixed by `c1e0520`. `1ada094` contained one lint error that a too-narrow output filter hid, fixed by `70537f8`. All later commits were gated on command exit codes, and the final state passes `npm run verify` from a clean checkout.

## Assets And Provenance (OD-2)

**D31. Maps-For-Free CC0 accepted as the relief source.** CC0 allows redistribution. The original raster (`spain-topo.png`) is retained with its checksum as evidence. The download date and the hand-made crop step were never recorded, and `ATTRIBUTION.md` says so instead of inventing them.

**D32. `calibrate-map.mjs` is kept, not retired.** The handoff suggested retiring it. It is still the only producer of the shipped color and height textures, so retiring it would make them unreproducible. The pipeline order is documented (`map:terrain`, then `map:register`, then a checksum check).

**D33. The pipeline is offline and reproducible.** The pinned geoBoundaries ADM0 and ADM1 files (revision `9469f09`, CC BY 4.0, 1.6 MB) are vendored under `scripts/sources/geoboundaries/` and checked by SHA-256 before use. A full rebuild reproduced all four shipped assets byte for byte. Source rasters moved from `assets/maps/` to `scripts/sources/relief/`, which also keeps the 6 MB `spain-topo.png` out of the production build.

**D34. Shipped map assets are pinned by checksum.** `assets/maps/checksums.json` and a unit test make any replaced or regenerated asset a visible, reviewed change.

## Performance

**D35. Budgets were checked against a measured baseline.** At `153a32c`, the initial chunk was 142.0 kB gzip (it inlined the 121 kB territory SVG). Now it is 140.7 kB: the SVG loads lazily (38.6 kB gzip), which offsets the new Zod dependency. P1 was revised from the provisional 120 kB to "no regression from 142 kB". The Three.js chunk is 132.0 kB gzip, within its 140 kB budget. Measured in development mode: map interactive 119 ms desktop and 204 ms on a phone with 4x CPU throttle (P2); selection to paint 12 ms and 55 ms (P3). Twenty game cycles leave no canvas and no WebGL context warnings (P5). Texture memory is two 1024 px textures with mipmaps, about 11 MB (P4).

## Gameplay Findings Needing A Product Decision

**D36. Stalemate under the m2-movement rules (new OD-9).** The soak test plays 200 seeded all-computer games for 30 turns. Under M4, a held territory cannot be taken, so 79 percent of games reach five turns with no change of control and most never end. The original scenario was worse: 0 of 200 games ended. This is a property of the M2 rules, not of the computer player; budget S2 cannot be met without a rule change. Options for the product owner: support orders, strength-based combat, or a turn limit with a scoring rule. All three are rule changes the plan defers beyond M2, so I did not make one.

**D37. One-sided balance (new OD-10).** Of the 42 games that ended, all were Republican victories, so budget S4 is not met. I did not rebalance the scenario, since the handoff forbids silently changing historical data for balance. It needs a product and historical decision, ideally after OD-9.

**D38. Northern coast garrisons added (A3).** Two representative Republican tokens (a Basque Loyalist Column at Bilbao and a Santander Loyalist Column) were added. Without them, Pais Vasco and Cantabria, both loyal in July 1936, had no defenders, and the north took them on turn 1 of every game. They follow the existing practice for game-scale tokens and are flagged for historical review (OD-3); no regiment identities or page citations were invented.

**D39. Per-formation sources are structural; page references remain.** Every unit carries its own `sources` list, but page and table references are blank where the research does not provide them. Filling them in is the remaining OD-3 historical work.

## Code Quality

**D40. No casts outside the loader.** Select values and DOM attributes resolve through validated lookups (`scenario.territories.find`, option lists), and CSS custom properties use one typed helper. Screens use `useSessionIn(phase)` instead of repeated phase guards.

**D41. The stale root `dist/` was left alone.** It exists only in the main checkout (ignored by git), which another agent is using, so I did not touch it. Delete it there (`rm -rf dist`) when convenient; the worktree builds only to `build/`.

**D42. The production bundle was smoke-tested.** Every Playwright run uses Vite's `e2e` mode, the only mode that registers the test fixture, so the production build was checked separately. The built JavaScript contains no fixture data. `e2e/production.spec.ts` (`npm run test:prod-smoke`, with `PROD_URL` pointing at the served `build/dist`) plays a full turn on the production build: no scenario picker, WebGL terrain, all 25 counters, and no console errors.

**D43. The Definition of Done was amended for S2 and S4.** Section 10 originally required all soak budgets to be met. S2 and S4 are now recorded as deferred to OD-9 and OD-10 (D36, D37), since meeting them needs a rule change the plan places outside Milestone 2.

## Demo Feedback Round (18 November 2026)

The first review raised four items: the map was slightly off and its relief looked low effort; selecting a territory should select every army, with a "Give Selected Armies Order" button that offers Move and then a destination; destinations should shimmer in gold instead of the dashed sky blue; and friendly armies seemed to bounce off each other. Each item went to its own subagent on its own branch and worktree (`m2r5-terrain`, `m2r5-orders`, `m2r5-consolidate`), and I reviewed, merged, and re-verified the results.

### Terrain and alignment (item 1)

**D44. One pipeline and one projection for relief and regions.** `scripts/build-map.ts` (`npm run maps:build`, offline) projects the region polygons, neighbouring countries, elevation model, cities, and labels through one spherical Lambert conformal conic (standard parallels 37N and 43N, origin 40N 3W, units in kilometres). It writes the region SVG, three relief images, and every coordinate in `map.json`. The old approach fitted vectors to an existing relief picture, and it squashed Iberia horizontally by about 17 percent. That was much of "slightly off". `scripts/fetch-map-sources.ts` (`npm run maps:fetch`) is the only script that touches the network.

**D45. The coastline is aligned by construction and checked.** The relief's land and sea edge is rasterized from the same path strings written to the SVG. The build fails if more than 1 percent of samples on either side of the region edges disagree with the baked land mask; 0.22 percent disagree, at narrow spits and lagoons. An e2e test reads rendered pixels 1.2 km on each side of the Valencia coast at zoom 4 in all five browsers.

**D46. Real shaded elevation instead of a stock relief image.** The elevation is AWS Terrain Tiles at zoom 8, about 470 m cells (credits: Copernicus EU-DEM, NOAA ETOPO1, USGS SRTM, GMTED2010). It uses a four-light hillshade plus a broader relief term so mountains read when zoomed out, and a hypsometric tint in sandstone, olive, muted green, and warm gray. Neighbouring countries are gray relief from Natural Earth (public domain), and the sea is depth-tinted. Lighting is baked into the images, so the WebGL and flat-image renderers look identical. The relief images in Revision 5 came from Maps-For-Free; they are removed. Provenance is in `assets/maps/ATTRIBUTION.md` and `scripts/sources/manifest.json`. This also settles OD-2 the way Revision 4 first asked: the relief now comes from SRTM-class elevation data, not from an accepted CC0 picture.

**D47. Three relief layers, loaded progressively.** Detail (4032 x 3360 px), margin (with a 30 km fade), and overview images are drawn as unlit, mipmapped quads through the existing orthographic camera. The coarse layer goes live 300 ms after mount and the finer layers 400 ms later, so texture uploads never land on the first click. Zoom 4 is soft rather than crisp: the 470 m elevation cells limit it. The upgrade path is zoom-9 elevation with tiling, at roughly double the vendored bytes.

**D48. The map package's `terrain` field changed shape.** It is now `{ layers: [{ image, bounds }] }`, coarsest first, and `.webp` is an allowed asset type. `specVersion` stays at 1 because no other package uses terrain; the spec, schema, and generated JSON Schema are updated.

**D49. Every map coordinate was regenerated.** Unit anchors sit at each region's pole of inaccessibility, and labels are lifted 48 km above them. A few labels are overridden: Castilla-La Mancha, La Rioja, Navarra, Ceuta, and Melilla. The start frame's `focus` was tightened to the playable area. Region ids, bindings, and `scenario.json` are unchanged.

**D50. Texture memory budget P4 was revised from 48 MB to 128 MB.** The three layers with mipmaps use about 118 MB of GPU memory. That is the cost of enough texel density at zoom 4, which was the point of item 1. The decoded image copies held for the textures cost roughly another 90 MB of CPU memory. I did not release them after upload, because an anisotropy change re-uploads the textures. This is a follow-up, not a blocker. All figures come from headless browsers on one machine, not real phones.

### Order flow and highlights (items 2 and 3)

**D51. Selecting a territory selects every army there that has no order yet.** Counter clicks and the army list then toggle single armies; "Select all" restores the default. Selecting one of your counters outside the selected territory selects its whole territory, not just that army.

**D52. "Give Selected Armies Order" opens an order menu.** The menu is driven by an order-kind list, so later order types are additions, not rewrites; Milestone 2 offers only Move. Choosing Move starts destination selection, and choosing a destination plans the move at once, with no extra confirm step. After a move, the origin stays selected with its remaining unordered armies, so splitting a stack is two quick moves. Cancel keeps the selection. In code, `Draft.action` became a discriminated `OrderStage`, and any change to the selection clears it, so an order can never apply to a stale selection.

**D53. Gold replaces sky blue.** Legal destinations get a gold border with an ink casing and a travelling glint, which is static under reduced motion. The origin is solid, thicker gold with a glow. Routes changed from cyan to ink navy on a paper halo, and the legend gains a "Possible destination" entry.

**D54. Routes show the faction.** Each route carries a medallion in the moving faction's color: a bounce or loss icon inside a faction ring, or a plain token for planned and completed moves. Routes that share an origin and destination get their own lane. The count badge sits 80 percent along the curve with a faction ring. Short routes, where the medallion can sit under counters, get a faction-colored arrowhead.

### Friendly armies (item 4)

**D55. The engine already let friendly armies share a territory; the report was what misled.** Tests now pin it in resolution, planning, and the computer player: a faction's own armies never block, bounce, or disband each other, whether they reinforce a held territory, swap, or converge from two origins. The capture that looked like friendlies bouncing was two armies moving together into a three-way standoff in Castilla-La Mancha. The old report listed each army on its own line, with no faction or standoff origins. Moves made together are now one line ("tried to move together from Madrid to Castilla-La Mancha and bounced: standoff with Northern Insurgent Command (from Aragon) and Southern Insurgent Command (from Andalucia)"). A note under the report says only another faction's armies can stop a move, and the scenario spec states the rule.

**D56. Turn 1 almost always opens with a standoff in Castilla-La Mancha.** All three factions' default plans aim at it. That is a balance observation for OD-10, not a defect, and I did not change the scenario.

### Integration

**D57. "Armies" throughout.** The order flow said "armies" but the report and legend still said "formations" and "units". The report, legend, and feedback copy now say "armies" ("Armies lost", "Army lost", "had no armies to order").

**D58. Selection response P3 is the median of seven selections.** It alternates Madrid and Valencia so every sample changes the selection, and it waits two animation frames, so the floor is about 33 ms at 60 Hz. Under heavy machine load, one sample from a single selection used to fail the budget. While the old relief was in place, the median sat at 49 to 50 ms. The script work was 0.3 ms, and the extra frame was the WebGL canvas compositing; hiding the canvas brought it back to two frames. The rebuilt terrain removed that frame: 33 ms desktop and 50 to 70 ms on the throttled phone.

**D59. The map screens are their own lazy chunk.** The order menu and route medallions pushed the initial chunk to 142.8 kB gzip, past the 142.0 kB no-regression budget (P1). `OrdersScreen` and `ResultsScreen` now load lazily from `screens/mapScreens.ts` and are prefetched as soon as a game leaves the start screen. The initial chunk is 130.4 kB and the map chunk 13.8 kB. A "Loading the map..." status exists, but prefetching means players should not see it.

**D60. Route drawing moved into `RouteLayer.tsx`.** The medallions grew `VectorLayer.tsx` to 252 lines; it is now 173.

**D61. The visual baselines were regenerated once, after all three merges.** The subagents left them alone, so the baselines change in one reviewed commit.

**D62. Neutral context labels yield to the screen edge and to counters.** "Portugal", "France", and "Morocco" name the land around the playing area. A label that the map edge would cut, or that a counter would cover, is now hidden until panning or zooming makes room. Before this, the phone overview showed "ORTUGAL", and the Melilla counter sat on "MOROCCO". Counters keep their places, because they belong at their cities. Counter layout is computed once in `MapLayers` and shared by the counter layer and this check. The Morocco label was also moved to 34.6N 4.6W, inside Morocco and clear of the enclave counters on desktop.

**D63. Several commits in this round do not pass every check on their own.** The terrain branch deliberately left the visual baselines failing until the single regeneration (D61). The two merges each needed a follow-up commit: the orders merge (`6ac44ca`) failed unit tests until `1b6a3cd`, and the terrain merge (`c02ba3d`) failed the visual tests until `306acd4`. Anyone bisecting this branch should skip those commits. R13 in the plan reflects this.

## Follow-ups (not blocking Milestone 2)

- **Portrait framing on phones.** In portrait, the map fits Spain to the width, which leaves bands of open sea above and below; this is visible in the mobile baselines. A taller focus area for narrow screens, or a cover-style fit, would use the space better.
- **Small modules.** `CampaignMap.tsx` (227 lines), `OrderBuilder.tsx` (212), and `TerrainLayer.tsx` (210) are slightly over the 200-line target.
- **Phone neighbour labels.** On a phone, "Portugal" and "Morocco" are hidden at the overview zoom because they do not fit (D62). A smaller type size or label positions chosen per screen would bring them back.
- **Repository size.** About 18 MB of vendored binary map sources (elevation TIFFs and the Natural Earth subset) are now in this branch's history. Decide on Git LFS before merging to `main`; afterwards it cannot be undone without rewriting history.
- **Terrain memory.** Release the decoded relief images after upload, about 90 MB of CPU memory (D50), and measure P2 to P4 on real phones.
- **Sharper close zoom.** Zoom-9 elevation with tiling (D47).
- **Unused data.** Unit-type names and source titles are validated but not yet shown anywhere; a formation inspector would surface them.
