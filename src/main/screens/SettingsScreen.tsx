import type { JSX } from "react";
import { useNavigate } from "react-router";
import { useRegistry, useSession } from "../hooks";
import { routeForSession } from "../state/routing";

export function SettingsScreen(): JSX.Element {
  const navigate = useNavigate();
  const registry = useRegistry();
  const session = useSession();

  return (
    <main className="screen card-screen" aria-labelledby="settings-title">
      <p className="screen-kicker">Game settings</p>
      <h1 id="settings-title">Settings</h1>
      <p className="screen-copy">The game follows your browser and system preferences for motion, contrast, and text size.</p>
      <section className="settings-section" aria-labelledby="map-controls-title">
        <h2 id="map-controls-title">Map controls</h2>
        <ul className="plain-list">
          <li>Drag, or use W, A, S, and D or the arrow keys, to pan.</li>
          <li>Scroll, pinch, or use + and the minus key to zoom. Press 0 to reset the view.</li>
          <li>Tab to a territory or army and press Enter to select it.</li>
        </ul>
      </section>
      {registry.list().map((summary) => (
        <section className="settings-section" aria-label={`${summary.name} sources`} key={summary.id}>
          <h2>{`${summary.name}: map sources`}</h2>
          <ul className="plain-list">
            {registry.require(summary.id).map.attribution.map((entry) => (
              <li key={entry.text}>
                {entry.text}
                {entry.url === undefined ? null : <> <a href={entry.url} rel="noreferrer" target="_blank">Source</a></>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="action-row">
        <button className="secondary-button" onClick={() => { void navigate(routeForSession(session)); }} type="button">Back</button>
      </div>
    </main>
  );
}
