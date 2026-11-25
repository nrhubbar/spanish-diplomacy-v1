import { type JSX, useId } from "react";
import { type Channel, channels, levelStep } from "../state/soundLevels";
import { useAppDispatch, useAppSelector } from "../hooks";
import { previewSound, selectSoundLevels, setLevel, setMuted } from "../state/audioSlice";

const channelNames: Readonly<Record<Channel, string>> = { effects: "Effects", master: "Master", music: "Music" };

/** Master, Music and Effects: a slider, its level and a mute each, independent of the others. */
export function SoundControls(): JSX.Element {
  return (
    <div className="sound-controls">
      {channels.map((channel) => <SoundRow channel={channel} key={channel} />)}
    </div>
  );
}

function SoundRow({ channel }: { readonly channel: Channel }): JSX.Element {
  const dispatch = useAppDispatch();
  const { level, muted } = useAppSelector(selectSoundLevels)[channel];
  const id = useId();
  const name = channelNames[channel];
  // Letting go of a slider plays one quiet tick at the new level; Music is heard as it is.
  const preview = (): void => { if (channel !== "music") dispatch(previewSound()); };
  return (
    <div className="sound-row">
      <label htmlFor={id}>{name}</label>
      <input
        aria-valuetext={`${String(level)}%${muted ? ", muted" : ""}`}
        id={id}
        max={100}
        min={0}
        onChange={(event) => { dispatch(setLevel({ channel, level: Number(event.target.value) })); }}
        onKeyUp={preview}
        onPointerUp={preview}
        step={levelStep}
        type="range"
        value={level}
      />
      <output htmlFor={id}>{`${String(level)}%`}</output>
      <button
        aria-label={`${muted ? "Unmute" : "Mute"} ${name.toLowerCase()}`}
        className="secondary-button"
        onClick={() => { dispatch(setMuted({ channel, muted: !muted })); }}
        type="button"
      >
        {muted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}
