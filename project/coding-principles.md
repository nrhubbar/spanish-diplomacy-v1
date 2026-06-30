# Coding Principles

## Product Direction

- Build a browser-based simultaneous-orders strategy game inspired by Diplomacy and board wargames.
- Prioritize a small playable vertical slice over broad simulation scope.
- Keep the rules engine as the source of truth; UI collects and explains decisions.
- Prefer deterministic resolution before adding randomness, fog of war, or hidden unit systems.
- Treat scenario data as explicit, readable source material for maps, factions, units, victory, and special rules.

## Architecture

- Use TypeScript with strict type enforcement.
- Keep build, test, and config files at the repository root.
- Keep source code under `src/main`, unit tests under `src/test`, Playwright tests under `e2e`, static entry assets under `assets`, and generated output under `build`.
- Prefer common React project conventions unless there is a clear project-specific reason not to.
- Use proven libraries for common application infrastructure, such as routing, state management, testing, and browser tooling.
- Prefer commonly used packages with active maintenance and compatible peer dependencies.
- Use the latest stable or LTS package versions unless a known compatibility issue requires pinning older versions.

## React And State

- Use React Router for screen routing; do not hand-roll route switches with conditional view logic.
- Use Redux Toolkit for shared app state and middleware.
- Keep screens and meaningful components in their own files.
- Keep components focused on rendering and user interaction.
- Use typed Redux hooks instead of repeating app dispatch and selector types.
- Prefer dependency injection where it keeps code testable, such as store creation with optional preloaded state.
- Use app-level notification state for info, warning, and error messages instead of ad hoc alerts.

## Engine And Game Logic

- Keep rules logic pure and independently testable outside React, browser APIs, and persistence.
- Prefer functions, discriminated unions, explicit data structures, and immutable inputs.
- Avoid premature generic abstractions.
- Validate orders through the engine, not the UI.
- Represent maps and scenarios with data first; visual layers should bind back to stable territory and sub-territory IDs.
- Prefer deterministic tests for movement, validation, combat, control updates, and turn resolution.

## Testing And Quality

- Maintain at least 90 percent coverage for statements, branches, functions, and lines.
- Add unit tests for core logic and integration tests for user-visible flows.
- Use Playwright for browser behavior and routing smoke tests.
- Keep Playwright screenshots and traces under `build/e2e`.
- Inspect relevant desktop and mobile Playwright screenshots when developing visual features.
- Run `npm run build`, `npm run test:unit`, and `npm run test:e2e` before claiming implementation work is complete.
- Keep generated artifacts out of git, including dependency folders, coverage, test results, and build output.

## UX Direction

- Make the first playable version easy to start and understand without reading a manual.
- Teach through affordances, validation, previews, tooltips, and clear summaries.
- Start with abstract SVG-compatible map interactions so richer map art can replace the geometry later.
- Favor a board-game feel over a generic SaaS dashboard.
- Keep UI controls familiar, accessible, and testable.

## Git And Documentation

- Use short Conventional Commit messages.
- Keep commit scope focused.
- Prefer ASCII characters in source and docs unless non-ASCII text is necessary.
- Keep root docs concise and human-facing.
- Put AI steering, milestone specs, planning, and health notes under `project/`.
