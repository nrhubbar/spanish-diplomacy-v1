import type { JSX } from "react";

/** U1, U3: line icons of the top bar, its menu and the pane's back link, on a 24-unit grid in `currentColor`. */
export type ShellIconName = "back" | "door" | "flag" | "chimney" | "gear" | "history" | "hourglass" | "menu" | "save";

const paths: Readonly<Record<ShellIconName, string>> = {
  back: "M15 5l-7 7 7 7",
  chimney: "M3 21V11l5 3v-3l5 3V5h4v16z",
  door: "M14 3H5v18h9M10 12h11M17 8l4 4-4 4",
  flag: "M5 21V4h11l-2 4 2 4H5",
  gear: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2",
  hourglass: "M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9",
  menu: "M4 7h16M4 12h16M4 17h16",
  save: "M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7"
};

/** Decorative: the text beside it, or the button's label, carries the meaning. */
export function ShellIcon({ name }: { readonly name: ShellIconName }): JSX.Element {
  return (
    <svg aria-hidden="true" className="shell-icon" focusable="false" viewBox="0 0 24 24">
      <path d={paths[name]} />
    </svg>
  );
}
