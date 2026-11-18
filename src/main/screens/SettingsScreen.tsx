import type { JSX } from "react";
import { useNavigate } from "react-router";

export function SettingsScreen(): JSX.Element {
  const navigate = useNavigate();

  return (
    <main className="screen settings-screen" aria-labelledby="settings-title">
      <p className="screen-kicker">Game settings</p>
      <h1 id="settings-title">Settings</h1>
      <p className="screen-copy">
        The campaign follows your browser's motion, contrast, text-size, and input preferences.
      </p>
      <section className="settings-panel" aria-labelledby="map-controls-title">
        <h2 id="map-controls-title">Map controls</h2>
        <p>Drag or use W, A, S, and D to pan. Pinch, scroll, or use + and − to zoom. Press 0 to reset.</p>
      </section>
      <section className="settings-panel" aria-labelledby="map-sources-title">
        <h2 id="map-sources-title">Map sources</h2>
        <p>
          Terrain relief is adapted from Maps-For-Free (CC0). Administrative boundaries are adapted
          from geoBoundaries gbOpen and Spain's Instituto Geográfico Nacional (CC BY 4.0).
        </p>
      </section>
      <button className="secondary-button" type="button" onClick={() => navigate("/")}>Back to home</button>
    </main>
  );
}
