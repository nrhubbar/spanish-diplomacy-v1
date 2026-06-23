# Project Plan: Simultaneous Orders Strategy Game

## 1. Project Vision

This project is a browser-based grand strategy / operational war game inspired by classic board wargames, simultaneous-order strategy games, asynchronous diplomacy games, and operational front-line conflict.

The initial goal is **not** to build a full global WWII-scale game. The initial goal is to prove a smaller but novel rules engine built around:

* Hidden simultaneous order submission
* Deterministic turn resolution
* Local shared-PC multiplayer first
* AI/COM actors from day one for testing
* Cloud asynchronous multiplayer later
* Trivial onboarding and play experience
* Territory partitioning / contested front mechanics
* Diplomacy and negotiation between players
* Scenario-driven map, unit, rules, and victory data
* A graphics architecture that starts abstract but can evolve into a rich SVG map

The first playable version should validate whether simultaneous-order resolution and partitioned territory mechanics are fun, understandable, and stable enough to support larger scenarios later.

The MVP succeeds if the simultaneous-order system is proven fun and understandable.

## 2. Product Principles

### 2.1 Trivial to Start Playing

The UX must make it easy for casual friends to start a game, understand what they can do, submit orders, and continue playing.

Players should not need to read a manual before taking their first turn.

The game should teach through affordances, tooltips, previews, validation, and clear turn summaries.

### 2.2 Rules Engine First, UI Second

The game engine is the source of truth.

The UI displays legal options, explains consequences, and collects orders, but it does not determine rules validity.

All submitted orders must be validated by the engine.

### 2.3 Scenario-Driven Design

Maps, factions, units, victory conditions, starting positions, and special rules should be defined as scenario data wherever possible.

The long-term engine should support multiple historical or alternate-history scenarios.

### 2.4 Deterministic Resolution First

The first version should avoid dice-based combat.

Combat should be deterministic so that simultaneous order resolution is easier to reason about, test, replay, and explain.

### 2.5 Hidden Orders, Visible Board

The initial version uses hidden simultaneous orders with visible unit positions.

The architecture should allow later support for fog of war, hidden units, or partial information.

### 2.6 Shared-PC First, Cloud Later

The first multiplayer target is a shared-PC local experience.

The implementation path is:

1. Local shared-PC multiplayer
2. AI/COM actors for testing and solo iteration
3. Local persistence
4. Cloud asynchronous multiplayer
5. Invite links, accounts, notifications, and remote play

### 2.7 Abstract Map First, SVG-Compatible From Day One

The first map can be abstract, but it should use the same interaction model as the future rich map.

The prototype should not use throwaway HTML buttons if the target interaction layer is SVG.

The first proof should teach us how to:

* Click territories
* Hover territories
* Select units
* Preview legal moves
* Draw order arrows
* Display unit counters
* Display split territory/sub-territory state
* Swap abstract map geometry for richer SVG geometry later

## 3. Initial Game Concept

### 3.1 Working Genre

A 6/10 complexity historical strategy game:

* More complex than Risk or Diplomacy
* Less complex than Hearts of Iron or a detailed hex-and-counter wargame
* Closer to a board-game-like grand strategy experience
* Focused on order prediction, diplomacy, front movement, and territory control
* Built around simultaneous hidden planning and deterministic resolution

### 3.2 First Scenario

The first scenario is a **Spanish Civil War-inspired tutorial scenario**.

Reasons:

* More modern unit mix than the Peninsular War
* Easier to evolve toward grander 20th-century strategy
* Naturally supports three-sided conflict
* Naturally supports fragmented territory control
* Naturally supports diplomacy, opportunism, and foreign influence later
* Small enough to build a meaningful vertical slice

This scenario should be historically inspired rather than historically exact.

Balance and clarity are more important than simulation accuracy.

### 3.3 Initial Factions

The first scenario should support three major factions.

Working display names:

1. **Republican Front**

   * Inspired by left-republican, socialist, communist, and anti-fascist forces.
   * Working player-facing shorthand: Communists / Republicans.

2. **Monarchist Junta**

   * Inspired by monarchist, conservative, traditionalist, and anti-republican factions.
   * Working player-facing shorthand: Royalists.

3. **Nationalist/Falangist Bloc**

   * Inspired by fascist, nationalist, and militarist factions.
   * Working player-facing shorthand: Fascists / Nationalists.

Faction names may change for clarity, tone, and historical sensitivity.

The game should include short faction summaries to help players understand who they are playing, what the faction wants, and why its starting position differs from the others.

These summaries should be original short summaries with source attribution, not copied encyclopedia text.

### 3.4 Starting Balance

The first scenario should use **designed asymmetry**.

One faction may start stronger and need to win quickly.

Other factions may begin weaker but have better growth, defensive geography, or diplomatic positioning.

The goal is not symmetry. The goal is understandable asymmetry.

### 3.5 First Map Size

The first real scenario should target approximately **12–16 major territories**.

Each major territory may have **1–5 predefined sub-territories** that only matter when that territory becomes split or contested.

Example:

```txt
Madrid
- City Center
- Northern Mountain Pass
- Southeast Suburbs
- Western Approaches
```

Sub-territories do not need to be active when the territory is unified.

## 4. Core Game Loop

Each turn follows this structure:

1. Planning Phase

   * Players privately create orders.
   * Players may discuss in global and private channels.
   * Players may edit orders until they lock.
   * Other players can see who has locked, but not what they ordered.

2. Lock Phase

   * Once a player locks orders, those orders cannot be changed.
   * If all required actors are locked, the turn proceeds.

3. Reveal Phase

   * All submitted orders are revealed simultaneously.

4. Validation Phase

   * Orders are validated against the start-of-turn state.
   * Orders invalid due to public information should be prevented before submission.
   * Orders invalid due to hidden/future information may be submitted but can fail during resolution.
   * Invalid orders should fail clearly and explain why.

5. Resolution Phase

   * Reinforcements resolve.
   * Movement resolves.
   * Conflicts are detected.
   * Territory partitions are created, updated, or removed.
   * Combat resolves deterministically.
   * Retreats, destruction, failed attacks, and control changes are applied.

6. Cleanup Phase

   * Empty partitions are removed.
   * Same-controller partitions are merged.
   * Fully controlled territories reunify.
   * Income, supply, reinforcement eligibility, and victory conditions are evaluated.

7. Next Turn

   * A new hidden planning phase begins.

## 5. Technical Architecture

### 5.1 Initial Stack

* Language: TypeScript
* Frontend: React
* Rules engine: Pure TypeScript package
* UI rendering: SVG-based map layer
* Persistence: Local JSON first
* Multiplayer: Shared-PC first
* AI: Local COM actors from early development
* Cloud persistence: Firebase later
* Hosting: TBD

### 5.2 Package Structure

```txt
/src
  /engine
    actors.ts
    combat.ts
    faction.ts
    gameState.ts
    map.ts
    movement.ts
    orders.ts
    resolution.ts
    scenario.ts
    territoryControl.ts
    validation.ts
    victory.ts

  /ai
    randomLegalActor.ts
    greedyActor.ts
    actorEvaluation.ts

  /scenarios
    /spanish-civil-war
      scenario.ts
      map.ts
      factions.ts
      units.ts
      victory.ts
      summaries.ts

  /ui
    /components
      GameShell.tsx
      MapView.tsx
      TerritoryInspector.tsx
      OrderPanel.tsx
      TurnStatusPanel.tsx
      RevealPlayback.tsx
      BattleSummary.tsx
      FactionSummary.tsx

  /graphics
    /maps
      abstract-spanish-civil-war.svg
      spanish-civil-war.visual.ts

  /persistence
    localSave.ts

  /firebase
    TBD
```

### 5.3 Engine Rule

The engine should be usable without React, Firebase, or browser APIs.

Core shape:

```ts
function resolveTurn(
  startState: GameState,
  submissions: PlayerSubmission[],
  scenario: ScenarioDefinition
): TurnResolutionResult
```

### 5.4 Actor Model

Human players and AI players should use the same submission model.

```ts
type ActorKind = "human" | "ai";

interface Actor {
  id: ActorId;
  factionId: FactionId;
  kind: ActorKind;
}
```

AI actors submit orders through the same interface as human actors.

Early AI implementations:

1. Random legal actor
2. Greedy attack actor

The AI does not need to be good at first. It needs to produce valid orders and create useful test pressure.

## 6. Data Model Principles

### 6.1 Logical Map

The logical map is the rules source of truth.

```ts
interface TerritoryDefinition {
  id: TerritoryId;
  name: string;
  kind: "land" | "sea";
  adjacent: TerritoryEdge[];
  subTerritories: SubTerritoryDefinition[];
  incomeValue?: number;
  supplyValue?: number;
  recruitmentTags?: RecruitmentTag[];
  terrainTags?: TerrainTag[];
}
```

### 6.2 Edges

Movement modifiers should live on edges, not only on territories.

```ts
interface TerritoryEdge {
  to: TerritoryId;
  movementCost: number;
  terrainTags?: TerrainTag[];
  requiredControl?: ControlRequirement;
}
```

This allows one border to be easy while another border is difficult.

Example:

```txt
Madrid → Valencia: road
Madrid → Asturias: mountain pass
```

### 6.3 Sub-Territories

Sub-territories represent predefined contested zones inside a major territory.

They may affect:

* Movement
* Retreats
* Supply
* Partitioning
* Visual display
* Control
* Special rules

```ts
interface SubTerritoryDefinition {
  id: SubTerritoryId;
  parentTerritoryId: TerritoryId;
  name: string;
  terrainTags?: TerrainTag[];
  adjacentSubTerritories?: SubTerritoryId[];
  visualRole?: "city" | "pass" | "suburb" | "approach" | "port" | "factory";
}
```

Sub-territories are mostly dormant while a territory is unified.

They become important when a territory is partitioned.

### 6.4 Visual Map

The visual map is a rendering and interaction layer.

```ts
interface TerritoryVisualDefinition {
  territoryId: TerritoryId;
  svgPathId: string;
  labelPosition: {
    x: number;
    y: number;
  };
  unitAnchorPosition: {
    x: number;
    y: number;
  };
  subTerritoryVisuals?: SubTerritoryVisualDefinition[];
}
```

```ts
interface SubTerritoryVisualDefinition {
  subTerritoryId: SubTerritoryId;
  svgPathId?: string;
  insetPosition: {
    x: number;
    y: number;
  };
}
```

The visual layer maps clicks back to `territoryId` or `subTerritoryId`.

### 6.5 Game State

```ts
interface GameState {
  gameId: string;
  scenarioId: string;
  turnNumber: number;
  phase: GamePhase;
  actors: Record<ActorId, ActorState>;
  factions: Record<FactionId, FactionState>;
  territories: Record<TerritoryId, TerritoryState>;
  units: Record<UnitId, UnitState>;
}
```

### 6.6 Orders

Initial order types:

```ts
type Order =
  | MoveOrder
  | ReinforceOrder
  | SupportOrder
  | TradeOrder;
```

Future order types:

```ts
type FutureOrder =
  | EventOrder
  | EspionageOrder
  | DiplomacyOrder;
```

All order types are submitted simultaneously.

Purchases and reinforcements are secret until reveal.

### 6.7 Territory Control

Territories may be unified or partitioned.

```ts
type TerritoryControl =
  | UnifiedTerritoryControl
  | PartitionedTerritoryControl;
```

A unified territory has a single controller.

A partitioned territory has multiple active controlled zones.

```ts
interface PartitionedTerritoryControl {
  kind: "partitioned";
  zones: ControlledZone[];
}
```

```ts
interface ControlledZone {
  id: ControlledZoneId;
  controller: FactionId;
  subTerritoryIds: SubTerritoryId[];
}
```

The initial implementation should support predefined sub-territories, not dynamic computational geometry.

## 7. Combat Model

### 7.1 Goals

Combat should be:

* Deterministic
* Easy to explain
* Easy to test
* Capable of producing bounces, retreats, destruction, and partitions
* Built around unit matchups rather than dice

### 7.2 Initial Unit Types

Initial unit types:

* Guerrilla
* Infantry
* Tank
* Artillery
* Air
* Anti-Air

Unit strength does not vary by faction.

Faction asymmetry comes from:

* Starting positions
* Starting unit counts
* Access to unit types
* Income
* Recruitment geography
* Strategic objectives

### 7.3 Combat Relationship Model

Combat should use a matchup table or deterministic resolver.

Example design intent:

* 1 infantry vs 1 infantry may bounce.
* 1 tank may defeat 1 infantry.
* 1 infantry + 1 artillery may bounce with 1 tank.
* Anti-air matters against air.
* Air can influence combat but cannot hold territory.

The exact table is TBD.

### 7.4 Combat Outcomes

Combat outcomes may include:

* Attacker wins
* Defender holds
* Both sides bounce
* Defender retreats
* Attacker retreats
* Units are destroyed
* Territory becomes partitioned
* Air units return, abort, or are lost depending on anti-air and combat rules

Most ground combat may initially destroy defeated units.

Some cases, especially involving air units or retreat-capable forces, may produce retreats or partial results.

## 8. Reinforcements and Economy

The first version should combine:

1. **Controlled centers produce resources**
2. **Controlled centers unlock unit types**
3. **Reinforcement orders spend resources**

This avoids a full economic simulation while still giving players strategic choices.

Example:

```txt
Industrial city: produces money and allows infantry/artillery
Armored depot: allows tanks
Airfield: allows air
Mountain region: allows guerrilla recruitment
```

Historical event systems are part of the long-term vision but are not an MVP requirement.

## 9. Territory Partitioning

### 9.1 Design Intent

Territory partitioning represents contested control inside a major territory.

Instead of immediately deciding that one faction controls all of Madrid, the game may represent Madrid as split between multiple controlled zones.

Example:

```txt
Madrid
- Republican Front controls City Center
- Nationalist/Falangist Bloc controls Western Approaches
```

This supports:

* Front lines without hexes
* Multi-turn battles
* Retreats without total elimination
* Contested cities
* Supply disruption
* Simultaneous invasions from multiple directions

### 9.2 MVP Partitioning Rules

The MVP should support predefined sub-territories.

A major territory has 1–5 sub-territories.

Sub-territories only become mechanically important when the territory is partitioned.

The initial version should support:

* Creating a partition
* Reinforcing a partition
* Attacking between partitions
* Retreating into eligible connected territory or sub-territory
* Reunifying a territory when only one faction remains
* Showing partitioned control visually using inset zones

### 9.3 Non-Goal

The MVP does not require dynamic computational geometry.

We do not need to algorithmically cut a territory shape into arbitrary polygons.

Instead, sub-territories are predefined in scenario data and exposed visually only when needed.

## 10. Diplomacy

### 10.1 Design Intent

Diplomacy is a critical aspect of the game.

Players should be able to negotiate, deceive, threaten, trade, and coordinate informally.

### 10.2 MVP Diplomacy

The MVP should support:

* Global table talk
* Private player-to-player discussion
* Resource trades
* Territory trades
* Targeted attack/support intent when submitting orders

### 10.3 Non-Goals for MVP Diplomacy

The MVP does not need:

* Engine-enforced alliances
* Formal treaty system
* Secret treaty objects
* Lending units
* Shared unit control
* Enforced cooperative support orders

Diplomacy is mostly social, with only trade/transfer orders enforced by the engine.

## 11. Graphics and Map Strategy

### 11.1 Visual Direction

The visual style should feel like:

* Old Avalon Hill board games
* Parchment campaign maps
* Political war maps
* Skeuomorphic tabletop components

The game should lean into a board-game feel rather than a sleek SaaS dashboard.

### 11.2 Initial Graphics Goal

The first map should be abstract but SVG-based.

It does not need beautiful final art.

It must prove the graphics interaction model:

* Territory hover
* Territory click
* Sub-territory click
* Ownership coloring
* Terrain indication
* Unit stack markers
* NATO-symbol counters
* Selected territory highlighting
* Legal move highlighting
* Order preview arrows
* Battle / conflict markers
* Partitioned territory inset zones
* Minimal resolution playback

### 11.3 Map Pipeline

Development path:

1. Build an abstract SVG map with simple territory shapes.
2. Use real `territoryId` and `subTerritoryId` bindings.
3. Prove clicking, hovering, selecting, movement previews, and overlays.
4. Replace abstract SVG geometry with a stylized Spain-inspired SVG later.
5. Add 2D textures and terrain shading after mechanics are playable.

### 11.4 Terrain Display

Terrain should exist at both:

* Sub-territory level
* Edge level

Terrain affects movement first, not combat strength.

Possible terrain tags:

* Mountain
* Forest
* Urban
* River crossing
* Road
* Pass
* Port
* Airfield

Visual treatment should make terrain modifiers obvious.

### 11.5 Resolution Playback

Resolution animation should be minimal.

The target is closer to an automatic PowerPoint-style reveal than a real-time animated battle.

Resolution should show:

* Orders revealed
* Movement arrows
* Conflicts
* Combat outcomes
* Retreats
* Territory control changes
* Reunifications
* End-of-turn summary

## 12. AI / COM Actors

### 12.1 Purpose

AI actors are required early to make testing easier.

They are not expected to be strategically strong in the MVP.

### 12.2 Initial AI Types

Initial AI actors:

1. **Random Legal Actor**

   * Generates valid orders randomly.
   * Useful for stress testing and validating that the engine handles legal combinations.

2. **Greedy Actor**

   * Prioritizes nearby attacks, valuable territories, and weak enemies.
   * Useful for producing plausible pressure.

### 12.3 AI Design Rule

AI actors must use the same order submission pipeline as human players.

The engine should not distinguish between human and AI submissions during turn resolution.

## 13. Multiplayer Plan

### 13.1 Phase 1 Multiplayer

The first multiplayer mode is shared-PC local play.

Players take turns entering hidden orders on the same machine.

The game should hide previously entered orders from the next player.

### 13.2 Phase 2 Multiplayer

Add local AI/COM players.

Allow mixed games:

```txt
Human vs Human vs AI
Human vs AI vs AI
AI vs AI vs AI
```

### 13.3 Phase 3 Multiplayer

Cloud asynchronous multiplayer comes later.

Likely future stack:

* Firebase Auth
* Firestore
* Cloud Functions
* Invite links
* Private order submissions
* Lock status
* Server-authoritative turn resolution
* Turn history
* Notifications

## 14. Development Guidelines

1. Everything must be unit tested where practical.
2. The rules engine must be especially easy to test.
3. Maintain a comprehensive suite of Playwright E2E tests.
4. E2E tests should be tied to user stories.
5. E2E tests should cover both positive flows and negative capabilities.
6. Prefer functional programming paradigms where possible.
7. Prefer immutability and pure functions.
8. Prefer enums, discriminated unions, and strong typing over booleans.
9. Limit imperative operations to a small, well-contained set of classes/modules.
10. Use dependency injection where it improves testability and mockability.
11. Prefer constants and built-in library functions over copied strings or duplicated logic.
12. Prefer many simple components over fewer complicated abstractions.
13. Avoid premature generic abstractions.
14. Scenario data should be explicit and readable.
15. The engine should be independently testable without UI.

## 15. Phase Plan

## Phase 0: Project Foundation

Goal: Create the repository skeleton and establish technical conventions.

### Epics

* Repository setup
* TypeScript configuration
* React app shell
* Testing framework setup
* Playwright setup
* Basic domain model definitions
* Scenario loading structure
* Local development app shell
* Initial documentation
* Actor model skeleton
* Abstract SVG map proof-of-concept

## Phase 1: Rules Engine Prototype

Goal: Build a pure TypeScript engine capable of resolving a small simultaneous-order turn.

### Epics

* Game state model
* Scenario definition model
* Faction model
* Actor model
* Unit model
* Territory graph model
* Sub-territory model
* Edge movement model
* Order model
* Order validation
* Simultaneous movement resolution
* Basic deterministic combat
* Basic retreat/destruction outcomes
* Territory control updates
* Turn resolution result object
* Unit tests for core resolution cases

## Phase 2: Abstract SVG Playtest Map

Goal: Prove that the engine can interact with a rich graphics layer without building final art.

### Epics

* Abstract SVG territory shapes
* Territory path IDs
* Sub-territory inset zones
* Territory click and hover handling
* Sub-territory click and hover handling
* Unit stack rendering
* NATO-symbol counter rendering
* Ownership coloring
* Terrain display
* Legal move highlighting
* Order arrow overlay
* Turn summary overlay

## Phase 3: Local Shared-PC Play

Goal: Create a playable local multiplayer loop.

### Epics

* Game creation screen
* Actor assignment screen
* Human vs human local play
* Hidden order entry
* Lock orders flow
* Prevent locked order edits
* Hide previous player orders
* Reveal all orders
* Resolve turn locally
* Start next turn
* Save/load local game state

## Phase 4: AI / COM Actors

Goal: Add AI actors for testing and solo iteration.

### Epics

* Random legal actor
* Greedy actor
* AI order generation
* AI lock/submission flow
* Human vs AI setup
* AI vs AI simulation harness
* Engine stress tests using AI-generated orders
* Basic AI evaluation utilities

## Phase 5: Territory Partitioning

Goal: Make contested territory control a first-class mechanic.

### Epics

* Partitioned territory data model
* Predefined sub-territory activation
* Rules for creating partitions
* Rules for reinforcing partitions
* Rules for attacking within partitioned territories
* Rules for retreating from partitions
* Rules for reunifying territories
* Partition cleanup phase
* Partition-aware movement validation
* Partition-aware victory and income logic
* Partition visual overlay
* Tests for partition edge cases

## Phase 6: Spanish Civil War Scenario

Goal: Expand the prototype into the first real scenario.

### Epics

* Define 12–16 territory map
* Define 1–5 sub-territories per territory
* Define Republican Front faction
* Define Monarchist Junta faction
* Define Nationalist/Falangist Bloc faction
* Define starting unit positions
* Define starting income/supply centers
* Define recruitment unlocks
* Define deterministic unit matchup table
* Define initial victory conditions
* Define faction summaries
* Define scenario introduction
* Tune starting asymmetry
* Playtest balance pass

## Phase 7: Reveal and Resolution UX

Goal: Make simultaneous turns understandable and satisfying.

### Epics

* Turn status display
* Hidden order lock status
* Reveal screen
* Resolution timeline
* Movement arrow playback
* Conflict summary
* Battle summary
* Retreat summary
* Partition summary
* Territory control change summary
* Income/reinforcement summary
* Next-turn transition

## Phase 8: Diplomacy and Trade

Goal: Support social strategy and limited engine-enforced exchanges.

### Epics

* Global discussion panel
* Private discussion panel
* Resource trade orders
* Territory transfer orders
* Target intent for multi-faction invasions
* Diplomacy-aware order review
* Turn summary including trades and transfers

## Phase 9: Stylized Map Art

Goal: Replace the abstract proof map with a more evocative but still functional scenario map.

### Epics

* Stylized Spain-inspired SVG map
* Territory path cleanup
* Sub-territory inset artwork
* Board-game / parchment visual treatment
* Terrain textures
* Mountain/forest/river/road indicators
* Counter styling pass
* Ownership color palette
* Accessibility/readability pass

## Phase 10: Cloud Async Multiplayer

Goal: Allow friends to play remotely with minimal friction.

### Epics

* Firebase project setup
* Authentication strategy
* Game creation flow
* Invite flow
* Player join flow
* Private order submission storage
* Locked order status
* Server-authoritative turn resolution
* Game persistence
* Action log / turn log
* Basic notification strategy

## Phase 11: Polish and Iteration

Goal: Make the game pleasant enough for repeated friend-group play.

### Epics

* Visual polish
* Better unit icons
* Mobile/tablet usability review
* Turn reminders
* Player notes
* Saved game history
* Spectator/replay mode
* Scenario setup options
* Rules reference
* Onboarding tutorial
* Historical event system prototype

## 16. Explicit Non-Goals for Early Development

* Full global WWII scenario
* Complex naval warfare
* Fog of war
* Mobile-first UI
* Real-time live multiplayer
* Cloud multiplayer in the first phase
* Dynamic computational geometry for territory splitting
* Beautiful final art
* Public matchmaking
* Monetization
* Modding tools
* Sophisticated AI
* Historical event system

## 17. MVP Success Criteria

The MVP succeeds if:

* A shared-PC game can be started easily.
* Human and AI actors can participate in the same game.
* Players can submit hidden simultaneous orders.
* Locked orders cannot be revised.
* Orders reveal only after all actors lock.
* The game resolves a complete turn deterministically.
* The abstract SVG map supports real map-like interactions.
* Territory partitioning creates interesting strategic consequences.
* Players understand why the resolution happened.
* The system feels promising enough to expand into a larger scenario.

## 18. Open Design Questions

### 18.1 Scenario

* What are the exact 12–16 starting territories?
* What are the exact 1–5 sub-territories per major territory?
* Which territories produce income?
* Which territories unlock which unit types?
* What are the initial victory conditions?
* Should victory be based on capitals, cities, income, morale, or turn limit?

### 18.2 Factions

* Are the working names final?
* What is each faction’s short player-facing summary?
* What is each faction’s starting strategic problem?
* Which faction starts strongest?
* Which factions scale better over time?

### 18.3 Combat

* What is the exact deterministic matchup table?
* How does artillery support work?
* How does anti-air interact with air?
* Can air units be destroyed, or only forced to abort?
* When does combat destroy units versus force retreats?
* When does combat create a partition instead of resolving control?

### 18.4 Partitioning

* Can a partitioned territory have more than two factions?
* Can all sub-territories be active at once?
* Does a partitioned territory produce partial income, no income, or income by controlled sub-territory?
* Can supply pass through a partitioned territory?
* Can units move through a friendly-controlled sub-territory inside a partitioned enemy territory?
* What happens when multiple factions invade the same territory in the same turn?

### 18.5 Diplomacy

* Are resource and territory trades simultaneous orders?
* Can a trade fail if the other side does not reciprocate?
* Are trades public after reveal?
* Are private messages local-only in the shared-PC version?
* How much diplomacy UI is needed before cloud multiplayer?

### 18.6 Graphics

* What does the abstract SVG map look like?
* Should the abstract map use circles, polygons, or rough organic shapes?
* How should inset sub-territories appear?
* How should unit counters stack?
* How should terrain be represented without clutter?
* How should legal movement edges be highlighted?
* How should a partitioned territory be visually distinguished from a normal battle?

### 18.7 AI

* What makes a greedy actor “good enough”?
* Should AI know all visible information only?
* Should AI cheat in early test mode?
* Should AI prefer attacking, defending, reinforcing, or income maximization?
* Should AI actors produce explainable orders for debugging?
