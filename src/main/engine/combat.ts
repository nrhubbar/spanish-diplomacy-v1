/**
 * Battle arithmetic for the m2-strength ruleset, split by concern (H9): army values
 * (`combat/values.ts`), odds, modifiers and the outcome distribution (`combat/odds.ts`), and
 * the planning estimate (`combat/estimate.ts`). Import from here.
 */
export * from "./combat/estimate";
export * from "./combat/odds";
export * from "./combat/values";
