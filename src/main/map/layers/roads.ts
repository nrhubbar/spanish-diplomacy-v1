import type { RoadLevel, Scenario } from "../../engine/types";
import type { MapPackage, MapPoint } from "../../scenarios/loader";

/** U8: one road or pass on the map, between two sub-territories' towns, in map units. */
export interface RoadSegment {
  readonly a: MapPoint;
  readonly b: MapPoint;
  readonly key: string;
  /** Absent when the link has a pass but no road (the pass is still marked). */
  readonly level: RoadLevel | undefined;
  /** The pass's name as its tooltip reads it ("Somosierra, mountain pass"), when the link crosses one. */
  readonly pass: string | undefined;
}

/**
 * U8: the scenario's roads and passes from its links (D2), each between the towns of the two
 * sub-territories it joins. Links with neither, or whose ends the map does not place, are left out.
 */
export function roadSegments(scenario: Scenario, map: MapPackage): readonly RoadSegment[] {
  const entries = map.subTerritories?.entries;
  if (entries === undefined) return [];
  const passLabel = scenario.linkModifiers.pass?.label;
  return scenario.links.flatMap((link): RoadSegment[] => {
    const road = link.modifiers.find((modifier) => modifier.kind === "road");
    const pass = link.modifiers.find((modifier) => modifier.kind === "pass");
    const a = entries.get(link.a)?.capital;
    const b = entries.get(link.b)?.capital;
    if ((road === undefined && pass === undefined) || a === undefined || b === undefined) return [];
    return [{
      a,
      b,
      key: `${link.a}|${link.b}`,
      level: road?.level,
      pass: pass === undefined ? undefined : passTitle(pass.name, passLabel)
    }];
  });
}

/** "Somosierra, mountain pass"; just the name when the scenario gives passes no label. */
export function passTitle(name: string, label: string | undefined): string {
  return label === undefined ? name : `${name}, ${label.toLowerCase()}`;
}

/** Which road kinds the scenario's links have, for the legend. */
export function roadKinds(scenario: Scenario): { readonly main: boolean; readonly pass: boolean; readonly track: boolean } {
  const modifiers = scenario.links.flatMap((link) => link.modifiers);
  return {
    main: modifiers.some((modifier) => modifier.kind === "road" && modifier.level === "main"),
    pass: modifiers.some((modifier) => modifier.kind === "pass"),
    track: modifiers.some((modifier) => modifier.kind === "road" && modifier.level === "track")
  };
}
