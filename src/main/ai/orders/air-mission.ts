import type { AirMissionOrder } from "../../engine/types";
import type { OrderPlanner } from "./planner";

/**
 * H5: the computer player's air mission orders. TODO(m3r1-air-generals): plan them; until then it gives none, so
 * games play as before.
 */
export const planAirMissions: OrderPlanner<AirMissionOrder> = () => [];
