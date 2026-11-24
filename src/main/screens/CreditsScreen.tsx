import type { JSX } from "react";
import { useLocation, useNavigate } from "react-router";
import { credits } from "../audio/credits";
import { useSession } from "../hooks";
import { paths, routeForSession } from "../state/routing";

/** Who made the music and sounds. Back returns to Settings when it was opened there. */
export function CreditsScreen(): JSX.Element {
  const navigate = useNavigate();
  const session = useSession();
  const opened: unknown = useLocation().state;
  const back = opened === paths.settings ? paths.settings : routeForSession(session);

  return (
    <main className="screen card-screen" aria-labelledby="credits-title">
      <p className="screen-kicker">With thanks</p>
      <h1 id="credits-title">Credits</h1>
      {credits.map(({ lines, title }) => (
        <section aria-label={title} className="settings-section" key={title}>
          <h2>{title}</h2>
          {lines.map((line) => (
            <p key={line.map(({ text }) => text).join("")}>
              {line.map(({ text, url }, at) => (url === undefined
                ? text
                : <a href={url} key={at} rel="noreferrer" target="_blank">{text}</a>))}
            </p>
          ))}
        </section>
      ))}
      <div className="action-row">
        <button className="secondary-button" onClick={() => { void navigate(back); }} type="button">Back</button>
      </div>
    </main>
  );
}
