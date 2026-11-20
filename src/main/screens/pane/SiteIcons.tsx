import type { JSX } from "react";
import type { TerrainKind } from "../../engine/types";

/** X8: small inline symbols for sub-territory facts, decorative beside their text. */
const shapes: Readonly<Record<"mountain" | "swamp" | "open" | "port" | "rail" | "contested" | "withdraw" | "attack", JSX.Element>> = {
  attack: <path d="M2 14 14 2M9 2h5v5M2 9l5 5" />,
  contested: <path d="M1 15 15 1M1 9 9 1M7 15l8-8" />,
  mountain: <path d="M1 14 6 5l3 5 2-3 4 7Z" />,
  open: <path d="M1 12c3-2 5-2 7 0s5 2 7 0" />,
  port: <path d="M8 2v12M4 5h8M3 10c0 3 2.5 4 5 4s5-1 5-4" />,
  rail: <path d="M4 1 3 15M12 1l1 14M3 4h10M3 8h10M3 12h10" />,
  swamp: <path d="M1 9c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 4 0M1 13c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 4 0M8 2v5" />,
  withdraw: <path d="M14 8H3M7 4 3 8l4 4" />
};

export type SiteIconKind = keyof typeof shapes;

export function SiteIcon({ kind }: { readonly kind: SiteIconKind | TerrainKind }): JSX.Element {
  return (
    <svg aria-hidden="true" className="site-icon" data-icon={kind} focusable="false" viewBox="0 0 16 16">
      {shapes[kind]}
    </svg>
  );
}
