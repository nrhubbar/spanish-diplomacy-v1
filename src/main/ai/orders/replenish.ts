import type { ReplenishOrder } from "../../engine/types";
import type { OrderPlanner } from "./planner";

/**
 * H5: the computer player's Replenish orders. TODO(m3r1-recruit-replenish): plan them; until then it gives none, so
 * games play as before.
 */
export const planReplenishment: OrderPlanner<ReplenishOrder> = () => [];
