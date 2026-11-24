# values (M3 Rev 3)

Handed back at the token limit with steps 1 and 2 done. Steps 3, 4 and 5 are not started.

## Done: D2, D4, D5 (not rail), starting fortifications
- The unit, building, link-work and raid tables are the owner's. `road.motorLevel` is `track`: any road takes trucks, a link with no road and a pass still don't. A road upgrade fits only a link whose road trucks can't use yet (`afterWork` reads `motorLevel`), since a main road would give nothing.
- `engine/units/fighting.ts`: `typeCanFight`, `carriesOf`, `isTruckType` (carries and can't fight). `ai/reach.ts`: `isTransport` (anything that carries) and `isTruck`. Tanks march for themselves, are bought to fight, and join an army whose march needs them (`withRoutes`).
- `d20.factionModifiers` is empty. The d6 copy in `combat.factionModifiers` is left for `prune-d6-4`.
- Madrid and Barcelona start with fortifications; each has a note.
- `src/test/pinned.ts`: numbers of their own for tests that used the shipped ones as a fixture (`pinned`, `mainRoadsOnly`, `popularResistance`, `lightBarricades`, `unfortified`).

## Factory (D3): plan, from reading the code
- Today `industry` is a track and `factory` a building with `recruit-slots`. Make `factory` a track: 1.5 Funds a level, 6/4, 2 turns, `cityOnly`, with per-level `recruit-slots` in a new development `effects` list; drop the building effect kind if nothing uses it.
- `recruitment/rules.ts`: `typeLock` reads only the capital's buildings. Buildings stay so; a track counts at level 1 in any sub-territory of the territory its recruiter holds. `recruitSlots` adds level x extra over those. Loader: `requires` names a building or a track, ids unique across both.
- `subTerritories[].development.industry`, `.buildings` and `.buildable` hold the old ids. Every city sub-territory needs `factory` in `buildable`.
- Raids already hit development levels (`hitBuilding`). `ai/orders/build.ts` scores unlocks for buildings only. `EconomyIcon` picks the icon by `cityOnly`.
- Income worked out by hand from the data, not by the engine: sites Bizkaia 2, Barcelona 2, and 1 each at A Coruña, Oviedo, Gijón (`asturias`), Torrelavega (`cantabria`), Gipuzkoa, Zaragoza, Madrid, Valladolid, Toledo, Valencia, Seville, Cádiz, Cartagena (`murcia`), with Alicante and Málaga dropped. Republic 14.5, North 6, South 1, South with Andalucía clear 11. North sits on the bound. No sources gathered yet.

## Rail (D5): where
- `railDepartures` (`movement/network.ts`), `hasRoom` (`movement/routes.ts`, counts armies in a Set), `checkArmies` (`movement/transit.ts`), `withRoutes` in `ai/orders/move.ts` (`fits`), `routeDetail`, `heldBackText`, `presentation/economy.ts`, `EconomyIcon`, `build.ts` scores. The `move-held-back` outcome needs the number left. `rail` in `linkModifiers` takes the per-level number. Open question: do generals take a place? `transportOf` lets them ride free.

## Watch
- With Depots and Airfields unlocking types alone, the computer's unlock builds can take all three of its Build orders before its development target (seen in `aiGuard`'s development case, which now uses the lavish budget). One for `ai`.
- The computer does plan a regiment's two-step march with a tank, but the tank joins it only if it has no order of its own; otherwise the march is cut to its first step, as with trucks.
