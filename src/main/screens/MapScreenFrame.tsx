import { type JSX, type ReactNode, useCallback, useRef } from "react";
import type { GameState, ScenarioId } from "../engine/types";
import { useAppDispatch, useMapAssets, useScenarioPackage } from "../hooks";
import { CampaignMap } from "../map/CampaignMap";
import type { PaneContent } from "../map/MapPane";
import type { MapView } from "../map/view";
import { addInfoNotification } from "../state/notificationSlice";

interface MapScreenFrameProps {
  readonly game: GameState;
  readonly header: ReactNode;
  readonly label: string;
  readonly pane: PaneContent;
  readonly scenarioId: ScenarioId;
  readonly view: MapView;
}

/** Full-width game layout: compact header, then the map with its in-map details pane. */
export function MapScreenFrame({ game, header, label, pane, scenarioId, view }: MapScreenFrameProps): JSX.Element {
  const dispatch = useAppDispatch();
  const scenarioPackage = useScenarioPackage(scenarioId);
  const assets = useMapAssets(scenarioId);
  const notified = useRef(false);
  const onTerrainFallback = useCallback((reason: string) => {
    if (notified.current) return;
    notified.current = true;
    dispatch(addInfoNotification(reason));
  }, [dispatch]);

  return (
    <main aria-label={label} className="game-screen">
      {header}
      {assets === undefined ? (
        <div className="map-loading" role="status">Loading the map</div>
      ) : (
        <CampaignMap
          assets={assets}
          game={game}
          onTerrainFallback={onTerrainFallback}
          pane={pane}
          scenarioPackage={scenarioPackage}
          view={view}
        />
      )}
    </main>
  );
}
