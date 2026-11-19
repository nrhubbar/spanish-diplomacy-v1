import attackerAttrition from "./emblems/attacker-attrition.svg?raw";
import attackerDemoralized from "./emblems/attacker-demoralized.svg?raw";
import attackerEliminated from "./emblems/attacker-eliminated.svg?raw";
import bothDemoralized from "./emblems/both-demoralized.svg?raw";
import defenderDemoralized from "./emblems/defender-demoralized.svg?raw";
import defenderEliminated from "./emblems/defender-eliminated.svg?raw";
import defenderExchange from "./emblems/defender-exchange.svg?raw";
import demoralized from "./emblems/demoralized.svg?raw";
import dugIn from "./emblems/dug-in.svg?raw";
import recovered from "./emblems/recovered.svg?raw";
import reinforcementArrived from "./emblems/reinforcement-arrived.svg?raw";
import surrendered from "./emblems/surrendered.svg?raw";
import type { OutcomeKey } from "../../presentation/outcomes";

/** Raw turn-report emblem sources, one per outcome key. Sanitize before use. */
export const emblemSources: Readonly<Record<OutcomeKey, string>> = {
  "attacker-eliminated": attackerEliminated,
  "attacker-attrition": attackerAttrition,
  "attacker-demoralized": attackerDemoralized,
  "both-demoralized": bothDemoralized,
  "defender-demoralized": defenderDemoralized,
  "defender-exchange": defenderExchange,
  "defender-eliminated": defenderEliminated,
  demoralized,
  "dug-in": dugIn,
  recovered,
  "reinforcement-arrived": reinforcementArrived,
  surrendered
};
