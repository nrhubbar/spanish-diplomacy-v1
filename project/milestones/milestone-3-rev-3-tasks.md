# Milestone 3 Rev 3: tasks

> Internal. The source of truth for this revision. Ideation and the owner's words: `milestone-3-rev-3-ideation/` (`owner-notes.md`, `owner-answers-round-1.md`, `-2`, `-3`). Where they disagree, the later round wins, and this file wins over all of them.

The owner's bar: production quality, no hacks, high test coverage. No sims. Keep the whole revision under 2M tokens.

## Worker rules

- Integration branch `m3r3`, worktree `../spanish-diplomacy-v1-m3r3`. Each stream has branch `m3r3-<stream>` in the sibling worktree `../spanish-diplomacy-v1-m3r3-<stream>` (symlink `node_modules` from the main checkout; stage by path).
- Commit on your own branch in small, coherent commits. Never push, never bare `git stash`, never `git add -A` at the root. End commit messages with the `Co-Authored-By` line you were given.
- No sims, no AI-against-AI batches. Do not run `npm run e2e:baselines`, and do not change `e2e/baselines/` or `e2e/production.spec.ts`. List the baselines your change breaks in your hand-back.
- Rules and numbers live in the scenario data and the Zod schemas; run `npm run spec:build` after a schema change. The engine stays pure and deterministic. Never branch on a unit, building or faction id.
- Player-facing text is plain English: no ids, rule codes or design notes. New order kinds ship with an AI path and tests.
- No workaround comments, no dead flags, no `any`, no skipped tests, no lowered thresholds. Coverage gate 93/92/92/92, and every new branch has a test. If a design does not fit the code cleanly, refactor the code or hand the question back; do not bolt it on.
- Update or add Playwright flows for what you change. Run only your own specs while working (`E2E_PORT` of your own), and the full `npm run lint && npm run typecheck && npm run test:unit` before hand-back.
- Stay inside your owned files; if you must touch another stream's, say so in the hand-back.
- Token cap per stream below. At 80% of the cap, commit, and hand back what is done and what is left. Do not start a subagent.
- Hand-back, under 500 words: commits, what changed, tests and coverage, what is not done or not verified, baselines broken, decisions you took, anything that collided. Also leave `project/milestones/m3r3-progress/<stream>.md` (under 80 lines) for the next streams.

## Streams

| Phase | Stream | Cap | Owns |
|---|---|---|---|
| 1 | `prune-d6` | 230k | `engine/battle*`, `combat/`, d6 parts of schema, loader and tests; build-time stripping |
| 1 | `ux-pane` | 200k | map pane, Invade, header, casualty accumulator and chip |
| 1 | `ux-cards` | 160k | air markers, Recruit fold-outs, battle ledger and Who fought |
| 1 | `audio` | 230k | `src/main/audio/`, sound settings, credits, audio build and infra, map-detail loading, size report |
| 2 | `upkeep` | 200k | upkeep, shortage, fractions, Disband, their UI and AI |
| 2 | `values` | 190k | scenario numbers, merged Factory, rail units, tank transport, combat data |
| 3 | `ai` | 130k | leader alarm, spending, bonus valuation, the South |
| 4 | final prune and integration | 90k | coordinator |

## Decisions

### D1 Upkeep, shortage, Disband (`upkeep`)
- `unitTypes[].upkeep` is an amount per resource per turn (schema allows any resource and fractions to thousandths; today only Manpower is used). Every unit on the map pays its full number at any strength. Units in training and generals pay nothing. No free allowance. Charged after income, once a turn.
- Manpower a turn: infantry 0.25, militia 1.5, colonial veterans 0.25, security forces 1, artillery 0.1, cavalry 0.3, tanks 0.15, trucks 0.1, anti-air 0.15, reconnaissance, fighters and bombers 0.05.
- Treasuries stay whole numbers. One carry per faction and resource, in thousandths, is shared by income, upkeep and Replenish (replacing Replenish's own), so nothing is lost or rounded twice.
- Projected next-turn amount = held − planned spending + expected income − upkeep of every unit that will be on the map (units finishing training this turn included). A recruit or Replenish order that leaves projected Manpower below zero is refused with a plain reason. While it is already below zero, all are refused.
- If the bill can't be paid, the stock goes to 0 and the shortfall leaves as men (1 Manpower = the resource's display unit of men), shared over the side's units in proportion to their men with deterministic rounding, at most 10% of full strength per unit per turn and never below half of full strength (`upkeep` rules block in the scenario holds these shares). What can't leave goes unpaid and is forgotten. Men who leave are not casualties. An outcome reports it to the owner.
- **Disband** is a unit order like move or Replenish, at any time, for ground units and aircraft, not generals. It resolves after combat and before income. The unit fights normally if attacked. Nothing comes back; not casualties. Private to its owner until it resolves. Two-step confirm in the UI as drawn in `images/r3b-6-upkeep-disband.webp`, but always available.
- Computer player: never recruits or Replenishes into a shortage; when projected Manpower is below zero it disbands the unit with the least fighting value per upkeep that it can spare until it is not. Tests for both.
- UI: the Upkeep ledger row with a per-type breakdown, net on the chip, the shortage warning (`images/r3b-6-*.webp`), upkeep on Recruit rows.

### D2 Units (`values`)
CSV in `owner-answers-round-1.md`, with these later changes: colonial veterans 1 Manpower; security forces 4 Funds, 1 Manpower, upkeep 1, establishment 1,000. **Militia keeps the table: 3 Funds, 3 Manpower, 2/5, 1 turn, no Funds pay** (the owner's round 3 note overrides the option). Establishments not named stay.
- Artillery bonus per 2 (attack only, max 3). Tanks gain `transport` carries 1. Code that treats every transport as a truck (`presentation/movement.ts` `truckCarries`, `ai/reach.ts` `isTransport`, `ai/orders/recruit.ts` `carriesOf`) must distinguish transports that can't fight from ones that can.
- Requirements: infantry, veterans, security, cavalry: Barracks. Artillery: Barracks and Factory. Tanks: Factory and Depot. Trucks, anti-air: Depot. Aircraft: Airfield. Militia: none.

### D3 Merged Factory (`values`)
- Industry and the old Factory building become one development track, Factory: city sub-territories only, one per city, levels 0 to 3, each level 6 Funds and 4 Manpower, 2 turns, +1.5 Funds a turn and +1 Recruit order a turn in its territory. A unit that needs a Factory needs level 1 or more anywhere in the territory, held by the recruiter.
- Starting Factories follow historical data with a source or a note on each, within these bounds: Barcelona and Bizkaia start at level 2, other sites at 1, and each side's opening income stays within 1 Fund of today (Republic 14, North 5, South 1; South with Andalucía clear 11). Candidate sites: A Coruña/Ferrol, Oviedo/Trubia, Gijón, Torrelavega, Bizkaia, Gipuzkoa (Eibar), Zaragoza, Madrid, Valladolid, Toledo, Barcelona, Valencia, Seville, Cádiz, Cartagena. Drop Alicante and Málaga unless a source argues otherwise. Not every territory has one. New ones can be built in any other city.
- No "pays for itself" text anywhere.

### D4 Buildings and links (`values`)
Funds / Manpower / turns: farms 3/0/2, mines 5/0/2, barracks 5/0/1, depot 6/0/1, fortifications 3/2/2, hospital 5/0/2, airfield 6/0/2, paved airfield 4/0/2, rail yard 6/0/2, rail repair 3/1/2, port 6/0/2, road upgrade 3/2/2, rail upgrade 5/3/3, new rail 10/6/5. Fortifications take 2 off the attacker's roll (from 1). Madrid and Barcelona start with fortifications.

### D5 Combat and movement data (`values`)
- Popular Resistance is removed from the data; barricades are 2. The `factionModifiers` mechanism stays for other eras, with an empty list.
- Raid table upper bounds 3, 7, 14, 20.
- Rail counts units, not armies: 2 per station level, and a rail yard adds 2. The per-level number is scenario data. Order checks, resolution, AI and text all count units; an army that doesn't fit is refused whole with the number left.
- Trucks use any road, never a mountain pass. Paved airfields keep flying in rain, mud and snow.

### D6 Computer player (`ai`)
Round 1 Q-R3-10a and 10b, with `research/economy.md` section 7 gaps 1 to 8: attack a side one step from winning as readily as guarding (alarm perStep 1.5, steps 3), accept worse odds, count a foothold that spoils a territory as a full success, alarm contested and third-party deciding ground, any two reachable together at two steps; at two steps or fewer, no Build reserve and prefer one-turn units; ignore units that can't fight in threat counts. Value units by what their roll bonuses are worth (guns, tanks, aircraft), so it builds mixed armies. The computer's South attacks Andalucía on turn 1 and doesn't spend the Manpower its army needs. Tests named in economy.md section 7.

### D7 UX (`ux-pane`, `ux-cards`)
Images: `milestone-3-rev-3-ideation/images/r3-1-*`, `r3b-*`; specs in `research/ux.md` and `research/ux-round-2.md`, with these answers: aircraft print attack-defence on the same card as ground units at all zooms, and the role (FTR, BOMB, RCN) replaces the short name only when zoomed in; zero stays 0 on cards; Recruit fold-outs; the battle ledger exactly as drawn (one ledger, plus is green for everyone, total, Outcome) and a closed Who fought fold-out with men and morale recorded by the engine; Invade scrolls everything, known die effects in the odds card, defenders on the same card, **order button at the bottom of the odds card**, pane grip, ticked units glow on the map (**a group only glows**, no count); casualty chip with skull and crossbones, short number, tap for the split. Casualties count battles, break-ups, surrenders, units disbanded by an impossible move, and cold; never Disband or hunger. Header wraps so nothing overflows at 1280 and 1024. Pane width rules in ux.md note 1.

### D8 Audio and bandwidth (`audio`)
`research/audio.md`, `research/bandwidth.md`, `research/audio-round-3.md`. Music: four files, Opus 64 (.ogg) with AAC 96 fallback, streamed, not preloaded; starts with the first campaign at a modest level with a notice and a mute. Effects: `order-a`, `recruit-a`, `build-a`, `air-a`, `rail-a`, `truck-a`, `march-a`, `battle-a`, `blocked-a`, and the owner's end-turn mix (2 s: church bell at 0 s volume 80, kettledrum strike at 0 s volume 80, snare roll at 0.1 s volume 20; the mixer also multiplied the kettledrum by 1.3 and faded the last 0.6 s). Strict limits (audio.md 4.1). Independent Master, Music and Effects, with mutes, kept per browser. Hot-seat secrecy rule. Credits screen. Detailed map image loads only on zoom or when idle on a fast connection. Sizes are reported, not enforced.

### D9 Pruning (`prune-d6`, then final)
`research/pruning.md`: remove the d6 path completely (code, schema, data, fixtures and tests re-pointed to the d20), rows 1 to 8, and strip notes and sources from the shipped scenario at build time. The final pass repeats knip and the key scan after the features land.
