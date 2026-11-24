import type { JSX } from "react";
import type { WeatherId } from "../../engine/types";

/**
 * X8: a small inline icon for each weather outcome, drawn in `currentColor` on a 24-unit grid.
 * Decorative: the outcome's name is always written beside it or carried by the parent's label.
 * An outcome id a scenario adds without an icon gets the cloud.
 */
const sunRays = "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8";
const cloud = "M7 17.5h10a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 9.6a4 4 0 0 0-1 7.9z";

const shapes: Readonly<Record<string, JSX.Element>> = {
  clear: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d={sunRays} />
    </>
  ),
  hot: (
    <>
      <path d="M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z" />
      <circle cx="12" cy="17" fill="currentColor" r="1.8" />
      <path d="M12 15.2V8.5M17.5 4.5l1.5-1.5M18 9h2M17.5 13.5l1.5 1.5" />
    </>
  ),
  mud: (
    <>
      <path d="M3 15c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 19.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
      <path d="M8 5.5v3.5M12 4v3.5M16 5.5v3.5" />
    </>
  ),
  rain: (
    <>
      <path d={cloud} transform="translate(0 -3)" />
      <path d="M8 17.5l-1 3M12 17.5l-1 3M16 17.5l-1 3" />
    </>
  ),
  "severe-cold": (
    <>
      <path d="M8 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z" />
      <circle cx="10" cy="17" fill="currentColor" r="1.8" />
      <path d="M18 4v8M14.5 6l7 4M14.5 10l7-4" />
    </>
  ),
  snow: (
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 2 2-2M10 19.5l2-2 2 2M4.8 10.3l2.6-.8-.6-2.7M19.2 13.7l-2.6.8.6 2.7M4.8 13.7l2.6.8-.6 2.7M19.2 10.3l-2.6-.8.6-2.7" />
  )
};

/** The plain cloud, for a badge that stands for any weather. */
export function CloudIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" className="weather-icon" fill="none" focusable="false" height="1em" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="1em">
      <path d={cloud} />
    </svg>
  );
}

export function WeatherIcon({ weatherId }: { readonly weatherId: WeatherId }): JSX.Element {
  return (
    <svg aria-hidden="true" className="weather-icon" data-weather={weatherId} fill="none" focusable="false" height="1em" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="1em">
      {shapes[weatherId] ?? <path d={cloud} />}
    </svg>
  );
}
