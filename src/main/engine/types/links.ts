import type { SubTerritoryId } from "../ids";
import type { BuildCost, DataBasis } from "./economy";
import type { LinkWork } from "./state";

/**
 * D2, D3: links between bordering sub-territories and the scenario's link modifiers. Every
 * sub-territory border has exactly one link (L28); its modifiers say what crosses it.
 */

export const linkModifierKinds = ["road", "rail", "pass"] as const;
export type LinkModifierKind = (typeof linkModifierKinds)[number];

export const roadLevels = ["track", "main"] as const;
export type RoadLevel = (typeof roadLevels)[number];
export const railLevels = ["single", "main"] as const;
export type RailLevel = (typeof railLevels)[number];

/** One thing a link has. No `road` means no road; no `rail` means no railway. */
export type LinkModifier =
  | { readonly kind: "road"; readonly level: RoadLevel }
  | { readonly kind: "rail"; readonly level: RailLevel }
  | { readonly kind: "pass"; readonly name: string };

export interface LinkDefinition {
  readonly a: SubTerritoryId;
  readonly b: SubTerritoryId;
  /** Where the link's modifiers come from: a source or a design note (L28). */
  readonly basis: DataBasis;
  readonly modifiers: readonly LinkModifier[];
}

/** R5: roads. Motor moves need `motorLevel` roads and cover up to `motorRange` territories. */
export interface RoadRules {
  readonly label: string;
  readonly motorLevel: RoadLevel;
  readonly motorRange: number;
}

/** R5: rail range in territories by the weakest rail level on the route. D5: a station boards `unitsPerLevel` units a turn per level. */
export interface RailRules {
  readonly label: string;
  readonly rangeByLevel: Readonly<Record<RailLevel, number>>;
  readonly unitsPerLevel: number;
}

/** R6: a pass. `defenderRoll` is the attacker's roll change when every attacking ground unit crosses one. */
export interface PassRules {
  readonly defenderRoll: number;
  readonly label: string;
  readonly lostToFlanking: boolean;
  readonly noMotor: boolean;
}

/** D2: what each modifier kind does, as the scenario defines it. A kind the scenario leaves out is absent. */
export interface LinkModifierRules {
  readonly pass?: PassRules;
  readonly rail?: RailRules;
  readonly road?: RoadRules;
}

/** R7: the price and build time of each link work. */
export type LinkProjectRules = Readonly<Record<LinkWork, BuildCost>>;
