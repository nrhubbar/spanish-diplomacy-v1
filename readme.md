Spanish Diplomacy (V1)
---

A browser strategy game inspired by Diplomacy: every player plans orders in secret, all orders are revealed at once, and the turn resolves deterministically. The first scenario is Spain on 31 July 1936, with three commands: the Republican Government and the Northern and Southern Insurgent Commands.

![Planning on the campaign map](./e2e/baselines/chromium/planning-operational.png)

## Playing

- **Create Game**, then assign each command to a local player or a computer player. Several people can share one device; the game hands it over privately between them.
- Select a territory (or one of your armies) on the map. Every army there without an order is selected; click an army in the list or on the map to leave it out.
- Choose **Give Selected Armies Order**, then **Move**, then click one of the territories with a shimmering gold border. **Cancel** backs out with the same armies still selected. Armies without orders hold.
- **End Turn**. When the last local player ends the turn, it resolves at once and the turn report shows what happened. **Start Next Turn** carries on.
- Win by controlling 51 percent of the territories or 75 percent of the cities.
- Map controls: drag or use W A S D to pan, scroll, pinch, or use + and - to zoom, and 0 to reset. Tab to a territory and press Enter to select it.

## Running

```
npm ci
npm run dev          # http://127.0.0.1:5173/assets/
npm run verify       # lint, types, unit tests with coverage, build, and Playwright
```

## Scenarios

Scenarios are data, not code. Each one is a folder under `src/main/scenarios/` with a `scenario.json` (rules data) and a `map.json` (presentation), validated against the specs in `project/specs/`. Adding a folder adds a scenario.

Project planning, milestone specs, and decision logs are in `project/`.
