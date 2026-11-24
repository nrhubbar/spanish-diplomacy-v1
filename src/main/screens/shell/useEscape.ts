import { useEffect, useRef } from "react";

/** While `active`, Escape calls `onEscape`; pressed inside an open dialog or menu it is theirs to close. */
export function useEscape(active: boolean, onEscape: () => void): void {
  const latest = useRef(onEscape);
  useEffect(() => { latest.current = onEscape; });
  useEffect(() => {
    if (!active) return undefined;
    const press = (event: KeyboardEvent): void => {
      const inside = event.target instanceof Element && event.target.closest("[aria-modal='true'], [role='menu'], [data-own-escape]") !== null;
      if (event.key === "Escape" && !inside) latest.current();
    };
    window.addEventListener("keydown", press);
    return () => { window.removeEventListener("keydown", press); };
  }, [active]);
}
