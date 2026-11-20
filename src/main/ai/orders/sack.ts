import type { SackOrder } from "../../engine/types";
import type { OrderPlanner } from "./planner";

/**
 * H5: the computer player's Sack orders. TODO(m3r1-air-generals): plan them; until then it gives none, so
 * games play as before.
 */
export const planSackings: OrderPlanner<SackOrder> = () => [];
