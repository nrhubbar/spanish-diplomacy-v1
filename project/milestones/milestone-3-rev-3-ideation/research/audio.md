# Sound: music and effects (owner's note 3)

> Internal. Checked 22 Nov 2026. Labels: **[measured]** by this agent, **[docs]** from a page linked here, **[judgement]** opinion. Nobody has listened to any of this: the agent works from waveforms and levels, so every choice of "best" needs the owner's ears.

## 1. Recommendation in short

1. Ship the music as **four files, one per track, with their fades baked in**, streamed by plain `<audio>` elements: **Opus 64 kbps in Ogg** (10.8 MB for all four) with **AAC 96 kbps in MP4** (16.2 MB) for iPhone and older Safari. Load nothing until music is on and the player has clicked.
2. Ship **11 effects**, mono, about **0.1 MB in total**, decoded into memory by Web Audio after the first click.
3. Decide every sound in **one pure function** with one table: one sound per player action, limits per sound, quiet and short for frequent actions, special sounds only for orders a person gave.
4. Three sliders (Master, Music, Effects) plus one mute button. Saved in the browser.

## 2. Music

### 2.1 What we have [measured]

| File | Format | Size | Length | Average rate |
|---|---|---|---|---|
| `supermix.ogg` | **Opus** in Ogg, stereo, 48 kHz | 16,119,489 B | 1300.0 s | 99 kbps |
| `supermix.m4a` | AAC in MP4, stereo, 48 kHz | 21,131,790 B | 1300.0 s | 130 kbps |
| Four source MP3s | 320 kbps | 54 MB | 22:31 | 320 kbps |

Mix loudness is -18.0 LUFS, true peak -3 dBTP (from `cues.json`). -18 LUFS is also the usual mobile target (section 4.3), so the music needs no further levelling. The mix always opens with the same 6:47 of "Shadows and Dust", and the last track crossfades into the first over 18.2 s, so the loop point sits inside full-level music.

### 2.2 One file does not limit the download [measured]

A local server with range support, a page that sets `preload="none"`, and a click to play. Nothing was requested before the click in any browser. After 20 seconds of listening:

| Browser (Playwright build) | File | Bytes already sent |
|---|---|---|
| Firefox | `supermix.ogg` | **16.4 MB, the whole file, in about 2 s** |
| WebKit | `supermix.ogg` | **16.1 MB, the whole file** |
| WebKit | AAC 96 | **15.8 MB, the whole file** |
| Chromium | `supermix.ogg` | 6.2 MB (259 s buffered) |
| Chromium | Opus 64 | 6.1 MB (380 s buffered) |

The link was local and fast, so this is the worst case. Still: **range requests make seeking work, they do not cap what a browser downloads.** Someone who plays for three minutes on Firefox or Safari would pay for all 16 MB. Splitting by track is what caps it.

### 2.3 Options

| Option | First listen | Loop and joins | Risk | Verdict |
|---|---|---|---|---|
| One file, `<audio loop>` | 6 to 16 MB | Browser restarts it, so a possible small gap in loud music every 21:40 | Simple | Fallback |
| **Four files, two `<audio>` elements, fades baked in** | 1.4 to 3.4 MB | Next track starts before the last ends; a 0.1 s error is inaudible because the two tracks are different music | A little code | **Recommended** |
| HLS or segments | Small | Good | Needs a 100+ kB library or per-browser code paths | No |
| Decode all to memory | 16 MB, then about 500 MB RAM | Perfect | Phones crash | No |

Baking the fades into the files matters: iPhone ignores `element.volume`, so a fade done in script would not work there. Baked fades need only the right start time, which `cues.json` already gives (12.2, 3.9, 9.7 and 18.2 s overlaps).

**The build step:** `make_supermix.py` already levels each track and joins them. It needs a mode that writes each levelled track with equal-power fades instead of one mix (a small change, not tried). Cutting the finished mix is *not* equivalent, because the crossfades would contain both tracks. Render from the mix in memory, not from `supermix.ogg`, or quality is lost twice. Keep the MP3 sources outside the repository.

**Play order:** start each session on a different track, then follow the cue order. That alone fixes "the game always opens with the same music".

### 2.4 Encodings [measured]

The whole 21:40 mix, re-encoded from `supermix.ogg`. Sizes are exact for these settings; quality is a second lossy pass, so judge quality only from a fresh render.

| Setting | Whole mix | Four separate tracks (with overlaps) |
|---|---|---|
| Opus 48 | 8.20 MB | |
| **Opus 64** | 10.97 MB | **10.83 MB** (3.08, 2.88, 1.43, 3.45) |
| Opus 80 | 13.68 MB | |
| Opus 96 | 16.31 MB | 16.29 MB |
| AAC-LC 64 | 10.65 MB | |
| **AAC-LC 96** | 15.85 MB | **16.17 MB** (4.97, 4.01, 2.04, 5.14) |
| AAC-LC 128 | 21.05 MB | |

Loudness is unchanged (-18.5 LUFS, first two minutes, three versions checked). [MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs) lists 96 kbps as its guideline for stereo in both Opus and AAC [docs]. Opus 64 is below that, chosen because this is slow ambient music under effects at half volume [judgement]. **Owner check:** hear Opus 64 against 96 in headphones on "Unraveling". If 64 is audibly worse, 96 costs 5.5 MB more in total and 1.4 MB more for an average first track.

### 2.5 Browser support [docs]

- Opus in `<audio>` ([Can I Use data](https://github.com/Fyrd/caniuse/blob/main/features-json/opus.json), [Can I Use](https://caniuse.com/opus)): 93.3% full, 4.1% partial. Chrome and Firefox full; iOS Safari full since 18.4; macOS Safari needs macOS 15.4. Apple's [Safari 18.4 notes](https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes): "Added support for Ogg Opus and Ogg Vorbis on macOS Sequoia 15.4, iOS 18.4". MDN's codec page is out of date on this.
- AAC: 95.1% full, 2.5% partial ([data](https://github.com/Fyrd/caniuse/blob/main/features-json/aac.json)). Firefox needs the system codec, and MDN says AAC "is not available in Chromium builds", **so Playwright's Chromium cannot play it**.
- Neither format alone covers everyone; together they do.
- **iPhone volume:** Apple says "the `volume` property is not settable in JavaScript" on iOS ([Apple](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html)). The way round is Web Audio (`createMediaElementSource` into a gain).
- **Open Safari bug:** [WebKit 276813](https://bugs.webkit.org/show_bug.cgi?id=276813), still NEW on 27 Oct 2026 and reported up to Safari 27: a gain node does **not** change the volume of WebM Opus; MP4 AAC works. Whether Ogg Opus is affected is not stated.

That settles the rule, by feature test rather than browser name:

```
probe.volume = 0.5
if it reads back 0.5: play <audio> directly, set element.volume; Opus first, AAC second
else (iPhone, iPad):  AAC only, through createMediaElementSource and a gain node
```

### 2.6 Behaviour

- **Start:** never on load. [MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): audible play before a gesture rejects with `NotAllowedError`. Start on the click that starts or resumes a campaign, and **always catch the rejection**: the production smoke test fails on any console error.
- **Test runs:** do not fetch music in the Playwright suites or the smoke test (a `?mute` flag or a saved setting in the fixture).
- **Tab hidden:** fade to silence over 0.3 s, then pause; resume only if music was playing.
- **iPhone silent switch:** set `navigator.audioSession.type = "ambient"` where it exists ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioSession/type), not in every browser). Apple describes that kind of audio as responding to the silent switch and mixing with other audio ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/playing-audio)), so a podcast keeps playing.
- **Media keys:** set Media Session title "Spanish Diplomacy" and handle play and pause, so a headset button pauses the music. Do not offer skip.
- **Data Saver** (`navigator.connection.saveData`, Chromium only) **or a 2G/3G estimate:** music stays off until asked for. Elsewhere, use the sequence in section 6.
- **Second element on iPhone:** if its `play()` is refused, wait for `ended` and reuse the first element (a short silence after the baked fade-out). **Needs a real iPhone test.**
- **After an error:** one retry, then silence; never an error message.

### 2.7 Where the files live

**In the repository, in Git LFS**, under `assets/audio/`, imported through Vite so each gets a content hash. `.gitattributes` already covers `*.ogg`, `*.m4a`, `*.mp3`. S3 only would leave developers and tests without sound and add a second release path.

- Cost: 27 MB of LFS next to 55.6 MB today [measured]. Free quota is **10 GiB of bandwidth and 10 GiB of storage a month**, and downloads from a public repository, its forks and Actions count against its owner ([GitHub](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)). A fresh full pull grows from about 56 to 83 MB, so about 130 pulls a month. CI already restores LFS from its cache.
- Every re-encode adds 27 MB of storage for good. Settle the bitrate before the first commit.
- Use `.ogg`, not `.opus`: the second is not in `.gitattributes`.
- Keep an `ATTRIBUTION.md` beside the files.

### 2.8 Credits the player can see

Scott Buckley's page confirms CC BY 4.0, "free for use in any project (including commercial) as long as I'm credited", and gives the wording ([Shadows and Dust](https://www.scottbuckley.com.au/library/shadows-and-dust/), opened). CC BY also asks for a licence link and a note of changes. Put a **Credits** section in Settings beside the existing map sources list, linked from the start screen's menu:

> **Music**
> 'Shadows and Dust', 'Memories Of Stone', 'A Dragon's Lullaby' and 'Unraveling-' by Scott Buckley, released under CC BY 4.0 (link). www.scottbuckley.com.au (link)
> Changed from the originals: volume levelled, edited and crossfaded. Scott Buckley does not endorse this game.
>
> **Sound effects**
> 'Steam Whistle' and 'Typewriter' by Work With Sounds / Konrad Gutkowski, CC BY 4.0 (links). 'WW2AirplaneFlyover' by daveincamas, CC BY 4.0 (link). 'Cannon artillery, distant gunshots' by Aegersum, CC BY 3.0 (link). Trimmed, mixed to mono, faded and levelled.
> Also, with thanks (public domain, CC0): aUREa, martian, michorvath, kyles, Stek59, DeVern, Kenney.

Only CC0 and CC BY are used, so no line here restricts the rest of the game.

## 3. Effects

### 3.1 Earlier notes

Searched `project/`, `src/`, `readme.md`, `CLAUDE.md` in this worktree and in `spanish-diplomacy-deployment`, both `music-attempt` folders, and every branch. **There are no sound-effect notes anywhere.** The only mention is the earlier idea of a sound at 10 seconds left on the turn timer.

### 3.2 Shortlist

Licence read on each listed page (Commons through its API) on 22 Nov 2026. **In set** means it is in `audio-candidates/`. Freesound items are its public preview MP3s; download originals, which need a login, before shipping.

| Action | Candidate, author | Licence | Length | Fit |
|---|---|---|---|---|
| Create order | **In set:** [WWS Typewriter](https://commons.wikimedia.org/wiki/File:WWS_Typewriter.ogg), Work With Sounds / K. Gutkowski | CC BY 4.0 | 25.9 s | 1940 Erika 5 |
| | **In set:** [Interface Sounds](https://opengameart.org/content/interface-sounds) `drop_003`, Kenney | CC0 | 0.2 s | Neutral, softest |
| | [WWS Teleprinter typing](https://commons.wikimedia.org/wiki/File:WWS_Teleprintertyping.ogg) | CC BY 4.0 | 94 s | Lorenz teleprinter |
| Recruit | **In set:** [Military Snaredrum](https://freesound.org/people/aUREa/sounds/475246/), aUREa | CC0 | 10.4 s | Drum call |
| | **In set:** [traditional stamp](https://freesound.org/people/I.fekry/sounds/470710/), I.fekry | CC0 | 1.6 s | Enlistment paper |
| | [WWS Time clock](https://commons.wikimedia.org/wiki/File:WWS_Timeclock.ogg) | CC BY 4.0 | 12.8 s | Pre-1950s clock |
| Build | **In set:** [Anvil Hit 2](https://freesound.org/people/michorvath/sounds/270588/), michorvath | CC0 | 1.4 s | Two strikes |
| | [WWS Blacksmith's anvil](https://commons.wikimedia.org/wiki/File:WWS_Blacksmith8217sanvil.ogg), La Fonderie | CC BY 4.0 | 120 s | Real forge |
| | [Large Anvil & Steel Hammer 4](https://freesound.org/people/Benboncan/sounds/103632/), Benboncan | CC BY 4.0 | 1.4 s | |
| Air mission | **In set:** [WW2AirplaneFlyover](https://freesound.org/people/daveincamas/sounds/43807/), daveincamas | CC BY 4.0 | 143.6 s | Second World War fighter, real flypast |
| | **In set:** [propeller plane](https://freesound.org/people/Blahoslav/sounds/276492/), Blahoslav | CC0 | 59 s | Twin propeller |
| Rail | **In set (first half):** [WWS Steam Whistle](https://commons.wikimedia.org/wiki/File:WWS_SteamWhistle.ogg), K. Gutkowski | CC BY 4.0 | 11 s | Prussian P 8, built 1918 |
| | **In set (second half):** [Steam train passing by](https://freesound.org/people/Stek59/sounds/578759/), Stek59 | CC0 | 31.7 s | |
| | [WWS Steam locomotive](https://commons.wikimedia.org/wiki/File:WWS_Steamlocomotive.ogg) | CC BY 4.0 | 35.4 s | Krupp, 1940 |
| Truck | **In set:** [truck big diesel](https://freesound.org/people/kyles/sounds/406886/), kyles | CC0 | 40.7 s | Pulls away. A modern truck |
| | [WWS Tarpan 239 D starting](https://commons.wikimedia.org/wiki/File:WWS_FSRTarpan239Dvanstarting.ogg), Museum of Municipal Engineering | CC BY 4.0 | 31.3 s | Small diesel |
| | [diesel starting and idling](https://freesound.org/people/paulmessier/sounds/264870/), paulmessier | CC BY 4.0 | 30.6 s | |
| March | **In set:** [squad march](https://freesound.org/people/martian/sounds/333907/), martian | CC0 | 36.7 s | Squad in step |
| | [marching boots](https://freesound.org/people/klankbeeld/sounds/172369/), klankbeeld | CC BY 4.0 | 54.1 s | |
| End turn | **In set:** [Cinematic Hit With Horns](https://freesound.org/people/DeVern/sounds/427803/), DeVern | CC0 | 4.4 s | Orchestral, cut to 2 s |
| | **In set:** two drum strikes, synthesised | Ours | 2.0 s | Drier, less film-like |
| | [Timpani C2](https://freesound.org/people/Terry93D/sounds/369394/), Terry93D | CC0 | 4.0 s | Could be layered |
| Battle report | **In set:** [Cannon artillery](https://freesound.org/people/Aegersum/sounds/345844/), Aegersum | CC BY 3.0 | 5.9 s | Distant guns |
| Order refused | **In set:** Kenney `error_004` | CC0 | 0.15 s | Softened |

**Ruled out:** [JoseIgnacioTriay's stunt plane](https://freesound.org/people/JoseIgnacioTriay/sounds/515212/) (CC BY-NC), the [Vintage Biplanes pack](https://freesound.org/people/craigsmith/packs/24881/) (old studio library recordings, rights chain not verified), all CC BY-SA files on Commons, and Pixabay, Mixkit, Sonniss and BBC (their terms do not allow passing on raw files, per the brief; not re-read).

**Gap:** Wikimedia answered 429 (too many requests), so only two of nine Work With Sounds files were downloaded. Their licences are verified; the best period options for truck, anvil and locomotive are still to be heard. It is a museum archive of working machines, so one source would give a consistent feel.

**Synthesise:** End turn if the owner prefers `end-b`. It is two low sines (62 then 52 Hz, pitch falling over 60 ms, 0.42 s apart), a faint D-minor-ish bell and two noise taps, low-passed at 3.5 kHz, made in one ffmpeg command. Ticks can be made the same way.

### 3.3 Audition set [measured]

14 files, 216 kB, mono MP3 80 kbps, peak near -3 dBFS, trimmed and faded, with `manifest.json`. Integrated loudness still runs from -14.7 LUFS (rail) to -27.8 (march), because peak levelling is not loudness levelling. Final files must be levelled by loudness. Ten of them re-encoded: 92 kB Opus 48, 142 kB AAC 64, 131 kB MP3 64. **Ship effects as MP3 64:** every browser decodes it and the saving from Opus is 40 kB.

## 4. Sound rules

### 4.1 Twelve rules

1. **One action, one sound.** A group order is one Redux action, so ten armies make one sound. Two triggers of the same sound within 120 ms join into one.
2. **Cooldowns.** 150 ms for ticks, 1.2 s for recruit and build, 4 s for aircraft, train, truck and marching. During a cooldown, play the plain order tick instead: still feedback, no repeated whistle. (Unreal calls this *Retrigger Time*, [docs](https://dev.epicgames.com/documentation/unreal-engine/sound-concurrency-reference-guide).)
3. **Voice limits.** At most four effects at once: one tick, two action sounds, one event. A higher-ranked sound replaces a lower one; equals are dropped, never queued. Late sounds feel broken.
4. **Fade, never cut.** 6 ms in, 60 ms out, 60 ms when replaced (Unreal's *Voice Steal Release Time*). Change every volume with a short ramp, not a jump, so nothing clicks.
5. **Frequency rule:** the more often a sound plays, the shorter, softer and duller it is. Ticks are under 0.5 s; only End turn and special moves last 2 s. Sound designers rate sounds for nuisance, and repetition tires listeners ([A Sound Effect](https://www.asoundeffect.com/?p=123022), read as a search summary).
6. **Vary a little.** Pitch between 0.97 and 1.03 and volume by up to 1 dB each time; two or three takes for the order tick. [Audiokinetic](https://www.audiokinetic.com/en/approaching-ui-audio-ui-design-perspective-2) recommends variations or slight pitch changes (search summary).
7. **Levels:** section 4.3.
8. **Duck the music** 8 dB for End turn and the battle report only: 60 ms down, about 1.5 s back. Ducking on every tick would pump.
9. **Hot-seat secrecy.** With two or more human players at one device, special move sounds reveal the order to the other player. Use the plain tick for all orders. The computer's orders are always silent.
10. **Never the only signal.** Everything heard is also seen ([Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-sounds-alone/)). With no speech and nothing carried by sound alone, captions add nothing.
11. **Always a way to silence it.** One visible mute, plus separate sliders ([Xbox 105](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/105); [WCAG 1.4.2](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html) requires a control for anything automatic over 3 s).
12. **Hidden tab, no click, failed file: silence.** Create or resume the audio context inside a click ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)). Drop, never queue, effects requested before it runs. Decode files ahead so the first sound is not late.

Reduced motion is not a request for quiet, so it does not mute.

Cooldown, limit and gain numbers are judgement to be tuned by ear in the mix lab. Lab estimate, ten rail orders at once: **without limits ten voices and about +5 dB over full scale (clipping); with the rules one voice, -15 dB**. Ten mixed actions in three seconds: +5 dB without, -1 dB with, and the output gets a limiter for the remainder.

### 4.2 Event to sound map

Gains are before the sliders. "No" rows are deliberate.

| Player action (Redux) | Sound | Rank | Cooldown | Voices | Gain |
|---|---|---|---|---|---|
| End turn (`endTurn`, `timeRanOut`) | End turn, 2 s, ducks music | 5 | 2 s | 1 | -6 dB |
| 10 s left (`clockWarned(10)`) | Two soft ticks | 5 | once a turn | 1 | -10 |
| Report opens with battles (phase becomes `resolution`) | Distant guns, once, whatever the number of battles | 4 | once | 1 | -10 |
| Victory or defeat (phase becomes `game-over`) | No effect; let the music carry it (later: a short cue) | | | | |
| Reinforce or invade on foot (`orderFromMuster`, march) | Marching, 2 s | 3 | 4 s | 1 | -6 |
| ... any unit by rail | Whistle and rails | 3 | 4 s | 1 | -12 |
| ... any unit by truck (motor) | Diesel | 3 | 4 s | 1 | -10 |
| ... by sea | Tick (no sea sound asked for) | 1 | | | -14 |
| Mixed modes in one order | The rarest: rail, then truck, then march | 3 | | 1 | |
| `planAirMission` (given), or support flights in a muster | Aircraft | 3 | 4 s | 1 | -9 |
| `queueBuildOrder` | Anvil | 2 | 1.2 s | 1 | -10 |
| `changeRecruitQuantity` up, from 0 | Drum | 2 | 1.2 s | 1 | -10 |
| ... further clicks up | Tick | 1 | 150 ms | 1 | -14 |
| `toggleSackOrder`, `chooseOrderKind` that plans an order | Tick | 1 | 150 ms | 1 | -14 |
| Cancel, remove, recruit down, stand down | Softer tick, -4 dB | 1 | 150 ms | 1 | -18 |
| Order refused (action changed no order, and `feedback` is set) | Soft double tick | 1 | 300 ms | 1 | -16 |
| Start campaign, next turn, `beginPlanning` | No (music starts here) | | | | |
| Hover, scroll, pan, zoom, select, open or close a pane, tabs, menus, info notices, computer orders | **No:** far too frequent, or not the player's action | | | | |

### 4.3 Levels

- Audiokinetic gives -18 LUFS (±2) and -1 dBTP for mobile and portable games ([article](https://audiokinetic.com/loudness-processing-best-practices-series-chapter1-loudness-measurement-part2); Sony's ASWG-R001 gives -18 portable and -24 home, seen only in secondary sources). Aim for -18 LUFS overall with -1 dBTP: music at its default (-13 dB) lands near -31, so effects sit well above it and the total is gentle.
- Level each effect by loudness to about -20 LUFS (short sounds by peak, -6 dBTP), then apply the table's gain. A limiter (`DynamicsCompressorNode`: threshold -3 dB, ratio 20, attack 3 ms, release 150 ms) sits last.

## 5. How it fits the code

Found in `src/main/state`: actions are in `gameSlice.ts` (names above), `timeout.ts` (`timeRanOut`) and `timerSlice.ts` (`clockWarned`). Reducers ignore illegal actions, so an action alone does not prove an order was made; the decision must compare state before and after. Move types come from `MoveOrder.legs` and `moveModes = march, motor, rail, sea` (`engine/network/reach.ts`). Nothing in the app uses `localStorage` today.

| File | What | Tests |
|---|---|---|
| `src/main/audio/cues.ts` | `cuesFor(before, after, action)` returns cue ids: pure | Unit, every row of the table |
| `src/main/audio/mixer.ts` | `decide(state, cues, nowMs)` returns plays, stops, ducks, next state: pure, clock passed in | Unit, cooldown, stealing, joining |
| `src/main/audio/levels.ts` | slider to gain, defaults, parse and repair saved settings: pure | Unit |
| `src/main/audio/playlist.ts` | next track, start offset, source choice from feature flags: pure | Unit |
| `src/main/audio/sounds.ts` | The table: files, rank, cooldown, gain | Type-checked |
| `src/main/state/audioSlice.ts` | Levels and mute | Unit |
| `src/main/audio/output.ts` | Thin Web Audio and `<audio>` wrapper | `v8 ignore`, as `TerrainLayer.tsx` does for WebGL; covered by one Playwright story |
| `src/main/state/audioMiddleware.ts` | Listener beside `notificationMiddleware.ts`; passes state before and after to `cuesFor` | Unit with a fake output |

The engine stays untouched: sounds read state and never write it. Variation uses `Math.random` in the wrapper only, outside `engine/`. Load the wrapper with a dynamic `import()` on the first click, since the first chunk is over budget already (see `bandwidth.md`). Period sounds belong to the scenario, so list the files in the scenario's asset sources like the relief images, not in the engine.

## 6. Volume model

- Three sliders 0 to 100 in steps of 5: **Master**, **Music**, **Effects**. Each is independent. Heard level = curve(Master) × curve(channel) × the sound's gain × ducking.
- Curve: amplitude = (value / 100)². Half way is -12 dB, 25 is -24 dB, 0 is silence. A straight line crowds all the change into the bottom of the slider [judgement].
- **Mute** is a separate switch that keeps the sliders. Also one quick mute button in the header, with `aria-pressed` and the label "Mute sound", and key **M** outside text fields.
- Defaults: Master 80, Music 60, Effects 80 (music -13 dB, effects -8 dB in all). Reset button.
- Moving the Effects slider plays one tick on release.
- Music at 0, or Master at 0, or mute: **pause and stop downloading**, not just silence.
- Saved in `localStorage` (`spanish-diplomacy.audio.v1`), read with try/catch, repaired if malformed, never sent anywhere.
- First visit: no sound before a click. Starting a campaign begins effects, and music at 60 unless the browser asks to save data. The first time music starts, show one quiet notice: "Music is on. Turn it down or off in Settings." with a Mute button.
- The UX agent draws the panel. Anything visible in the header or Settings changes the Linux visual baselines, which the owner regenerates.

## 7. Not verified

- How anything sounds. Nobody has listened.
- Real iPhone: second `<audio>` element, silent switch, Ogg Opus through a gain node, first-tap delay. Playwright's WebKit is not iOS.
- Baked-fade files: the script change has not been tried, and the loop gap was not measured.
- Whether browsers keep 3 MB audio in cache between visits (expected with `immutable`; only first-visit behaviour was measured).
- Terms of Pixabay, Mixkit, Sonniss and BBC: taken from the brief.
- Sony's loudness paper and Audiokinetic's articles: search summaries only.
