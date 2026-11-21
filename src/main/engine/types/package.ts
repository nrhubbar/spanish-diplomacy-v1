import type {
  BuildingId,
  CityId,
  DevelopmentId,
  FactionId,
  GeneralId,
  ScenarioId,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitTypeId
} from "../ids";
import type {
  BuildingDefinition,
  DevelopmentDefinition,
  ImprovementRules,
  MovementRules,
  RecruitmentRules,
  ResourceDefinition,
  SubTerritoryDefinition
} from "./economy";
import type { LinkDefinition, LinkModifierRules, LinkProjectRules } from "./links";
import type { RuleModule } from "../modules";
import type { RulesetId, RulesSelection } from "./rules";
import type {
  CityDefinition,
  CombatRules,
  ConnectionDefinition,
  FactionDefinition,
  Neighbor,
  SourceDefinition,
  TerritoryDefinition,
  UnitDefinition,
  UnitTypeDefinition,
  VictoryRules
} from "./scenario";
import type {
  AiRules,
  AirRules,
  CalendarRules,
  D20Rules,
  GeneralDefinition,
  GeneralTrait,
  WeatherRules
} from "./systems";

export interface ScenarioIndex {
  readonly buildings: ReadonlyMap<BuildingId, BuildingDefinition>;
  readonly cities: ReadonlyMap<CityId, CityDefinition>;
  readonly citiesByTerritory: ReadonlyMap<TerritoryId, readonly CityDefinition[]>;
  readonly development: ReadonlyMap<DevelopmentId, DevelopmentDefinition>;
  readonly factions: ReadonlyMap<FactionId, FactionDefinition>;
  /** U5: each faction's roster, in scenario order. Empty without generals. */
  readonly generalsByFaction: ReadonlyMap<FactionId, readonly GeneralDefinition[]>;
  readonly generals: ReadonlyMap<GeneralId, GeneralDefinition>;
  /** D2: every link by its sub-territories, keyed `a|b` with the ids sorted. Empty without sub-territories. */
  readonly links: ReadonlyMap<string, LinkDefinition>;
  readonly neighbors: ReadonlyMap<TerritoryId, readonly Neighbor[]>;
  /** Sub-territories bordering each sub-territory, inside and across territory borders. */
  readonly subTerritoryNeighbors: ReadonlyMap<SubTerritoryId, readonly SubTerritoryId[]>;
  readonly subTerritories: ReadonlyMap<SubTerritoryId, SubTerritoryDefinition>;
  /** Each territory's sub-territories in scenario order. Empty without sub-territories. */
  readonly subTerritoriesByTerritory: ReadonlyMap<TerritoryId, readonly SubTerritoryDefinition[]>;
  readonly territories: ReadonlyMap<TerritoryId, TerritoryDefinition>;
  readonly unitTypes: ReadonlyMap<UnitTypeId, UnitTypeDefinition>;
  readonly units: ReadonlyMap<UnitId, UnitDefinition>;
}

/**
 * A validated, indexed scenario. Produced only by the scenario loader. Collections of systems
 * the scenario does not use are empty, and their rule blocks are absent; the loader
 * guarantees each block is present when its module is selected (L14-L16).
 */
export interface Scenario {
  readonly ai: AiRules;
  readonly air?: AirRules;
  readonly buildings: readonly BuildingDefinition[];
  readonly calendar?: CalendarRules;
  readonly cities: readonly CityDefinition[];
  /** The d6 rules. Required while the `d6-table` dice module is the only implemented one. */
  readonly combat: CombatRules;
  readonly connections: readonly ConnectionDefinition[];
  readonly d20?: D20Rules;
  readonly development: readonly DevelopmentDefinition[];
  readonly factions: readonly FactionDefinition[];
  readonly generalTraits: readonly GeneralTrait[];
  readonly generals: readonly GeneralDefinition[];
  readonly id: ScenarioId;
  readonly improvements?: ImprovementRules;
  readonly index: ScenarioIndex;
  /** D2: one link per sub-territory border, in scenario order. Empty without sub-territories. */
  readonly links: readonly LinkDefinition[];
  readonly linkModifiers: LinkModifierRules;
  /** R7: link works' prices; absent when the scenario offers none. */
  readonly linkProjects?: LinkProjectRules;
  /** The modules `rules` selects, resolved by the loader, in `ruleAreas` order. */
  readonly modules: readonly RuleModule[];
  readonly movement?: MovementRules;
  readonly name: string;
  readonly recruitment?: RecruitmentRules;
  readonly resources: readonly ResourceDefinition[];
  readonly rules: RulesSelection;
  readonly ruleset: RulesetId;
  readonly snapshotLabel: string;
  readonly sources: readonly SourceDefinition[];
  readonly subTerritories: readonly SubTerritoryDefinition[];
  readonly subTerritoryBorders: readonly (readonly [SubTerritoryId, SubTerritoryId])[];
  readonly territories: readonly TerritoryDefinition[];
  readonly unitTypes: readonly UnitTypeDefinition[];
  readonly units: readonly UnitDefinition[];
  readonly victory: VictoryRules;
  readonly weather?: WeatherRules;
}
