"""Renders each music track of the approved mix on its own, with the mix's joins built in.

Called by build-music.ts. It loads the mixer that made the mix (make_supermix.py, kept with the
original recordings outside the repository) and uses its own steps for each track: trim silence,
ride the level, normalise. Cutting the finished mix instead would leave two tracks in every join
and encode the music twice. The joins are the mix's "natural" ones: each recording's own decay and
intro do the blending, so a file only needs the mix's short edge fades.

    python -I render-tracks.py <music-dir> <cues.json> <out-dir>

Writes <out-dir>/<track>.wav (32-bit float) and <out-dir>/rendered.json.
"""
import importlib.util
import json
import sys
from pathlib import Path


def load_mixer(path: Path):
    spec = importlib.util.spec_from_file_location("make_supermix", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    music, cues_path, out = (Path(arg).resolve() for arg in sys.argv[1:4])
    out.mkdir(parents=True, exist_ok=True)
    mixer = load_mixer(music / "make_supermix.py")
    settings = mixer.parse_args([])
    cues = json.loads(cues_path.read_text())
    joins = {fade["from"]: fade for fade in cues["crossfades"]}
    joined_into = {fade["to"]: fade for fade in cues["crossfades"]}
    rendered = []
    for cue in cues["tracks"]:
        name = cue["track"]
        samples, _, _ = mixer.trim_digital_silence(mixer.decode(music / f"{name}.mp3"))
        levelled, _ = mixer.level_track(samples, settings, name)
        # The same edge fades the mix put on each side of a join.
        edge = int(settings.edge_fade * mixer.SR)
        lead = int(joined_into[name]["len"] * mixer.SR)
        tail = int(joins[name]["len"] * mixer.SR)
        _, fade_in = mixer.xfade_gains(lead, "natural", edge)
        fade_out, _ = mixer.xfade_gains(tail, "natural", edge)
        levelled[:lead] *= fade_in[:, None].astype(levelled.dtype)
        levelled[-tail:] *= fade_out[:, None].astype(levelled.dtype)
        mixer.write_float_wav(out / f"{name}.wav", levelled)
        rendered.append({
            "track": name,
            "title": cue["title"],
            "seconds": len(levelled) / mixer.SR,
            "overlapNext": joins[name]["len"],
        })
    (out / "rendered.json").write_text(json.dumps(rendered, indent=2))


if __name__ == "__main__":
    main()
