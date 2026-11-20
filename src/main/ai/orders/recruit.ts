import type { RecruitOrder } from "../../engine/types";
import type { OrderPlanner } from "./planner";

/**
 * H5: the computer player's Recruit orders. TODO(m3r1-recruit-replenish): plan them; until then it gives none, so
 * games play as before.
 */
export const planRecruits: OrderPlanner<RecruitOrder> = () => [];
