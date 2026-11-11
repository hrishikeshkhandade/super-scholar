"""Records the professor's voice for the tutorial (src/tutorial.ts).

The voice is Kokoro's "bm_lewis", an open model (Apache 2.0) that runs on
this computer, so the game ships plain MP3s and needs no voice service.
Only lines whose words changed are recorded again; public/tutorial/lines.json
remembers what each recording says.

Setup, once (the model files are about 350 MB, kept outside the project):
  uv venv --python 3.12 ~/kokoro && uv pip install --python ~/kokoro/bin/python kokoro-onnx soundfile lameenc
  Download kokoro-v1.0.onnx and voices-v1.0.bin from
  https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

Run from the project folder:
  ~/kokoro/bin/python scripts/recordTutorial.py <folder with the model files> [--all]
"""

import json
import subprocess
import sys
from pathlib import Path

import lameenc
import numpy
from kokoro_onnx import Kokoro

VOICE = "bm_lewis"
SPEED = 0.95
BITRATE_KBPS = 48
OUT = Path("public/tutorial")


def tutorial_lines():
    """The lines from src/tutorial.ts, as [{"id", "text", "spoken"}]."""
    program = (
        "import('./src/tutorial.ts').then(t => console.log(JSON.stringify("
        "t.voiceLines().map(line => ({ ...line, spoken: t.spokenText(line.text) })))))"
    )
    return json.loads(subprocess.check_output(["node", "-e", program], text=True))


def to_mp3(samples, rate):
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE_KBPS)
    encoder.set_in_sample_rate(rate)
    encoder.set_channels(1)
    encoder.set_quality(2)
    pcm = (numpy.clip(samples, -1, 1) * 32767).astype(numpy.int16).tobytes()
    return encoder.encode(pcm) + encoder.flush()


def main():
    model_dir = Path(sys.argv[1])
    record_all = "--all" in sys.argv
    kokoro = Kokoro(str(model_dir / "kokoro-v1.0.onnx"), str(model_dir / "voices-v1.0.bin"))
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "lines.json"
    recorded = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    lines = tutorial_lines()
    for line in lines:
        file = OUT / f"{line['id']}.mp3"
        if not record_all and recorded.get(line["id"]) == line["text"] and file.exists():
            continue
        samples, rate = kokoro.create(line["spoken"], voice=VOICE, speed=SPEED, lang="en-gb")
        file.write_bytes(to_mp3(samples, rate))
        recorded[line["id"]] = line["text"]
        print(f"{line['id']}: {len(samples) / rate:.1f}s")

    # Forget lines that were removed from the tour, and their recordings.
    current = {line["id"] for line in lines}
    for old in set(recorded) - current:
        (OUT / f"{old}.mp3").unlink(missing_ok=True)
        del recorded[old]
    manifest_path.write_text(json.dumps(dict(sorted(recorded.items())), indent=2) + "\n")


if __name__ == "__main__":
    main()
