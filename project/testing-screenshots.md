# Finding and Making Test Screenshots (SOP)

Use this guide when you need images of the real, current app: for a design review, a mockup base, a bug report, or to check a UI change by eye. Every path is relative to the repository root.

## The four kinds of screenshot

| Kind | Where it lands | How it is made | Committed? |
|---|---|---|---|
| **Review captures**: every screen and state, desktop and phone | `build/e2e/screenshots/<project>-<NN-name>.png` | `npm run e2e:capture` (tests tagged `@capture` in `e2e/capture.spec.ts`) | No, `build/` is ignored. Regenerate them. |
| **Visual baselines**: the pixel-compared reference images | `e2e/baselines/<project>/<name>.png` | `e2e/visual.spec.ts`; update with `npm run e2e:baselines`, but only when the change is intended | Yes |
| **Failure evidence**: what a failing test saw | `build/e2e/test-results/<test>/` (screenshot and trace); HTML report in `build/e2e/playwright-report/` | Any `npm run test:e2e` failure (`screenshot: only-on-failure`, `trace: retain-on-failure`) | No |
| **Design images**: mockups and reviewed captures kept with the docs | `project/milestones/**/images/*.webp`, `project/milestones/*.png` | Mockup scripts (see the last section) | Yes |

`<project>` is a Playwright project from `playwright.config.ts`:
- `chromium` is the desktop at 1440 × 800;
- `mobile-chromium` is a Pixel 7.

Captures run on these two. Firefox and WebKit run only in `test:e2e`.

## Getting fresh review captures

```sh
E2E_PORT=5291 npm run e2e:capture
ls build/e2e/screenshots
```

- **Always set your own `E2E_PORT`.** Off CI, Playwright reuses any server already on the port, which defaults to 5173. That server may belong to another checkout or session and serve different code.
- **Check the timestamps** (`ls -la build/e2e/screenshots`) before trusting a capture. Old files stay until a run overwrites them.
- **A full run takes about 30 seconds** and also starts Vite in `e2e` mode.

## What each capture shows

The number orders captures by the player's journey. Look at the test in `e2e/capture.spec.ts` for the exact steps.

| Capture | Screen |
|---|---|
| `01-home`, `02-setup` | Home and game setup |
| `03-planning-overview` | Turn 1 planning, whole map |
| `04a-territory-selected`, `04b-order-menu`, `04-choosing-destination`, `05-planned-orders` | Selecting Madrid, the order menu, choosing a destination, and orders on the map |
| `06-operational-zoom`, `07-detail-zoom` | Map zoomed in two and five steps |
| `08-pane-collapsed`, `08b-pane-open` | Orders pane hidden and shown |
| `09-resolution`, `10-resolution-legend`, `10b-resolution-report` | Turn resolution, the legend, the turn report (phone) |
| `11-handoff` to `14-game-over` | Hot-seat handoff and game over (tiny-front fixture) |
| `15-relief-zoom4-*` | Relief close-ups at device pixel ratio 2 |
| `16a`–`16c` briefing | The in-map Briefing |
| `17-*` counters, `17a`–`17c` | Counter states at overview and detail zoom; army list |
| `18-destination-odds` | Odds on destinations (map chips and pane) |
| `19a`–`19g` battle cards | Turn report battle cards, three-sided battle and its rule, collapsed cards, legend, the d20 card (`19f`), a battle icon's tooltip (`19g`) |
| `20a`–`20f` | Weather and the turn timer: setup, planning, destinations, paused, ten seconds, time ran out |
| `21a`–`21d` | Economy: the Build tab, the focused build list, a queued build, a resource chip's detail |
| `22a`–`22e` | Sub-territories and contested ground: overview, orders, Withdraw, zoom, the focus view |
| `23a`–`23c` | Movement: destinations, the route card, rail at the operational zoom |
| `24a`–`24d` | Air and generals: the general's pill, a raid, an interception, the air report |
| `25a`–`25d` | Recruitment: the Recruit tab, locked details, units in training, a provincial territory |
| `26-replenish` | The Replenish order on turn 2 (X7) |

## Adding a capture

- **Add the test to `e2e/capture.spec.ts`** and put `@capture` in its title. `npm run test:e2e` runs everything without that tag, so an untagged capture test would run in `verify`.
- **Reuse `capture(page, "NN-name")` and `waitForMap(page)`.** The map is not ready until the terrain layer reports `data-renderer="webgl"` and `data-refined="true"`.
- **Pick the next free number,** and keep names short and kebab-case.

## Making mockups from the real app

There are two pipelines, both in `project/milestones/milestone-3-ideation/`:

| Pipeline | What it does |
|---|---|
| `mockups/render.mjs` | Draws HTML/CSS mockups over base captures. It copies them from `build/e2e/screenshots`, falling back to `e2e/baselines/chromium`. Static, good for one isolated idea. |
| `ux-pass/render.mjs` | Drives the live app with Playwright, injects mock UI into the real map SVG and Orders pane with the app's own classes, then captures each option. Features stack, so every image shows the others too. Use this when designs interact. |

Both write WebP to the milestone's `images/` folder. A mockup must never change `src/`, `assets/maps` or the map checksums.
