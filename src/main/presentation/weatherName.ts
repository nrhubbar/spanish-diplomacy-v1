import type { WeatherId } from "../engine/types";

/**
 * D7: a weather modifier's name on a battle card or destination row, from the outcome id
 * ("severe-cold" reads "Severe cold"). The modifier carries only the id, and these lines have
 * no scenario at hand; the ids are the names written in lower kebab case.
 */
export function weatherModifierName(weatherId: WeatherId): string {
  const words = weatherId.split("-").join(" ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
