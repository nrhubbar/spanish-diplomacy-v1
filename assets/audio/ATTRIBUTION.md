# Audio sources and licences

Only CC0 and CC BY material is used. Players see the required credits in the game's Credits screen
(`src/main/audio/credits.ts`); keep the two in step. Built by `scripts/audio/` (see its README).

## Music (`music/`)

All four tracks are by Scott Buckley, released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), www.scottbuckley.com.au.

| File | Title |
|---|---|
| `shadows-and-dust` | Shadows and Dust |
| `memories-of-stone` | Memories Of Stone |
| `a-dragons-lullaby` | A Dragon's Lullaby |
| `unraveling` | Unraveling- |

Changes: silence trimmed, level ridden and normalised to -18 LUFS, short fades at both ends, re-encoded from the author's 320 kbps MP3s to Opus 64 kbps (`.ogg`) and AAC 96 kbps (`.m4a`). `tracks.json` holds each length and the overlap into the next track.

## Effects (`effects/`)

All are trimmed, mixed to mono, faded, levelled and encoded to MP3 64 kbps.

| File | Source | Author | Licence | Other changes |
|---|---|---|---|---|
| `order-a` | [WWS Typewriter](https://commons.wikimedia.org/wiki/File:WWS_Typewriter.ogg) | Work With Sounds / Konrad Gutkowski | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | |
| `recruit-a` | [Military Snaredrum](https://freesound.org/people/aUREa/sounds/475246/) | aUREa | CC0 | |
| `build-a` | [Anvil Hit 2](https://freesound.org/people/michorvath/sounds/270588/) | michorvath | CC0 | |
| `air-a` | [WW2AirplaneFlyover](https://freesound.org/people/daveincamas/sounds/43807/) | daveincamas | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | |
| `rail-a` | [WWS Steam Whistle](https://commons.wikimedia.org/wiki/File:WWS_SteamWhistle.ogg) | Work With Sounds / Konrad Gutkowski | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | whistle, joined to the train below |
| `rail-a` | [Steam train passing by](https://freesound.org/people/Stek59/sounds/578759/) | Stek59 | CC0 | |
| `truck-a` | [truck big diesel water tank start back up short beep pull away](https://freesound.org/people/kyles/sounds/406886/) | kyles | CC0 | |
| `march-a` | [squad march](https://freesound.org/people/martian/sounds/333907/) | martian | CC0 | |
| `battle-a` | [Cannon artillery - distant gunshots](https://freesound.org/people/Aegersum/sounds/345844/) | Aegersum | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | |
| `blocked-a` | [Interface Sounds](https://opengameart.org/content/interface-sounds), `error_004` | Kenney | CC0 | |
| `end-turn` | [Church Bell](https://freesound.org/people/Kalomina/sounds/611469/) | Kalomina | CC0 | the strike at 50.3 s, slowed to 65% |
| `end-turn` | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), `Timpani3_Hit_v4_rr1_Sum.wav` | Versilian Studios (Sam Gossner, Simon Dalzell) | CC0 | peaks limited |
| `end-turn` | [Military Snaredrum](https://freesound.org/people/aUREa/sounds/475246/) | aUREa | CC0 | as `recruit-a` |

## Before a public release

The Freesound files above were made from Freesound's **public preview MP3s**, not the uploads. Log in, download these originals, cut the same passages, and rebuild: 475246 (aUREa), 270588 (michorvath), 43807 (daveincamas), 578759 (Stek59), 406886 (kyles), 333907 (martian), 345844 (Aegersum), 611469 (Kalomina). The Work With Sounds, Kenney and VSCO 2 files are originals.
