import type { GameState } from "../engine/types";
import { cssVariables } from "../presentation/style";
import { territoryName } from "../presentation/text";
import type { ScenarioPackage } from "../scenarios/loader";
import type { MapAssets } from "../scenarios/registry";
import { MapControls } from "./MapControls";
import { MapLayers } from "./MapLayers";
import { MapLegend } from "./MapLegend";
import { MapPane, type PaneContent, paneLayoutFor, paneWidthFor } from "./MapPane";
import { type CameraBounds, semanticLevel } from "./camera";
import { autoLayers, defaultLayers, hiddenLayers, type LayerId, shownLayers } from "./layers/layerChoice";
import { LayersToolbar } from "./layers/LayersToolbar";
import { subTerritoryAt } from "./layers/SubTerritoryLayer";
import { prepareGeometry } from "./markup";
import { useFocusRescue } from "./useFocusRescue";
import { useMapCamera } from "./useMapCamera";
import { useTerritoryPress } from "./useTerritoryPress";
import { type MapBriefing, usePaneView } from "./usePaneView";
import { highlightedTerritoryId, type MapView } from "./view";
import { type JSX, useCallback, useMemo, useState } from "react";

interface CampaignMapProps {
  readonly assets: MapAssets;
  readonly briefing?: MapBriefing;
  readonly game: GameState;
  /** U13: the player's choice of layers and where a change goes; without them the map keeps its own. */
  readonly layers?: readonly LayerId[];
  readonly onLayersChange?: (layers: readonly LayerId[]) => void;
  readonly onTerrainFallback?: (reason: string) => void;
  readonly pane?: PaneContent;
  readonly scenarioPackage: ScenarioPackage;
  readonly view: MapView;
}

/** Map package interpreter: terrain, vector geometry, counters, controls, and the details pane. */
export function CampaignMap({ assets, briefing, game, layers, onLayersChange, onTerrainFallback, pane, scenarioPackage, view }: CampaignMapProps): JSX.Element {
  const { map, scenario } = scenarioPackage;
  const paneView = usePaneView(pane, briefing);
  const [ownLayers, setOwnLayers] = useState(defaultLayers);
  const chosen = layers ?? ownLayers;
  const auto = autoLayers(view);
  const shown = shownLayers(chosen, view);
  const bounds = useMemo<CameraBounds>(() => ({ content: map.viewBox, focus: map.focus }), [map]);
  const geometry = useMemo(
    () => prepareGeometry(assets.geometrySvg, map, (id) => territoryName(scenario, id)),
    [assets.geometrySvg, map, scenario]
  );

  const territoryAt = useCallback((target: EventTarget | null) => {
    // React hands its handlers elements only; anything else names no territory.
    const value = (target as Partial<Element> | null)?.closest?.("[data-territory-id]")?.getAttribute("data-territory-id");
    return scenario.territories.find((candidate) => candidate.id === value)?.id;
  }, [scenario]);
  const selectFrom = useCallback((target: EventTarget | null, input?: "mouse" | "touch") => {
    if (!(target instanceof Element)) return;
    const territoryId = territoryAt(target);
    if (territoryId !== undefined) view.onSelectTerritory?.(territoryId, input);
    else view.onSelectNothing?.();
  }, [territoryAt, view]);
  // U5, U7: right-click and long-press open a territory's quick actions; the mouse over one feeds the reach card.
  const press = useTerritoryPress(view, territoryAt);

  const {
    camera,
    consumeDrag,
    containerRef,
    onKeyDown,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    measured,
    reset,
    viewport,
    zoomBy
  } = useMapCamera(bounds, paneView.insetsFor, selectFrom);
  const layout = paneLayoutFor(viewport.width);
  const paneWidth = paneWidthFor(viewport.width);
  const paneOpen = paneView.isOpen(layout);
  const paneContent = paneView.content;
  const level = semanticLevel(camera.zoom);
  const focusRescue = useFocusRescue(highlightedTerritoryId(view));

  return (
    <section
      aria-label="Campaign map"
      className="campaign-map"
      data-pane-layout={layout}
      data-hidden-layers={hiddenLayers(shown)}
      data-pane-open={paneContent !== undefined && paneOpen}
      style={cssVariables({ "--map-background": map.background, "--pane-width": `${String(paneWidth)}px` })}
    >
      <div
        aria-describedby="map-instructions"
        aria-keyshortcuts="W A S D ArrowUp ArrowDown ArrowLeft ArrowRight + - 0"
        className="map-surface"
        data-camera-x={camera.centerX.toFixed(1)}
        data-semantic-level={level}
        data-zoom={camera.zoom.toFixed(2)}
        onClick={(event) => {
          if (consumeDrag() || press.consumeLongPress()) return;
          selectFrom(event.target, press.lastInput());
          // X3: zoomed in, the click may also focus the pane on the sub-territory under it.
          if (level !== "overview" && view.onSelectSubTerritory !== undefined) {
            const subTerritoryId = subTerritoryAt(event.clientX, event.clientY);
            if (subTerritoryId !== undefined) view.onSelectSubTerritory(subTerritoryId);
          }
        }}
        onBlur={focusRescue.onBlur}
        onFocus={focusRescue.onFocus}
        onContextMenu={press.onContextMenu}
        onKeyDown={onKeyDown}
        onPointerCancel={(event) => { press.onPointerEnd(); onPointerCancel(event); }}
        onPointerDown={(event) => { press.onPointerDown(event); onPointerDown(event); }}
        onPointerLeave={press.onPointerLeave}
        onPointerMove={(event) => { press.onPointerMove(event); onPointerMove(event); }}
        onPointerUp={(event) => { press.onPointerEnd(); onPointerUp(event); }}
        ref={containerRef}
        role="application"
        aria-roledescription="map"
        aria-label={`${scenario.name} map`}
        tabIndex={0}
      >
        <span className="visually-hidden" id="map-instructions">
          Drag, or hold W, A, S, and D or the arrow keys, to pan. Scroll, pinch, or use plus and minus to zoom. Press zero to reset the view.
          Tab to a territory and press Enter to select it.
        </span>
        {measured ? (
          <MapLayers
            assets={assets}
            bounds={bounds}
            camera={camera}
            game={game}
            geometry={geometry}
            layers={shown}
            layout={layout}
            level={level}
            onTerrainFallback={onTerrainFallback}
            scenarioPackage={scenarioPackage}
            view={view}
            viewport={viewport}
          />
        ) : null}
      </div>
      <MapControls
        {...(briefing === undefined ? {} : { briefing: { onToggle: () => { paneView.toggleBriefing(paneOpen); }, shown: paneView.briefingShown } })}
        onReset={reset}
        onZoom={zoomBy}
        zoom={camera.zoom}
      />
      <MapLegend game={game} layers={shown} scenario={scenario} view={view} />
      <LayersToolbar auto={auto} chosen={chosen} layout={layout} onChange={onLayersChange ?? setOwnLayers} />
      {/* The pane waits for measurement so it never flashes in the wrong layout. */}
      {paneContent === undefined || !measured ? null : (
        <MapPane content={paneContent} layout={layout} onToggle={() => { paneView.togglePane(paneOpen); }} open={paneOpen} />
      )}
    </section>
  );
}
