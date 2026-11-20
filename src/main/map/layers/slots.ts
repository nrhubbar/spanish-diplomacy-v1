import type { GameState } from "../../engine/types";
import type { ScenarioPackage } from "../../scenarios/loader";
import type { semanticLevel } from "../camera";
import type { MapView } from "../view";

/** What every Milestone 3 map layer is given, in screen space like the counters. */
export interface MapLayerProps {
  readonly game: GameState;
  readonly level: ReturnType<typeof semanticLevel>;
  readonly scenarioPackage: ScenarioPackage;
  /** The map package's unit symbols by unit type (counters and the air layer). */
  readonly unitSymbols: ReadonlyMap<string, string>;
  readonly toScreen: (point: { readonly x: number; readonly y: number }) => { readonly x: number; readonly y: number };
  readonly view: MapView;
}
