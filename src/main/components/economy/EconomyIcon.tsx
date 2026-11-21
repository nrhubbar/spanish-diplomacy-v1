import type { JSX } from "react";
import type { BuildingDefinition, BuildProject, DevelopmentDefinition, ResourceId, Scenario } from "../../engine/types";

/**
 * X8: small line icons for resources, development, improvements and buildings. They are drawn in
 * `currentColor` on a 16-unit grid and hidden from assistive technology; the text beside them
 * carries the meaning. Code never names a scenario's ids: a building's icon comes from its first
 * effect, a development track's from whether it needs a city and which resource it yields.
 */
export type EconomyIconName =
  | "coin"
  | "people"
  | "wheat"
  | "pick"
  | "chimney"
  | "rail"
  | "anchor"
  | "flag"
  | "gear"
  | "crate"
  | "cross"
  | "fort"
  | "plane"
  | "runway"
  | "junction"
  | "star";

const paths: Readonly<Record<EconomyIconName, string>> = {
  anchor: "M8 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3M8 5.5v8M5 7.5h6M3 10c0 2.2 2.2 3.5 5 3.5s5-1.3 5-3.5",
  chimney: "M2 14V8l4-2v2l4-2v2l4-2v8zM11 6V2h2v4M5 11h1M8 11h1M11 11h1",
  coin: "M8 2.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11M8 5v6M6.2 6.4c.4-.6 1-.9 1.8-.9 1 0 1.8.5 1.8 1.3 0 1.8-3.6.9-3.6 2.6 0 .8.8 1.3 1.8 1.3.8 0 1.4-.3 1.8-.9",
  crate: "M2.5 5.5 8 3l5.5 2.5v6L8 14l-5.5-2.5zM2.5 5.5 8 8l5.5-2.5M8 8v6",
  cross: "M6 2.5h4v3.5h3.5v4H10v3.5H6V10H2.5V6H6z",
  flag: "M3.5 14V2.5M3.5 3h8l-2 2.5 2 2.5h-8",
  fort: "M2.5 14V6h2v1.5h2V6h3v1.5h2V6h2v8zM6.5 14v-3h3v3",
  gear: "M8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
  junction: "M3 14 8 2l5 12M4.5 10.5h7M6 7h4M8 10.5 13 14",
  people: "M5.5 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4M2 13c0-2.2 1.6-4 3.5-4S9 10.8 9 13M11 4a1.7 1.7 0 1 1 0 3.4A1.7 1.7 0 0 1 11 4M10 9.2c.3-.1.7-.2 1-.2 1.7 0 3 1.6 3 3.6",
  pick: "M3 13 10 6M6.5 3.5c2.5-1 5-.5 6.5 1-1.5-.5-3.5-.5-5 .5zM8 5l3 3",
  plane: "M8 1.5c.6 0 1 .6 1 1.5v3.5l5 3v1.5l-5-1.5V13l1.5 1.2V15L8 14.3 5.5 15v-.8L7 13V9.5L2 11V9.5l5-3V3c0-.9.4-1.5 1-1.5",
  rail: "M5 1.5 3 14.5M11 1.5l2 13M3.8 4h8.4M3.4 7.5h9.2M3 11h10",
  runway: "M8 1.5c.5 0 .8.5.8 1.2V5l3.7 2.2v1.2L8.8 7.3v2.2l1.2.9v.8L8 10.7l-2 .5v-.8l1.2-.9V7.3L3.5 8.4V7.2L7.2 5V2.7c0-.7.3-1.2.8-1.2M2 14.5h12",
  star: "m8 1.8 1.8 4 4.3.4-3.3 2.9 1 4.2L8 11.1l-3.8 2.2 1-4.2-3.3-2.9 4.3-.4z",
  wheat: "M8 14.5V5M8 8c-2 0-3-1.2-3-3 2 0 3 1.2 3 3M8 8c2 0 3-1.2 3-3-2 0-3 1.2-3 3M8 11c-2 0-3-1.2-3-3 2 0 3 1.2 3 3M8 11c2 0 3-1.2 3-3-2 0-3 1.2-3 3M8 5c-.8-.8-.8-2.2 0-3 .8.8.8 2.2 0 3"
};

export function EconomyIcon({ className, name }: { readonly className?: string; readonly name: EconomyIconName }): JSX.Element {
  return (
    <svg aria-hidden="true" className={`economy-icon${className === undefined ? "" : ` ${className}`}`} focusable="false" height="16" viewBox="0 0 16 16" width="16">
      <path d={paths[name]} fill={name === "star" ? "currentColor" : "none"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

/** A resource's icon: the first resource is money, every other one people (Funds, Manpower). */
export function resourceIcon(scenario: Scenario, resource: ResourceId): EconomyIconName {
  return scenario.resources[0]?.id === resource ? "coin" : "people";
}

/** A development track's icon: a city track is industry; money is mining; anything else is farming. */
export function developmentIcon(scenario: Scenario, track: DevelopmentDefinition): EconomyIconName {
  if (track.cityOnly) return "chimney";
  return resourceIcon(scenario, track.resource) === "coin" ? "pick" : "wheat";
}

const effectIcons: Readonly<Record<BuildingDefinition["effects"][number]["kind"], EconomyIconName>> = {
  airbase: "plane",
  "all-weather-airbase": "runway",
  "defence-roll": "fort",
  "rail-departures": "junction",
  "recruit-slots": "gear",
  "replenish-cap": "cross",
  "replenish-discount": "crate"
};

/** A building's icon, from its first effect; a building without effects (a barracks) gets a flag. */
export function buildingIcon(building: BuildingDefinition): EconomyIconName {
  const first = building.effects[0];
  return first === undefined ? "flag" : effectIcons[first.kind];
}

/** Any project's icon. */
export function projectIcon(scenario: Scenario, project: BuildProject): EconomyIconName {
  switch (project.kind) {
    case "building": {
      const building = scenario.index.buildings.get(project.buildingId);
      return building === undefined ? "flag" : buildingIcon(building);
    }
    case "development": {
      const track = scenario.index.development.get(project.developmentId);
      return track === undefined ? "pick" : developmentIcon(scenario, track);
    }
    case "improvement":
      return project.improvement === "rail" ? "rail" : "anchor";
    case "link":
      return project.work === "road-upgrade" ? "flag" : "rail";
  }
}
