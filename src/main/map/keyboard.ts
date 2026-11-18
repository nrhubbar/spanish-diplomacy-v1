export type MapKeyIntent =
  | { readonly deltaX: number; readonly deltaY: number; readonly kind: "pan" }
  | { readonly kind: "reset" }
  | { readonly kind: "select" }
  | { readonly kind: "zoom-in" }
  | { readonly kind: "zoom-out" };

export const panStepPixels = 60;

export function mapKeyIntent(key: string): MapKeyIntent | undefined {
  switch (key) {
    case "Enter":
    case " ":
      return { kind: "select" };
    case "a":
    case "A":
    case "ArrowLeft":
      return { deltaX: panStepPixels, deltaY: 0, kind: "pan" };
    case "d":
    case "D":
    case "ArrowRight":
      return { deltaX: -panStepPixels, deltaY: 0, kind: "pan" };
    case "w":
    case "W":
    case "ArrowUp":
      return { deltaX: 0, deltaY: panStepPixels, kind: "pan" };
    case "s":
    case "S":
    case "ArrowDown":
      return { deltaX: 0, deltaY: -panStepPixels, kind: "pan" };
    case "+":
    case "=":
      return { kind: "zoom-in" };
    case "-":
    case "_":
      return { kind: "zoom-out" };
    case "0":
    case "Home":
      return { kind: "reset" };
    default:
      return undefined;
  }
}

export type KeyTarget = "editable" | "native-control" | "map";

/**
 * B3: native buttons and form controls keep their own Enter/Space activation, and editable
 * fields keep every key. Only map surfaces (the map itself and SVG territories) get "select".
 */
export function shouldHandleMapKey(intent: MapKeyIntent, target: KeyTarget): boolean {
  if (target === "editable") return false;
  if (target === "native-control") return intent.kind !== "select";
  return true;
}

export function classifyKeyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof Element)) return "map";
  if (target.closest("input, textarea, select, [contenteditable='true']") !== null) return "editable";
  if (target.closest("button, a[href], summary") !== null) return "native-control";
  return "map";
}
