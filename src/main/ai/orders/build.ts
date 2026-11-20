import type { BuildOrder } from "../../engine/types";
import type { OrderPlanner } from "./planner";

/**
 * H5: the computer player's Build orders. TODO(m3r1-economy-builds): plan them; until then it gives none, so
 * games play as before.
 */
export const planBuilds: OrderPlanner<BuildOrder> = () => [];
