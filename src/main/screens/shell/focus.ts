/**
 * Moves keyboard focus to a control as it appears, so focus is not lost when the button that
 * opened a step unmounts. A hidden copy (the collapsed sheet) cannot take focus and is skipped.
 */
export function focusWhenShown(element: HTMLElement | null): void {
  element?.focus();
}
