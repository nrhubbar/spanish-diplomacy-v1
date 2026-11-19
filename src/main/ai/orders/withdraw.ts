import type { WithdrawOrder } from "../../engine/types";
import type { OrderPlanner } from "./planner";

/**
 * H5: the computer player's Withdraw orders. TODO(m3r1-sub-territories): plan them; until then it gives none, so
 * games play as before.
 */
export const planWithdrawals: OrderPlanner<WithdrawOrder> = () => [];
