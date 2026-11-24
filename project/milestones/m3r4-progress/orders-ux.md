# orders-ux: N1, N5, N9, N10

- **N9** Sound levels left the game's menu; Settings (one click from it) has them. The menu's sound styles are gone.
- **N5** `presentation/numbers.ts` (`tenths`, `signedTenths`): halves away from zero, true minus, "<0.1" under 0.05. `resourceAmount`, `signedResourceAmount`, `menShort`, `menInShort` and the roll `signed` in `odds.ts` print through it. Ledger totals are the rounded true total. `economy.signed` (unused) is removed.
- **N1** `disband` is an `OrderKind`, last in the menu when every selected unit can disband (also in contested ground), so a selection with a general is not offered it. `planDisband` takes a list: one draft change, or a refusal of the whole. `OrderMenu` is the one menu; the selection bar shows it, and `OrderButton` (after the unit list) opens it as rows, under the button on a desktop and as a bottom sheet on a phone (CSS only). `DisbandConfirm` is the second step everywhere. Cards keep only "Goes home ..." with Keep (`DisbandPlanned`). Aircraft: `AircraftDisband` after Stand down.
- **N10** `generalWords` (`presentation/generals.ts`) from the scenario's effects, on the unit card (in view) and the map counter (hover, focus, accessible name).

Left for others
- Invade card (`invade` stream): `generalWords(scenario, raised, unitId)?.text` as the general's hover text.
- `air`: its Ground Support average can print through `tenths`. `unitEffects.ts` "best aircraft" text untouched.
