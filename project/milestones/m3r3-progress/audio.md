# audio: progress

> Internal. For the next streams.

## Where things are
- `assets/audio/` (LFS): `music/*.{ogg,m4a}` + `tracks.json` (length, overlap into the next), `effects/*.mp3`, `ATTRIBUTION.md`. Rebuilt by `scripts/audio/` (README there). Every re-encode adds about 27 MB to LFS for good.
- `src/main/audio/`: `sounds.ts` (the table: rank, cooldown, gain, voices), `cues.ts` (state before and after, to cues), `mixer.ts` (voices, cooldowns, duck), `levels.ts`, `playlist.ts`, `musicPlayer.ts` (two elements in turn), `director.ts` (joins them to a `SoundOutput`), `start.ts` (storage, gestures, hidden tab), `webAudio.ts` and `browser.ts` (the browser; tested with fakes in `src/test/audio/browser.test.ts`).
- `src/main/state/audioSlice.ts`, `audioMiddleware.ts` (one listener per store: `store.listenToActions`). `main.tsx` loads `audio/browser` as its own chunk.
- UI: `components/SoundControls.tsx` in Settings and the game menu; `screens/CreditsScreen.tsx` at `/credits`. Notifications can carry one action button.
- Map: `map/useDetailWanted.ts`; the last of several relief layers loads on zoom (view under half its width) or after 4 s of quiet unless the browser saves data. `map/reliefSequence.ts` decides the order. `data-refined` does not wait for a detail nobody wants yet; a test that needs the detail waits for `data-detail="shown"`.

## For other streams
- **A new order list in `Draft` (Disband, `upkeep`)**: add its key to `orderLists` in `audio/cues.ts`, and its action to `orderActions`, or it makes no sound. Add a row to `src/test/audio/decisions.test.ts`.
- Sound reads `viewedSession` (`hooks.ts`), never the raw session, so nothing hidden is heard.
- Playwright starts every spec with sound muted (`storageState` in `playwright.config.ts`). A spec that sets its own `storageState` must mute too, or it downloads music.
- Effects are MP3s fetched after the first click. A file that is not loaded yet is silent, and one that failed is asked for again at a later gesture. A sound that could not play holds no voice and starts no cooldown.

## Decisions
- Tracks are rendered from the originals with the mixer's own levelling and join fades, not cut from the mix (`research/audio.md` 2.3). Mix started at its cues, they match the mix.
- The guns start 1.4 s into End turn (as its fade begins) when one action does both; otherwise one event voice would always drop them.
- Hot seat: every planning sound, also cancelling and a refusal, is the plain tick.
- Several kinds of order in one action: rail, aircraft, truck, march, sea (tick).
- Music plays only during a game; the media keys mute and unmute Music. No M key and no header button (the menu has the mutes).
- Defaults Master 80, Music 60, Effects 80 (`audio.md` 6; the picture drew Effects at 70).
- Sound files are listed in `sounds.ts`, not in the scenario: that needs a schema change, which `prune-d6` held.

## Not verified
- Nobody has listened to anything: balance of every gain, Opus 64, the end-turn mix, the joins, the guns' moment.
- Real iPhone and Safari: second element, silent switch, gain node, ducking; Firefox.
- `march-a` (-26.9 LUFS) and `battle-a` (-22.6) are under the -20 target, held down by their peaks; not limited further.
