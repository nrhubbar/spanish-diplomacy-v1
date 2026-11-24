import type { JSX } from "react";
import { useNavigate } from "react-router";
import { MapControlsHelp } from "../components/MapControlsHelp";
import { SoundControls } from "../components/SoundControls";
import { useAppDispatch, useAppSelector, useRegistry, useSession } from "../hooks";
import { resetSound, selectSavingData } from "../state/audioSlice";
import { paths, routeForSession } from "../state/routing";

export function SettingsScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const registry = useRegistry();
  const savingData = useAppSelector(selectSavingData);
  const session = useSession();

  return (
    <main className="screen card-screen" aria-labelledby="settings-title">
      <p className="screen-kicker">Game settings</p>
      <h1 id="settings-title">Settings</h1>
      <p className="screen-copy">The game follows your browser and system preferences for motion, contrast, and text size.</p>
      <section className="settings-section" aria-labelledby="sound-title">
        <h2 id="sound-title">Sound</h2>
        <SoundControls />
        {savingData ? <p>Saving data: music starts off. Unmute it to download and play it.</p> : null}
        <button className="secondary-button" onClick={() => { dispatch(resetSound()); }} type="button">Reset sound</button>
      </section>
      <section className="settings-section" aria-labelledby="map-controls-title">
        <h2 id="map-controls-title">Map controls</h2>
        <MapControlsHelp />
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
        <button className="secondary-button" onClick={() => { void navigate(paths.credits, { state: paths.settings }); }} type="button">Credits</button>
      </div>
    </main>
  );
}
