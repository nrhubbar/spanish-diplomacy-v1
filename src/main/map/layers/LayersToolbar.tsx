import type { JSX } from "react";
import type { PaneLayout } from "../MapPane";
import { activePreset, type LayerId, layerIds, layerLabels, presetIds, presetLayers, presets, toggleLayer } from "./layerChoice";

interface LayersToolbarProps {
  /** What the order in progress has switched on by itself (`autoLayers`). */
  readonly auto: readonly LayerId[];
  /** The player's own choice of layers. */
  readonly chosen: readonly LayerId[];
  readonly layout: PaneLayout;
  readonly onChange: (layers: readonly LayerId[]) => void;
}

/**
 * U13 (Q-R2-8, `r2-08-layers-a`/`-b`): the Map Layers toolbar. On desktop a bar along the bottom
 * of the map: the presets Orders, Logistics and Economy, then More with a switch per layer. On a
 * phone it folds into one Layers button holding the same. A layer the order in progress needs is
 * shown on and locked until the order is given.
 */
export function LayersToolbar({ auto, chosen, layout, onChange }: LayersToolbarProps): JSX.Element {
  const presetButtons = <PresetButtons chosen={chosen} onChange={onChange} />;
  const switches = <LayerSwitches auto={auto} chosen={chosen} onChange={onChange} />;
  if (layout === "sheet") {
    return (
      <details className="map-layers-menu" data-map-control="">
        <summary>Layers</summary>
        <div className="map-layers-popover">
          {presetButtons}
          {switches}
        </div>
      </details>
    );
  }
  return (
    <div aria-label="Map layers" className="map-layers-toolbar" data-map-control="" role="group">
      <span aria-hidden="true" className="map-layers-title">Layers</span>
      {presetButtons}
      <details className="map-layers-more">
        <summary>More</summary>
        <div className="map-layers-popover">{switches}</div>
      </details>
    </div>
  );
}

function PresetButtons({ chosen, onChange }: Pick<LayersToolbarProps, "chosen" | "onChange">): JSX.Element {
  const active = activePreset(chosen);
  return (
    <div aria-label="Layer presets" className="map-layers-presets" role="group">
      {presetIds.map((id) => (
        <button
          aria-pressed={active === id}
          aria-label={`${presets[id].label} layers`}
          className="map-layers-preset"
          key={id}
          onClick={() => { onChange(presetLayers(id)); }}
          title={presets[id].note}
          type="button"
        >
          {presets[id].label}
        </button>
      ))}
    </div>
  );
}

function LayerSwitches({ auto, chosen, onChange }: Omit<LayersToolbarProps, "layout">): JSX.Element {
  const active = activePreset(chosen);
  return (
    <fieldset className="map-layers-switches">
      <legend>Show on the map</legend>
      {layerIds.map((id) => {
        const forced = auto.includes(id) && !chosen.includes(id);
        return (
          <label className="map-layers-switch" key={id}>
            <input
              checked={forced || chosen.includes(id)}
              disabled={forced}
              onChange={() => { onChange(toggleLayer(chosen, id)); }}
              role="switch"
              type="checkbox"
            />
            <span>{layerLabels[id]}</span>
            {forced ? <span className="map-layers-auto">on for this order</span> : null}
          </label>
        );
      })}
      <p className="map-layers-note">{active === undefined ? "Your own mix of layers." : `${presets[active].label}: ${presets[active].note}`}</p>
    </fieldset>
  );
}
