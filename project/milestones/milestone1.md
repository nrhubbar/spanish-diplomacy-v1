# 1) Milestone 1: Thin Vertical Slice

Milestone 1 proves the smallest playable loop that combines the rules engine, React UI, Redux state, and an SVG map of Iberia.

The goal is not final game design. The goal is a working debug-grade turn loop where one human plays all three factions, submits visible move orders, resolves them deterministically, and starts the next turn.

## 1.1) Acceptance Criteria

- A user can start from the current app shell and begin a new local in-memory game.
- A setup step creates a 3-faction scenario across the Spanish regions with 1 soldier per faction.
- The game displays an SVG map of Iberia with stable geographic territory IDs.
- Galicia, Catalunya, and Andalucia contain the starting units; all other Spanish regions start unoccupied.
- Each faction starts with exactly 1 soldier.
- One human locally submits orders for player 1, then player 2, then player 3.
- Orders are visible debug orders, not hidden orders.
- Each player may either submit one move order for their soldier or submit no move.
- Move orders are the only explicit order type.
- A unit that has no submitted move remains in its current territory.
- A move into an uncontested destination succeeds.
- A move into a contested destination bounces.
- A bounced unit stays in its origin territory unless that origin was captured.
- A unit disbands when its move fails and another unit captures its origin.
- An impossible submitted order disbands the offending unit.
- After all three players submit, the app reveals submitted orders and resolves the turn.
- The app shows a resolution summary explaining successful moves, bounced moves, and no-move outcomes.
- After resolution, the app can advance to the next turn and return to player 1 order submission.
- The UI provides basic territory selection and highlighting feedback.
- Order arrows are not required in this milestone.
- The implementation remains in-memory only.
- `npm run build` passes.
- `npm run test:unit` passes with the existing 90 percent coverage thresholds.
- `npm run test:e2e` passes.
- Engine unit tests cover the core move resolution cases.
- Playwright covers the full first-turn flow from start through resolution and next-turn transition.

## 1.2) Tasks

### 1.2.1) Define Milestone Scenario Data

- Create a scenario module under `src/main` or a dedicated scenario folder that can later grow into the planned scenario system.
- Define stable IDs for factions, territories, and units.
- Define exactly 3 factions for the milestone.
- Define each playable Spanish map region as a territory.
- Define explicit symmetric land-border adjacency rules between territories.
- Define 1 soldier unit type.
- Define starting positions for 3 soldiers, one per faction.
- Leave every territory except Galicia, Catalunya, and Andalucia unoccupied at game start.
- Keep the data explicit and readable.
- Add unit tests confirming starting positions and movement rules.

### 1.2.2) Build Core Game State Types

- Add TypeScript types for game phase, faction, territory, unit, order, order submission, and turn result.
- Include a phase model that can represent setup, player order submission, reveal/resolution, and next-turn transition.
- Represent the active player/faction during order submission.
- Represent submitted orders by faction.
- Represent no-move submission as an intentional valid submission.
- Keep rules-engine types free of React, Redux, browser APIs, and DOM types.
- Prefer discriminated unions over boolean flags for state and order variants.
- Add unit tests for type-driven factory helpers where practical.

### 1.2.3) Implement Move Order Validation

- Add validation for move orders against the start-of-turn state.
- Reject moves from unknown units.
- Reject moves by a faction that does not control the selected unit.
- Reject moves from a unit that is not currently located where the order says it is.
- Reject moves to non-adjacent territories.
- Accept no-move submissions.
- Return structured validation results suitable for UI display.
- Add unit tests for valid move, no move, wrong faction, unknown unit, and illegal destination.

### 1.2.4) Implement Deterministic Turn Resolution

- Resolve all submitted move orders from the same start-of-turn state.
- Treat missing movement as no move.
- A destination with exactly one incoming move and no other conflict receives the moving unit.
- A destination with multiple incoming moves is contested and all incoming moves bounce.
- A destination occupied by a unit that is not moving away is contested and incoming moves bounce.
- A unit whose move bounces remains in its origin territory unless that origin was captured.
- A unit with no move remains in its origin territory.
- Disband units with impossible orders or failed moves whose origins were captured.
- No territory partitioning occurs.
- Return a structured turn result with:
  - successful moves.
  - bounced moves.
  - no-move outcomes.
  - final unit positions.
  - human-readable summary lines.
- Add unit tests for:
  - uncontested move into an empty neighboring region succeeds.
  - two units moving into the same region bounce.
  - move into occupied stationary territory bounces.
  - no-move unit remains in place.
  - mixed success, bounce, and no-move resolution.

### 1.2.5) Create Redux Game Slice

- Add Redux Toolkit state for the local game session.
- Store the current turn number.
- Store the current phase.
- Store the active faction during order submission.
- Store current unit positions.
- Store draft selected territory and selected order target.
- Store submitted orders for each faction.
- Store the latest resolution summary.
- Add reducers/actions for:
  - starting a new game.
  - selecting a territory.
  - choosing a move destination.
  - submitting a move.
  - submitting no move.
  - advancing to the next faction.
  - resolving the turn after all factions submit.
  - starting the next turn.
- Keep engine logic outside reducers where possible and call pure engine functions from reducers only through small, testable wrappers.
- Add unit tests for state transitions across a full turn.

### 1.2.6) Build App Flow Screens

- Replace the starter counter flow with milestone game flow.
- Keep screens in separate files.
- Add a start screen with a clear command to begin Milestone 1.
- Add a setup screen that displays the 3 factions and starts the local scenario.
- Add an order submission screen for the active faction.
- Add a reveal/resolution screen after all factions submit.
- Add a next-turn command that returns to player 1 order submission.
- Keep UI debug-grade but legible and accessible.
- Do not add polished onboarding, full rules reference, or final art.
- Add component tests for each screen's main behavior.

### 1.2.7) Build Iberia SVG Map

- Create an SVG map component in its own file.
- Render the Iberian Peninsula from the MapChart SVG source.
- Bind Spanish SVG region IDs to geographic territory metadata.
- Render Portugal as one unavailable gray area without visible internal divisions.
- Ensure each territory has a stable interactive element and accessible label.
- Show ownership or unit presence in a simple debug-friendly way.
- Highlight the selected territory.
- Highlight legal move destinations for the selected unit.
- Highlight invalid or unavailable territories differently when useful.
- Do not draw submitted move arrows in this milestone.
- Add unit/component tests for territory rendering and selection callbacks.

### 1.2.8) Build Order Submission UI

- Show the active faction/player clearly.
- Show the active faction's soldier and current territory.
- Allow selecting the soldier's current territory.
- Allow selecting a legal destination territory.
- Allow submitting the selected move order.
- Allow submitting no move.
- Show validation feedback when a move is invalid.
- Show submitted orders visibly for debug purposes.
- Prevent a faction from editing after submitting in the current turn.
- Advance automatically or through a clear continue command to the next faction after submission.
- Add component tests for move submission, no-move submission, invalid move feedback, and active faction progression.

### 1.2.9) Build Reveal And Resolution UI

- Show all submitted orders once all factions have submitted.
- Show successful moves, bounced moves, and no-move outcomes.
- Show final unit positions after resolution.
- Provide a command to start the next turn.
- After starting the next turn, clear submitted orders and set active faction back to player 1.
- Preserve final unit positions as the next turn's starting state.
- Add component tests for summary rendering and next-turn reset.

### 1.2.10) Add Playwright Full-Turn Coverage

- Update E2E tests to cover the milestone flow.
- Test start to setup.
- Test setup to player 1 order submission.
- Submit a move for player 1.
- Submit a conflicting move or no move for player 2.
- Submit a move or no move for player 3.
- Confirm reveal/resolution screen appears.
- Confirm resolution summary contains expected result text.
- Confirm next-turn command returns to player 1 order submission.
- Keep the E2E path deterministic and resilient to copy changes where possible.

### 1.2.11) Update Documentation And Developer Notes

- Update root `readme.md` only if commands or user-facing project description change.
- Update `project/coding-principles.md` only if milestone implementation teaches a durable new principle.
- Add short milestone implementation notes if needed under `project/`.
- Keep docs ASCII-only.
- Keep milestone deferrals explicit in this file until a later milestone claims them.

### 1.2.12) Verify And Commit

- Run `npm run build`.
- Run `npm run test:unit`.
- Run `npm run test:e2e`.
- Optionally run `npm run personal-prod` and verify the root page returns HTTP 200.
- Confirm generated files remain ignored.
- Confirm `git status --short` only shows intended source and doc changes.
- Commit with a short Conventional Commit message.

## 1.3) Deferred From Milestone 1

- Hidden order submission.
- Reinforcements.
- Explicit hold orders.
- Support orders.
- Trade orders.
- Diplomacy UI.
- Territory partitioning.
- Retreats.
- AI actors.
- Persistence beyond in-memory state.
- Save/load.
- Cloud multiplayer.
- Authentication.
- Rich scenario data.
- Final faction naming and historical summaries.
- Full Spanish Civil War scenario.
- Final map art.
- Order arrows during move submission.
- Resolution animation.
- Fog of war.
- Mobile-first polish.
- Formal tutorial.
- Accessibility pass beyond basic semantic controls and labels.

## 1.4) Implementation Decisions

- Starting positions:
  - Player 1 starts in `galicia`.
  - Player 2 starts in `catalunya`.
  - Player 3 starts in `andalucia`.
  - All other regions start empty.
- Milestone faction display names are fixed debug names: Player 1, Player 2, and Player 3.
- Infantry movement is limited to explicit shared land borders.
- Moving into a territory vacated by its defender succeeds if no other unit contests that destination.
- Two units attempting to swap territories bounce because the armies collide in transit.
- Engine resolution returns structured outcomes and summary lines.
- UI may display engine summary lines directly for debug-grade milestone output.
- The setup screen uses fixed faction/player names.
