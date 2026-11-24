import trackList from "../../../assets/audio/music/tracks.json";
import type { MusicTrack } from "./musicPlayer";
import { chooseSource, type MusicSource, type MusicSupport } from "./playlist";
import type { EffectFile } from "./sounds";

// `no-inline` keeps the smallest effects as files: audio is fetched when wanted, never in a script.
const effectFiles = import.meta.glob<string>("/assets/audio/effects/*.mp3", { eager: true, import: "default", query: "?url&no-inline" });
const musicFiles = import.meta.glob<string>("/assets/audio/music/*.{m4a,ogg}", { eager: true, import: "default", query: "?url&no-inline" });

export function effectUrl(file: EffectFile): string | undefined {
  return effectFiles[`/assets/audio/effects/${file}.mp3`];
}

function sourcesOf(id: string): readonly MusicSource[] {
  const base = `/assets/audio/music/${id}`;
  const ogg = musicFiles[`${base}.ogg`];
  const m4a = musicFiles[`${base}.m4a`];
  return [
    ...(ogg === undefined ? [] : [{ type: "audio/ogg" as const, url: ogg }]),
    ...(m4a === undefined ? [] : [{ type: "audio/mp4" as const, url: m4a }])
  ];
}

/** The playlist, with the file of each track that this browser plays. */
export function musicTracks(support: MusicSupport): readonly MusicTrack[] {
  return trackList.map((track) => ({ ...track, source: chooseSource(support, sourcesOf(track.id)) }));
}
