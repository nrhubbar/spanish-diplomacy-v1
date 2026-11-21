# m3r2-map-layers: progress

> Internal. Phase 2 of Milestone 3 Revision 2 (tasks §3.3 `map-layers`): U8 (roads and passes drawn), U13 and U14.

## Done

- **U13 toolbar.** `map/layers/LayersToolbar.tsx`: on desktop a bar centred along the bottom of the free map (Orders, Logistics, Economy, then More with a switch per layer); on a phone one Layers button, top right, holding the same. The pure rules are in `map/layers/layerChoice.ts`: presets, `activePreset`, `toggleLayer`, `autoLayers`, `shownLayers`, `hiddenLayers`, `showsSubTerritoryBorders`, `roadStyle` and `layersControlObstacle` (counters and names keep clear of the control). The choice is kept in `state/mapLayersSlice.ts`, wired through `MapScreenFrame`; `CampaignMap` puts `data-hidden-layers` on the map and `_layers.scss` hides what is off (declog ML1 to ML6).
- **Note 4.** Past 250% zoom, with Sub-territories on, every sub-territory shows a dashed border and its name (`SubTerritoryLayer.tsx`, `borders`).
- **U8 roads.** `map/layers/roads.ts` builds the roads and passes from the scenario's links; `RoadLayer.tsx` draws them under the rail in the vector layer's underlay. Main roads are heavier and solid, tracks faint and dashed; a pass is a chevron named on hover. The rail drawing is unchanged (declog ML7).
- **Legend.** `legendEntries` takes the layers shown: rail, order lines and battle results only when on; main road, track and mountain pass when Roads is on.
- **U14.** A raid's line ends on the target sub-territory's town (note 7's probe case copied into `src/test/ui/airOnMap.test.tsx`, passing). The air pane offers Patrol, Ground Support, Raid, Recon; selecting an aircraft leaves no army selected, so the selection bar offers no ground orders (tested; declog ML8).
- jsdom tests updated: `airUi.test.tsx` (Ground Support), `hiddenScreens.test.tsx` (looks for secrets outside the toolbar, which names its own Rail switch).

## Checks

`npm run lint`, `npm run typecheck`, `npm run test:unit` (107 files, 1402 tests, coverage gate) pass.

Per-file coverage: the new files are at 100%. Touched files already below the gate are not lower; only covered branches were added: `CampaignMap.tsx` (80.8 branches; the X3 sub-territory click lines were already uncovered), `AirLayer.tsx` (84.3 branches), `AirPane.tsx` (86.8 branches), `MapLayers.tsx` (91.7 functions; the terrain fallback callback).

## Review

The diff review found nothing blocking. Of its low findings, none needed a code change:
- Contested sub-territories already draw a solid border with their wash, so the dashed border is for the others only.
- With Sub-territories off, every sub-territory name is hidden, contested ones too. That is what the switch means, and the focused sub-territory's outline still shows.
- The obstacle sizes match the SCSS sizes by hand.
- The choice carrying over to a new game is intended (ML6).

## Left

- Economy shows sub-territories only; what each one yields isn't drawn on the map (no such layer exists yet).
- `map-orders` reworks the order lines and `RouteLayer`; the Order lines switch hides them by class (`map-route-*`, `move-route`, `air-mission-line`), so keep those class names or update `_layers.scss`.
- Visual check in a browser and the baselines are the owner's (no Playwright run here). The new toolbar will move the Playwright baselines.
