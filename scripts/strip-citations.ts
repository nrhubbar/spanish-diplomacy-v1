import type { Plugin } from "vite";
import { citationProblems, withoutCitations } from "../src/main/scenarios/authoring.ts";
import { scenarioSchema } from "../src/main/scenarios/schema/scenarioSchema.ts";

/** Production builds ship each scenario without its sources and notes, once those have been checked. */
export function stripCitations(): Plugin {
  return {
    name: "spanish-diplomacy-strip-citations",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (!/\/src\/scenarios\/[^/]+\/scenario\.json$/u.test(id)) return null;
      return { code: strippedScenario(code), map: null };
    }
  };
}

/** The scenario file's text as it ships. Throws if an entry lacks the citations an authored scenario needs. */
export function strippedScenario(text: string): string {
  const json: unknown = JSON.parse(text);
  const problems = citationProblems(scenarioSchema.parse(json));
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return JSON.stringify(withoutCitations(json));
}
