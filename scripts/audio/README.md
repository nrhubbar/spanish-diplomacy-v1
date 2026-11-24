# Audio build

Makes the files in `assets/audio/`. Run it only when a source or a level changes: every re-encode adds about 27 MB to Git LFS for good. Needs ffmpeg 8 with libopus and libmp3lame, and Node 24. The source recordings stay outside the repository.

## Music

```
node scripts/audio/build-music.ts <music-dir>     # about two minutes
```

`<music-dir>` is the owner's `music-attempt-2` folder: the four MP3 originals, `make_supermix.py`, its `.venv` (numpy, scipy), and `supermix_v2_out/cues.json`, the cue points of the approved mix.

1. `render-tracks.py` uses the mixer's own steps to render each track by itself: silence trimmed, level ridden, and the mix's fades on both ends. Cutting the finished mix would leave two tracks in every join and encode the music twice. Started at its cue, each track overlaps the one before exactly as in the mix.
2. ffmpeg measures each track's loudness, then applies the gain to reach -18 LUFS and at most -1.5 dBTP (two passes, linear), and encodes Opus 64 kbps (`.ogg`) and AAC 96 kbps (`.m4a`).
3. `tracks.json` gets each track's length and its overlap into the next, for the game's playlist.

## Effects

```
node scripts/audio/build-effects.ts <candidates-dir>
```

`<candidates-dir>` holds the takes and stems the owner chose. Each becomes a mono MP3 at 64 kbps: -20 LUFS, or a -6 dBTP peak when shorter than a second, and never above -2 dBTP before encoding. `end-turn` is the owner's mix, with its gains written in the script. The line printed for each file is the level measured after encoding.

Sources and licences: `assets/audio/ATTRIBUTION.md`.
