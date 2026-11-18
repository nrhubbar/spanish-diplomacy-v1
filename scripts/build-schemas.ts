// Generates the published JSON Schemas from the Zod sources (the single source of truth).
// Run with `npm run spec:build`; `npm run spec:check` (a unit test) fails if they drift.
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { mapSchema } from "../src/main/scenarios/schema/mapSchema.ts";
import { scenarioSchema } from "../src/main/scenarios/schema/scenarioSchema.ts";

const outputs = [
  ["src/main/scenarios/schema/scenario.schema.json", scenarioSchema],
  ["src/main/scenarios/schema/map.schema.json", mapSchema]
] as const;

for (const [path, schema] of outputs) {
  writeFileSync(path, `${JSON.stringify(z.toJSONSchema(schema, { io: "input" }), null, 2)}\n`);
  console.log(`wrote ${path}`);
}
