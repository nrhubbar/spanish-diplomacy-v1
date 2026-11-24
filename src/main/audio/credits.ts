/** Who made what players hear. Required by the licences; `assets/audio/ATTRIBUTION.md` has the sources in full. */
export interface CreditLink {
  readonly text: string;
  readonly url?: string;
}

export interface CreditSection {
  readonly lines: readonly (readonly CreditLink[])[];
  readonly title: string;
}

const ccBy4 = { text: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };
const ccBy3 = { text: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/" };

export const credits: readonly CreditSection[] = [
  {
    lines: [
      [
        { text: "'Shadows and Dust', 'Memories Of Stone', 'A Dragon's Lullaby' and 'Unraveling-' by Scott Buckley, released under " },
        ccBy4,
        { text: ". " },
        { text: "www.scottbuckley.com.au", url: "https://www.scottbuckley.com.au" }
      ],
      [{ text: "Changed from the originals: volume levelled, edited and given fades. Scott Buckley does not endorse this game." }]
    ],
    title: "Music"
  },
  {
    lines: [
      [
        { text: "'Steam Whistle'", url: "https://commons.wikimedia.org/wiki/File:WWS_SteamWhistle.ogg" },
        { text: " and " },
        { text: "'Typewriter'", url: "https://commons.wikimedia.org/wiki/File:WWS_Typewriter.ogg" },
        { text: " by Work With Sounds / Konrad Gutkowski, " },
        ccBy4,
        { text: "." }
      ],
      [{ text: "'WW2AirplaneFlyover'", url: "https://freesound.org/people/daveincamas/sounds/43807/" }, { text: " by daveincamas, " }, ccBy4, { text: "." }],
      [
        { text: "'Cannon artillery, distant gunshots'", url: "https://freesound.org/people/Aegersum/sounds/345844/" },
        { text: " by Aegersum, " },
        ccBy3,
        { text: "." }
      ],
      [{ text: "Trimmed, mixed to mono, faded and levelled." }],
      [{ text: "Also, with thanks (public domain, CC0): aUREa, martian, michorvath, kyles, Stek59, Kalomina, Versilian Studios, Kenney." }]
    ],
    title: "Sound effects"
  }
];
