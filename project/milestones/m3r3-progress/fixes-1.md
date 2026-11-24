# fixes-1

- Pane choices: one saved open/closed choice for each layout (`panePreference.ts`, `open: { side, sheet }`). The old single value is ignored, since it did not say which layout it was for.
- Pane grips: named "Pane width" and "Pane height". A cancelled drag or lost capture goes back to the map's width. The inline `--pane-width` is written by `CampaignMap` too, so it is set back rather than removed.
- `tickedOnMap` marks exactly what `musterOrderFrom` would order.
- Casualties: a unit a battle destroyed is not counted again as surrendered or disbanded. A Disband order must stay out of `turnCasualties`.
- `transportBonus` (`engine/movement/allowance.ts`) is the one number for "moves 1 territory further".
- Unit effects: a type's arm drops its last word only when that word is a known formation (`formations` in `unitEffects.ts`).
