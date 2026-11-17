# Milestone 2: Player Setup, Computer Players, And Turn Handoffs

## 1. Goal

Milestone 2 turns the Milestone 1 debug loop into a configurable shared-device game and replaces its three-token test scenario with a researched late-July 1936 starting position.

Before starting, the user assigns each faction to a local player or a computer player. Local players submit orders one at a time through an explicit privacy handoff. Computer players generate legal orders through the same submission interface. Online play is represented in the setup design but is not implemented in this milestone.

This milestone does not add recruitment, reinforcements, or income. Its purpose is to prove that human and computer actors can participate in the same complete turn loop using independently movable historical formations, meaningful objectives, and an end condition.

## 2. Historical Scenario Baseline

### 2.1 Snapshot Date And Standard Of Accuracy

Use `31 July 1936` as the initial scenario snapshot. Every initial territory controller, city controller, and deployed formation must describe the same date. Do not combine a July territorial map with later militia columns or formations that did not yet exist.

`Historically accurate` means traceable to cited historical evidence at the granularity represented by the game. Where sources disagree, scenario data must record the uncertainty and the design decision. Do not imply false precision in formation strength.

Before implementation, add a reviewed scenario research note containing:

- The source and confidence level for every starting territory and city controller.
- The source, historical allegiance, location, formation type, and approximate strength for every starting unit.
- An explanation for any merged, omitted, renamed, or reassigned formation.
- A distinction between documented fact, reasonable inference, and game-balance adjustment.
- A short content note explaining that faction and unit labels describe historical actors and do not endorse them.

### 2.2 Three Playable Commands

The project requires three playable factions, while the July 1936 war is usually described as Republican and insurgent/Nationalist zones. To avoid pretending that monarchists and Falangists held clean independent territorial states, Milestone 2 should model three operational commands:

1. `Republican Government`: forces loyal to the elected Second Republic and aligned militias represented under one playable command.
2. `Northern Insurgent Command`: the rebel-controlled northern and northwestern zone associated with Emilio Mola's operational drive toward Madrid.
3. `Southern Insurgent Command`: the Seville and Spanish Morocco bridgeheads and Army of Africa associated with Francisco Franco's advance through western Spain.

The two insurgent commands are a game-level separation of cooperating forces before command was fully unified, not independent historical countries. This abstraction must be disclosed in the scenario introduction. If later research supports a more faithful third role, changing these commands requires an explicit product decision rather than a silent data edit.

### 2.3 Territory Control And Map Granularity

Pre-divide all playable land areas according to the 31 July snapshot. Uncontrolled or genuinely divided areas must be represented as contested; they must not be assigned arbitrarily for visual completeness.

The current autonomous-community-sized map is too coarse for accurate July 1936 control. Andalucía, Aragón, Asturias, and the northern coastal area contained important splits, enclaves, or city-level exceptions. Before assigning controllers, do one of the following for every mixed region:

- Split it into historically meaningful playable territories, preferably using 1936 provinces or documented operational zones; or
- Activate predefined sub-territories that can separately hold control, cities, and units.

Do not label a whole modern autonomous community as controlled by one faction when the cited snapshot shows meaningful opposing control within it. Islands, Ceuta, Melilla, and Spanish Morocco must be deliberately included, grouped, or declared out of scope.

Scenario validation must guarantee that every playable area has one of these states:

```ts
type InitialTerritoryControl =
  | { readonly kind: "controlled"; readonly factionId: FactionId }
  | { readonly kind: "contested"; readonly factionIds: readonly FactionId[] };
```

### 2.4 Notable Cities

Add map labels and scenario records for cities that matter to the initial front, force deployment, or victory system. The researched city list should begin with:

- Madrid, Barcelona, Valencia, Bilbao, San Sebastian, Santander, Oviedo, and Gijon.
- Burgos, Pamplona, Valladolid, Salamanca, Zaragoza, and Teruel.
- Seville, Cordoba, Granada, Malaga, Cadiz, Badajoz, Toledo, Cartagena, Alicante, and Albacete.
- A Coruna and any additional port or garrison city required by the order of battle.

Labels must remain legible without intercepting territory selection. Dense areas may use leader lines, collision-aware offsets, or a zoom/inset treatment. Each city needs a stable ID, name, map position, parent territory/sub-territory, starting controller, and `countsForVictory` flag.

### 2.5 Historical Order Of Battle And Unit Scale

Use a formation as the basic game unit. Prefer historical regiments, independent battalions, militia columns, Guardia Civil/Assault Guard groupings, and comparable Army of Africa formations. Do not create one token for every individual company, and do not collapse an entire regional army into one token.

Each initial unit record must include:

```ts
interface HistoricalUnitState {
  readonly id: UnitId;
  readonly name: string;
  readonly factionId: FactionId;
  readonly formationKind: "regiment" | "battalion" | "column" | "security" | "other";
  readonly approximateStrength?: number;
  readonly territoryId: TerritoryId;
  readonly cityId?: CityId;
  readonly sourceIds: readonly string[];
  readonly historicalNote?: string;
}
```

Every territory inspector must show a list of the formations currently present, grouped by faction. Multiple friendly units in one territory remain distinct entities.

The initial research should use the July 1936 Spanish Army order of battle as a baseline, then account for whether each garrison remained loyal, joined the uprising, dissolved, or was reorganized into a militia column by the snapshot date. Prewar barracks location alone is not sufficient evidence for a starting combat unit.

### 2.6 Independent Movement

Units sharing a territory must be selectable and ordered independently. Selecting a territory must not automatically select every friendly unit in it.

- Each unit may receive at most one move or hold order per turn.
- A faction may submit different destinations for different units in the same territory.
- A unit without an explicit move holds.
- Validation, resolution outcomes, map counters, summaries, and tests must identify the individual unit.
- Stacking and destination conflicts remain engine rules, not UI assumptions.

The order builder should support selecting one or more individual units only when the same order is intentionally applied to that selection. The stored submission must still contain one explicit order per unit.

## 3. Player-Facing Language

Use the following labels in the faction assignment controls:

- `Local Player`: a person playing on this device.
- `Computer Player`: the game chooses and submits this faction's orders.
- `Online Player`: a person joining from another device.

`Online Player` should be visible but disabled and marked `Coming later`. Do not allow a game to start with an online player until remote multiplayer exists.

Use `player` in general UI copy and `actor` in the engine and state model. Suggested internal kinds:

```ts
type ActorKind = "local-human" | "computer" | "online-human";
```

Do not use `AI` as the primary player-facing label. It may be used in developer documentation and implementation names.

## 4. Turn And Handoff Language

Do not call a change from one faction to another a new turn. A turn is complete only after every participating faction has submitted and resolution has finished.

Use these commands:

- `Submit Orders`: lock the current local player's orders.
- `Continue to <Faction>`: leave the private handoff screen and give the next local player control.
- `Reveal and Resolve`: reveal orders after the last local submission when no computer processing remains.
- `Start Next Turn`: leave the resolution screen and begin the next numbered turn.

If the desired product copy must include `Next Player`, prefer `Continue to Next Player` over `Next Turn` during the submission sequence.

## 5. Intended User Flow

### 5.1 Game Setup

1. The user opens the faction setup screen.
2. Each faction is shown in its own row or card.
3. Each faction has a player-type dropdown.
4. The default configuration is one `Local Player` and two `Computer Player` factions.
5. The user may configure any mix of local and computer players, including all-local and all-computer games.
6. The start command remains disabled if any faction is assigned to the unavailable online type.
7. Starting the game creates one actor assignment per faction and begins turn 1.

### 5.2 Local Player Submission

1. A private-ready screen identifies the next local faction without showing its board or previous orders.
2. The player chooses `Begin <Faction> Orders`.
3. The order screen shows only that faction's editable draft.
4. The player chooses a legal move or no move.
5. `Submit Orders` locks the submission.
6. The app clears private draft UI before displaying the handoff screen.
7. The handoff screen identifies the next local faction and provides `Continue to <Faction>`.

The previous local player's order details must not appear during another local player's planning phase. Submission status may show that a faction is ready, but not what it submitted.

### 5.3 Computer Player Submission

1. When the active actor is a computer player, the computer order generator receives the same start-of-turn state and scenario used by human validation.
2. It returns a normal `PlayerSubmission`.
3. The submission is validated by the engine before it is accepted.
4. Computer factions are processed automatically until the next local player needs control or all factions are ready.
5. The UI may briefly show `Computer player is choosing orders`, but the first implementation does not need animation or an artificial delay.
6. Computer orders remain hidden until reveal and resolution.

### 5.4 Resolution And Next Turn

1. Once every actor has submitted, all orders are revealed together.
2. The existing deterministic resolver processes the turn.
3. The resolution screen shows revealed orders, outcomes, and final positions.
4. `Start Next Turn` archives the result, increments the turn number, clears submissions, and begins with the first actor in scenario order.
5. Computer actors submit automatically until the first local player is reached.
6. An all-computer game must require an explicit user command to run each turn so it cannot loop indefinitely.

## 6. Computer Player Strategy

Implement one intentionally simple strategy: `Historically Motivated Computer Player`.

For every unit controlled by the faction:

1. Enumerate legal move orders using engine-owned validation or a shared legal-order query.
2. Include holding/no move as a legal choice.
3. Score each option using public start-of-turn state, the faction's historical motivation, distance to objectives, nearby friendly and enemy units, and immediate legal movement.
4. Prefer the highest-scoring option, using an injected random-number function only to break equivalent choices.
5. Return a standard `PlayerSubmission`.

Initial motivations:

- Republican Government: hold Madrid, Barcelona, Valencia, and the northern loyalist cities; keep loyal territory connected where possible; oppose either insurgent advance.
- Northern Insurgent Command: advance toward Madrid from the north, connect separated northern holdings, and capture northern Republican cities.
- Southern Insurgent Command: expand from Seville and the African bridgeheads through western Spain, connect with northern insurgent territory, and advance toward Madrid.

These are simple scoring biases, not scripts and not claims that every historical formation shared one ideology. Put motivations in scenario data so the engine can support other scenarios.

### 6.1 The Front-Door Submission Rule

Local, computer, and future online players must use the same application-level order commands:

```ts
interface OrderGateway {
  getPlanningView(actorId: ActorId): PlanningView;
  submitOrders(actorId: ActorId, submission: PlayerSubmission): SubmissionResult;
  lockOrders(actorId: ActorId): LockResult;
}
```

The exact interface may change, but there must be one front door for authorization, validation, locking, notifications, and phase advancement. React components call it for local players; computer-player code calls it directly. The computer must not dispatch private reducer actions, mutate state, duplicate move validation, or simulate DOM clicks.

The planning view passed to a computer actor must contain only:

- Public scenario and start-of-turn board state.
- The computer faction's units, legal-order queries, and its own draft/submission status.
- Public ready/not-ready status where appropriate.

It must never include another actor's draft, locked orders, order descriptions, or information derived from them. Add a test that plants a hidden opponent order and proves the computer submission is identical with and without it.

Randomness must be injectable so tests can produce deterministic tie-breaking.

## 7. State And Architecture Changes

### 7.1 Actor Assignment

Add actor definitions separate from faction definitions:

```ts
interface ActorAssignment {
  readonly factionId: FactionId;
  readonly kind: ActorKind;
}
```

The setup screen owns a draft assignment record. Starting a game copies validated assignments into game session state.

### 7.2 Game Phases

Replace the broad `orders` phase with explicit states sufficient to prevent accidental information exposure:

```ts
type GamePhase =
  | "idle"
  | "setup"
  | "handoff"
  | "planning"
  | "computer-planning"
  | "ready-to-resolve"
  | "resolution";
```

Equivalent discriminated state objects are preferable if they reduce invalid combinations. In particular, only a planning phase should expose an active local faction and editable draft.

### 7.3 Submission Coordinator

Move actor sequencing into a small testable coordinator rather than embedding it in screen components.

The coordinator should:

- Find the next faction without a locked submission.
- Route local players to handoff/planning.
- Request and validate computer submissions.
- Stop when user input is required.
- Resolve only when every faction is ready.
- Avoid recursive or unbounded all-computer turn execution.

The pure rules engine remains independent of Redux and actor UI concerns.

### 7.4 Order Privacy

Selectors used during planning must expose only:

- The current faction's draft.
- Ready/not-ready status for other factions.
- Public start-of-turn board state.

Selectors must not expose another faction's submitted order description until resolution.

## 8. Victory And Game End

Evaluate victory after every completed resolution, after control changes are applied.

A faction wins by satisfying either condition:

1. Control at least 51 percent of victory-eligible territories; or
2. Occupy at least 75 percent of victory-eligible cities.

Use ceiling arithmetic:

```ts
territoryThreshold = Math.ceil(victoryEligibleTerritories.length * 0.51);
cityThreshold = Math.ceil(victoryEligibleCities.length * 0.75);
```

`Control` and `city occupation` must be engine-defined and based on surviving ground units and post-resolution territory state. Contested areas do not count as controlled. Air units and transient support do not occupy a city.

The historical scenario data must pass a validation rule that no faction already meets either victory threshold on 31 July 1936. If research shows that a faction would begin above a threshold, do not falsify starting control. Instead, document it and revise the victory-eligible territory/city set or add an explicitly approved hold-duration rule before implementation.

If multiple factions qualify after the same simultaneous resolution:

1. Higher share of victory cities wins.
2. If tied, higher share of victory territories wins.
3. If still tied, record a shared victory rather than using submission order or faction order as a hidden tiebreaker.

Once victory is awarded, enter a terminal `game-over` phase. Show the winning faction, achieved condition, final map, and final turn summary. Do not allow `Start Next Turn`; provide a route back to setup for a new game.

## 9. UI Work

### 9.1 Faction Setup Screen

- Replace the Milestone 1 faction list with a faction assignment form.
- Show faction name, color/abbreviation, starting territory, and player-type dropdown.
- Default to one local player and two computer players.
- Disable `Online Player` with `Coming later` help text.
- Provide a clear `Start Game` command.
- Validate that every faction has an assignment.

### 9.2 Handoff Screen

- Add a dedicated route and screen, such as `/handoff`.
- Do not render the campaign map, units, drafts, submitted order descriptions, or resolution details.
- Identify the faction about to play.
- Explain that the previous player should pass the device.
- Provide `Begin <Faction> Orders` for the first player and `Continue to <Faction>` after another local submission.

### 9.3 Order Screen

- Rename the current generic `Submit` command to `Submit Orders`.
- Show the assigned faction and `Local Player` status.
- Show ready status without revealing other orders.
- Prevent editing after submission.
- Route through the handoff screen instead of immediately rendering the next faction's board.

### 9.4 Computer Status

- Show a lightweight computer-planning state if computer processing is not instantaneous.
- Do not add fake waits solely for visual effect.
- Surface an error notification and stop resolution if a computer submission fails validation.

### 9.5 Map, Cities, And Territory Inspector

- Render notable city labels and occupied-city state.
- Make territory selection open a list of all formations in that territory.
- Provide an individual selection control for every friendly formation.
- Keep stacked counters distinguishable and keyboard accessible.
- Show historical formation names without requiring them to fit inside a counter.
- Show territory and city contribution toward victory.

### 9.6 Resolution And Game-Over Screens

- Keep `Start Next Turn` for the transition between numbered turns.
- Reveal both local and computer orders using the same presentation.
- Label each faction's player type in the revealed-order summary if it improves clarity.
- Show territory and city progress toward both victory thresholds.
- Route to a terminal game-over screen when the engine awards victory.

## 10. Acceptance Criteria

- Every faction can be assigned `Local Player` or `Computer Player` during setup.
- `Online Player` is visible as unavailable and cannot be selected for a playable game.
- The default setup contains at least one local player.
- A game can start with any valid local/computer combination.
- A local submission is locked when `Submit Orders` is chosen.
- The next local player sees a private handoff screen before seeing the board.
- Previous players' order details remain hidden until resolution.
- The handoff command explicitly identifies the next faction.
- Computer players submit through the same `PlayerSubmission` model as local players.
- Computer submissions are validated by the engine.
- The scenario uses one documented 31 July 1936 snapshot for control and deployments.
- Mixed historical regions are split or represented as contested rather than assigned inaccurately.
- Notable cities have stable IDs, map labels, starting control, and victory eligibility.
- Every starting formation has cited provenance and a documented mapping from the historical source.
- Territory inspection lists every formation currently present.
- Units in the same territory can receive different orders and move independently.
- Computer actors prefer legal orders consistent with faction motivation.
- Computer tie-breaking is deterministic under an injected test random source.
- Computer actors submit through the same front-door order gateway as local players.
- A computer actor receives no opponent draft or locked-order data.
- Computer players can legally choose a move or no move.
- Mixed local/computer games complete and resolve a full turn.
- All-local games complete and resolve a full turn.
- All-computer games resolve only after an explicit per-turn user command.
- `Start Next Turn` increments the turn, clears submissions, preserves resolved positions, and restarts actor sequencing.
- The engine awards victory at 51 percent of eligible territories or 75 percent of eligible cities.
- No faction satisfies a victory condition in the initial scenario state.
- A victory ends the game and prevents another turn from starting.
- Direct navigation cannot bypass setup, handoff, planning, or resolution guards.
- `npm run build` passes.
- `npm run test:unit` passes with all coverage thresholds at or above 90 percent.
- `npm run test:e2e` passes in an environment that permits the Playwright web server.

## 11. Test Plan

### 11.1 Scenario, Engine, And Computer Player Tests

- Generates only adjacent moves or no move.
- Never selects another faction's unit.
- Produces a valid standard submission.
- Validates every territory, city, unit, source reference, and initial controller.
- Rejects a scenario that starts with an achieved victory condition.
- Resolves different orders for multiple units sharing one territory.
- Selects historically motivated options over lower-scoring legal choices.
- Selects predictable options with injected tie-breaking values.
- Handles a faction with no units.
- Does not inspect existing hidden submissions.
- Produces the same order when an opponent's hidden submission changes.
- Awards each victory condition and handles simultaneous winners deterministically.

### 11.2 State Tests

- Stores setup assignments separately from factions.
- Starts with the first local actor behind a handoff.
- Locks a local submission and clears its draft.
- Skips one or more computer actors correctly.
- Stops at the next local actor.
- Resolves after the last required submission.
- Runs an all-local turn.
- Runs a mixed local/computer turn.
- Gates each all-computer turn behind an explicit action.
- Starts the next numbered turn with preserved positions.
- Exposes ready status but hides locked order descriptions during planning.
- Uses the same gateway for local and computer submissions.
- Enters `game-over` and prevents next-turn progression after victory.

### 11.3 Component Tests

- Changes a faction's player type.
- Shows the unavailable online option clearly.
- Prevents invalid setup submission.
- Renders a handoff without private board information.
- Continues from handoff to the correct faction.
- Renames the order command to `Submit Orders`.
- Shows computer-processing errors accessibly.
- Lists and independently selects stacked units.
- Renders city labels without blocking territory interaction.
- Shows victory progress and the terminal game result.

### 11.4 Playwright Flows

- Default one-local/two-computer game from setup through resolution.
- Two-local/one-computer game with both privacy handoffs.
- All-local full turn.
- All-computer single-turn execution without automatic looping.
- Next-turn transition returns to the correct first local faction.
- Direct-link route guards.
- Desktop and mobile screenshots of setup, handoff, planning, and resolution.
- Independent moves by two units starting in one territory.
- A deterministic scenario that reaches game over through territory control.

## 12. Implementation Order

1. Complete and review the 31 July 1936 control, city, and order-of-battle research note.
2. Decide and implement the territory/sub-territory refinements required by mixed historical control.
3. Add scenario data for commands, cities, historical units, sources, and motivations.
4. Add actor kinds and assignment types without changing current behavior.
5. Add setup assignment state, selectors, validation, and tests.
6. Build the faction assignment UI and unavailable online option.
7. Refactor selection and orders so colocated units move independently.
8. Extract legal-order enumeration and the front-door order gateway.
9. Implement the historically motivated computer player with injected tie-breaking.
10. Introduce explicit planning, handoff, computer-planning, resolution, and game-over phases.
11. Add the submission coordinator and mixed-actor state tests.
12. Build and route the privacy handoff screen.
13. Add map city labels, territory formation lists, and victory progress.
14. Implement victory evaluation and the terminal game-over screen.
15. Add component and Playwright coverage for actor mixes, unit independence, privacy, and victory.
16. Update the root README and long-range phase plan to describe the completed scenario loop.
17. Run build, unit tests, coverage, and Playwright verification.

## 13. Deferred

- Remote multiplayer implementation.
- Authentication, invitations, and online presence.
- Persistent save/load.
- Recruitment, reinforcements, replacements, and income; these are Milestone 3.
- More advanced strategic computer players.
- Difficulty settings.
- Computer-player explanations or personality.
- Combat, support, reinforcement, trade, economy, and partition rules.
- Background workers or server-side computer turns.

## 14. Historical Research Sources

Use sources critically and record page/map references in the scenario research note. Initial sources:

- Spain Ministry of Territorial Policy and Democratic Memory, [Por vuestra libertad y la nuestra](https://mptmd.gob.es/content/dam/mpt/memoria-democratica/publicaciones-memoria/catalogos_y_monografias/Por%20vuestra%20libertad%20y%20nuestra%20%28catalogo%29_WEB.pdf): overview of the July uprising and the failure to seize Madrid and Barcelona.
- U.S. Marine Corps country study, [Territorial Control During the Spanish Civil War, 1936-37](https://www.marines.mil/portals/1/Publications/Spain%20Study_1.pdf?ver=2012-10-11-163301-923): comparative July 1936 control map.
- University of British Columbia Press, [Spain, July 1936](https://www.ubcpress.ca/asset/9430/1/9780774814171.pdf): detailed initial control map and important city locations.
- University of Warwick Modern Records Centre, [Spanish Civil War timeline](https://warwick.ac.uk/services/library/mrc/collections/digital/scw/simpletimeline2/): contemporary-collection-backed chronology and terminology.
- U.S. Army Combined Arms Research Library, Nafziger Collection, [Spanish Army in Quarters: Strengths and Assignments, July 1936](https://cgsc.contentdm.oclc.org/digital/api/collection/p15040coll6/id/9540/download): baseline formations, zones, and recorded strengths.
- Spanish Ministry of Defence, [El factor humano: Organizacion y liderazgo para ganar una guerra](https://publicaciones.defensa.gob.es/media/downloadable/files/links/e/l/el_factor_humano_adalid_75_.pdf): historiography and competing estimates for forces present in July 1936.
