import attackerAttrition from "./medallions/attacker-attrition.svg?raw";
import attackerDemoralized from "./medallions/attacker-demoralized.svg?raw";
import attackerEliminated from "./medallions/attacker-eliminated.svg?raw";
import bothDemoralized from "./medallions/both-demoralized.svg?raw";
import defenderDemoralized from "./medallions/defender-demoralized.svg?raw";
import defenderEliminated from "./medallions/defender-eliminated.svg?raw";
import defenderExchange from "./medallions/defender-exchange.svg?raw";
import demoralized from "./medallions/demoralized.svg?raw";
import dugIn from "./medallions/dug-in.svg?raw";
import recovered from "./medallions/recovered.svg?raw";
import reinforcementArrived from "./medallions/reinforcement-arrived.svg?raw";
import surrendered from "./medallions/surrendered.svg?raw";
import type { OutcomeKey } from "../../presentation/outcomes";

/** Raw map medallion sources, one per outcome key. Sanitize before use. */
export const medallionSources: Readonly<Record<OutcomeKey, string>> = {
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
