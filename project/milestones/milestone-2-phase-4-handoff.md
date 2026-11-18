# Milestone 2 Phase 4 Handoff

**Handoff date:** 18 November 2026

**Audience:** Senior engineer taking ownership through Milestone 2 release

**Starting point:** `main` at `af390a8`, plus the in-progress worktree described below

## Executive Summary

Phase 4 has a working end-to-end campaign loop and a substantially rebuilt production map. The current implementation supports configurable local and computer commanders, private shared-device handoffs when they are required, independent formation orders, deterministic computer submissions through the normal order gateway, turn resolution, victory evaluation, and next-turn progression.

The map now uses registered open administrative geometry over local relief, a WebGL terrain surface with an image fallback, one shared camera model, semantic zoom, scalable NATO counters, vector orders and outcomes, northern Morocco context, and one camera-transformed command-table stage. Pan, wheel zoom, pinch, keyboard controls, and responsive layouts are covered by unit or Playwright tests.

This work is not ready to declare Milestone 2 complete without a senior release pass. The primary blockers are:

1. Reconcile the terrain-source pipeline with the approved SRTM requirement and prove every shipped raster can be redistributed and reproduced.
2. Decide whether the documented modern-region/contested-area abstraction satisfies the historical-accuracy requirement; the current scenario does not provide province-level 1936 fronts or per-formation source citations.
3. Close the remaining acceptance-test, accessibility, browser, fallback, performance, and visual-collision gaps listed below.
4. Review and split the large in-progress worktree into focused implementation commits. This handoff document is intentionally committed separately.

## Product Decisions To Preserve

- The game uses three operational commands: Republican Government, Northern Insurgent Command, and Southern Insurgent Command. The two insurgent commands are a game abstraction, not independent historical states.
- The scenario snapshot is 31 July 1936. Recruitment, reinforcements, replacements, and income remain Milestone 3 work.
- Computer commanders must receive the same legal game-state view and submit through the same validated submission gateway as a human. They must not inspect another commander's draft or locked orders.
- A privacy handoff is shown only when at least two local people share the device. A one-local/two-computer game enters planning directly.
- The outer map box is the camera viewport. Wood, paper, pencil, cigar, terrain, borders, cities, counters, and orders are one transformed stage; only zoom controls remain fixed to the viewport.
- Gold is reserved for active selection. Legal destinations and planned routes use cyan. Ownership and outcome states must not reuse the selection language.
- Portugal, France, and Morocco are neutral geographic context. The Balearics remain playable and contested.
- NATO counters remain compact at overview scale and reveal designation/strength through semantic zoom rather than scaling at the same rate as terrain.
- Internal planning notes, historical rationale, and quality-bar copy must never appear in the player-facing game. Source attribution is allowed and currently appears in Settings.

## What Is Implemented

### Game Loop And Actors

- Home screen with Create Game and Settings.
- Commander assignment using `At this device`, `Computer commander`, and a disabled remote-player option.
- Mixed local/computer, multiple-local, and all-computer turn orchestration.
- Historically motivated deterministic computer player using legal move enumeration and the standard submission model.
- Private handoff state for multiple local players; no redundant handoff for the default single-local game.
- Independent unit selection, `Select all available`, one-order-per-unit enforcement, order removal, and submission locking.
- Resolution, city and territory victory progress, terminal game-over state, and repaired `Start Next Turn` routing.
- Route guards for setup, handoff, orders, resolution, and game-over screens.

### Map And Presentation

- `scripts/register-geography.mjs` converts pinned geoBoundaries gbOpen Spain ADM0/ADM1 geometry into the local terrain view box and emits the runtime SVG and neutral-surroundings mask.
- `iberia-registered.svg` is the runtime territory and hit-test authority. Runtime overlays use the same coordinate system without another projection transform.
- Three.js renders shallow displaced relief from local color and height textures. Static relief remains visible if WebGL is unavailable.
- A pure camera module owns pan, zoom, clamping, focus-point zoom, reset, and semantic levels.
- Mouse wheel over the map does not scroll the page. Drag, synthetic pinch, WASD, arrows, `+`, `-`, and `0` use the same camera state.
- City coordinates and unit anchors were reprojected to the registered terrain.
- Counter stack placement, screen-space compensation, compact strength, designation initials, planned-order badges, vector arrows, bounce markers, and disband markers are implemented.
- At overview scale only selected major city labels remain; closer zoom levels reveal more unit and geographic detail.
- Desktop and mobile layouts avoid horizontal overflow.

### Testable Separation

The camera math, map presentation rules, and terrain render metrics were extracted from the React/WebGL lifecycle into pure modules:

- `src/main/components/mapCamera.ts`
- `src/main/components/mapPresentation.ts`
- `src/main/components/terrainRendering.ts`

Keep future interaction and scaling rules in these modules when possible. `WebGLTerrain.tsx` should remain an adapter that owns Three.js resource lifecycle, not game rules.

## Current Verification Baseline

The following passed on the current in-progress worktree before this documentation-only commit:

| Gate | Result |
|---|---|
| `npm run test:unit` | 54 tests passed in 5 files |
| Statement coverage | 95.13% |
| Branch coverage | 90.27% |
| Function coverage | 93.61% |
| Line coverage | 96.30% |
| `npm run test:e2e` | 6 Chromium stories passed |
| `npm run build` | TypeScript and Vite production build passed |
| `npm audit --omit=dev` | 0 known vulnerabilities |
| `git diff --check` | Passed |

The Playwright suite currently covers setup, mixed actors, multiple-local privacy, all-computer turns, camera inputs, semantic counter scaling, order creation, resolution, next-turn progression, route guards, desktop captures, and a mobile capture.

Generated screenshots are intentionally ignored under `build/e2e/screenshots/`. Useful local review artifacts are:

- `milestone-2-faction-setup.png`
- `milestone-2-planned-orders.png`
- `milestone-2-map-zoom.png`
- `milestone-2-map-detail.png`
- `milestone-2-resolution.png`
- `milestone-2-mobile-planning.png`
- `geography-registration-preview.png`

## Worktree And Commit Safety

At handoff there are 39 modified or untracked implementation paths on top of `af390a8`, excluding this document. They contain the Phase 4 implementation, source assets, generated runtime assets, tests, mockups, and scripts. Do not reset or discard them.

Before further feature work:

1. Review `git status --short` and separate source files from generated or exploratory artifacts.
2. Confirm which runtime-derived files under `assets/maps/` must be committed for offline builds.
3. Keep `build/`, coverage, Playwright results, and screenshots untracked.
4. Split the implementation into focused commits, suggested as:
   - scenario, actor orchestration, and victory;
   - map-source registration and attribution;
   - camera, WebGL terrain, and presentation;
   - screens and responsive styling;
   - unit and Playwright coverage;
   - milestone documentation and reviewed mockups.

## Remaining Work

### P0 - Release Blockers

#### 1. Resolve Terrain Provenance And Reproducibility

`milestone-2-rev-4.md` requires a local height asset produced from USGS SRTM and says `spain-topo.png` must not ship without confirmed provenance. The implementation currently attributes the relief to Maps-For-Free CC0 and derives registered color/height textures from that raster.

Choose and document one release path:

- **Preferred:** rebuild color relief and height data directly from pinned public-domain SRTM plus an approved open geographic layer; or
- formally accept the Maps-For-Free CC0 source after preserving the exact source URL, retrieval date, license evidence, original checksum, crop bounds, and deterministic conversion steps.

Then verify `assets/maps/ATTRIBUTION.md`, the Settings attribution, and the milestone plan all describe the same source of truth.

#### 2. Make The Map Pipeline Clean-Checkout Reproducible

- `map:register` fetches pinned GeoJSON from GitHub and launches Chromium. Decide whether the pinned inputs should be vendored so normal builds do not depend on network availability.
- Add source and output checksums and fail registration when the fit score or expected region set regresses.
- Run `npm run maps:build` from a clean checkout and compare every emitted runtime asset byte-for-byte or with documented image tolerances.
- Consolidate or retire `scripts/calibrate-map.mjs`. It still represents the older MapChart geometry calibration path and can overwrite related derivatives before `map:register` corrects them.
- Decide whether `iberia.svg`, intermediate JPG/PNG files, and mockup assets are retained references or removable experiments.

#### 3. Obtain Historical Scenario Sign-Off

The current research note openly states that modern autonomous-community geometry cannot represent 1936 provincial front lines. Mixed areas are marked contested and important city exceptions are stored separately. This may be an acceptable Milestone 2 abstraction, but it does not literally satisfy the original request to pre-divide territories and formations at historically accurate granularity.

A product/historical review must decide whether to:

- accept the contested modern-region abstraction for this milestone; or
- introduce province/sub-territory geometry before release.

Also replace the shared generic unit note and shared source pair with traceable evidence per formation: source, page/table reference, allegiance, location, strength confidence, and any merge/omission rationale. Validate every city controller and formation against the same 31 July snapshot.

Do not silently improve play balance by changing historical starting control. Record any approved abstraction in `project/scenarios/spain-1936-07-31-research.md`.

#### 4. Close Acceptance-Story Gaps

Add Playwright coverage for:

- three local commanders completing a full turn;
- two colocated units receiving different legal destinations in one order set;
- a deterministic game-over flow and blocked next-turn action;
- the image fallback when WebGL creation or texture loading fails;
- a captured multiple-local handoff state;
- camera behavior after real touch-style pinch sequences, not only constructed pointer events.

Keep the tests user-story focused. Avoid asserting internal Redux state from Playwright.

#### 5. Complete Release Accessibility And Browser Checks

- Run an automated accessibility scan on home, setup, planning, handoff, resolution, settings, and game-over screens.
- Manually verify keyboard-only use, visible focus, screen-reader names/states, 200% browser zoom, reduced motion, common color-vision simulations, and text/background contrast.
- Verify wheel/trackpad, touch pinch, and pointer capture in the supported Chrome, Safari/WebKit, and Firefox matrix. Chromium-only success is not enough evidence for the gesture requirement.
- Confirm that compact visual counters retain at least an accessible hit target and that ordered/disabled counters announce their state.

### P1 - Production Quality

#### 6. Replace Fixed Stack Offsets With Collision-Aware Placement

Current counters use deterministic rows and columns, and overview city labels use a hand-picked major-city set. Dense northern formations and labels can still collide or obscure borders at some pans and viewport sizes.

Implement a small deterministic placement pass that considers counters, city labels, viewport edges, and critical borders. Keep hit targets and DOM reading order stable. Add fixture-based unit tests for placement and screenshots for the dense north and Barcelona/Valencia coast.

#### 7. Profile WebGL And Bundle Cost

- The lazy Three.js chunk is approximately 533 kB before gzip and terrain uses a 160-by-160 segmented plane.
- Establish desktop and representative mobile budgets for first interaction, texture memory, resize work, steady-state frame time, and context creation.
- Test repeated route entry/exit for canvas, texture, observer, and WebGL-context leaks.
- Add context-loss/restoration behavior or explicitly fall back to the static relief.
- Tune segments, pixel ratio, anisotropy, and texture dimensions from measurements rather than visual preference alone.

#### 8. Add Visual Regression Protection

The suite writes screenshots but does not compare them. Establish reviewed baselines or a deliberate image-diff workflow for setup, overview, operational zoom, detail zoom, resolution, mobile, and fallback rendering. Use tolerances that permit GPU raster differences without hiding projection drift or layout breakage.

#### 9. Final UX Pass

- Recheck northern labels/counters and resolution-route density at every semantic level.
- Confirm the unified desk/map stage still feels intentional while panning: the wood edge and props should move with terrain; controls should remain fixed.
- Review resolution-panel information density on shorter laptop viewports.
- Confirm all selectable, legal, ordered, bounced, disbanded, contested, and occupied states are distinguishable without color alone.

### P2 - Cleanup And Documentation

- Remove the unused `_controller` argument from the `city` helper or make it the single source for `initialCityControl`; the current duplication can drift.
- Strengthen city IDs and `initialCityControl` typing rather than casting a generic string record.
- Add a concise root README update describing the delivered game loop and supported inputs after the release scope is approved.
- Reconcile the original Milestone 2 handoff language with the later product decision that skips handoff when fewer than two local people share the device.
- Record the supported browser/device matrix and map-asset rebuild procedure.
- Remove obsolete exploratory assets only after confirming they are not the sole source for a runtime derivative.

## Recommended Finish Order

1. Preserve and split the in-progress implementation into reviewable commits.
2. Resolve relief provenance and make the asset pipeline reproducible from a clean checkout.
3. Obtain product/historical sign-off on territory and unit granularity; update scenario data and research notes as required.
4. Add the missing engine/state tests for any scenario changes.
5. Add the missing Playwright acceptance stories and WebGL fallback coverage.
6. Complete accessibility and cross-browser input verification.
7. Profile and tune WebGL, asset size, and lifecycle behavior.
8. Implement collision-aware counter/label placement and review all screenshots.
9. Run every release gate from a clean checkout and update the final milestone documentation.

## Definition Of Done For Senior Sign-Off

- Historical granularity and every scenario abstraction have explicit product approval and traceable sources.
- All shipped map assets have verified redistribution rights, checksums, attribution, and reproducible generation steps.
- A clean checkout can build and test without undocumented local files.
- Unit coverage remains at or above 90% for statements, branches, functions, and lines.
- All actor mixes, privacy transitions, independent unit orders, next-turn behavior, victory, route guards, camera inputs, and fallback rendering have passing integration coverage.
- Supported browsers and devices pass mouse, trackpad, touch, keyboard, accessibility, and responsive checks.
- WebGL performance and cleanup meet recorded budgets; the static fallback remains usable.
- Reviewed visual baselines show aligned geography, readable counters and labels, clear state hierarchy, northern Morocco land context, and no overflow at desktop or mobile sizes.
- No internal planning language is rendered in the game.
- Milestone 3 recruitment, reinforcement, and income work has not leaked into this release.

## Primary References

- `project/coding-principles.md`
- `project/milestones/milestone2.md`
- `project/milestones/milestone-2-rev-4.md`
- `project/scenarios/spain-1936-07-31-research.md`
- `assets/maps/ATTRIBUTION.md`
- `src/main/scenarios/milestone2Scenario.ts`
- `src/main/state/gameSlice.ts`
- `src/main/components/IberiaMap.tsx`
- `src/main/components/WebGLTerrain.tsx`
- `e2e/app.spec.ts`
