"""Records the professor's voice for the tutorial (src/tutorial.ts).

The voice is "Liam" from ElevenLabs, recorded once here so the game ships
plain MP3s and never calls a voice service while someone plays. Only lines
whose words changed are recorded again; public/tutorial/lines.json remembers
what each recording says.

Setup, once: make a free ElevenLabs account and an API key (restricted to
Text to Speech), then save it in .env (git ignores it) without showing it:
  read -s "key?Paste ElevenLabs key: " && echo "ELEVENLABS_API_KEY=$key" >> .env

Run from the project folder (plain Python 3, nothing to install):
  python3 scripts/recordTutorial.py [--all]
"""

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

VOICE_ID = "TX3LPaxmHKxFdv7VOQHJ"  # Liam
MODEL = "eleven_multilingual_v2"
FORMAT = "mp3_44100_64"
OUT = Path("public/tutorial")


def tutorial_lines():
    """The lines from src/tutorial.ts, as [{"id", "text", "spoken"}]."""
    program = (
        "import('./src/tutorial.ts').then(t => console.log(JSON.stringify("
        "t.voiceLines().map(line => ({ ...line, spoken: t.spokenText(line.text) })))))"
    )
    return json.loads(subprocess.check_output(["node", "-e", program], text=True))


def api_key():
    env = Path(".env")
    lines = env.read_text().splitlines() if env.exists() else []
    for line in lines:
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("No ELEVENLABS_API_KEY in .env (see the setup at the top of this script).")


def record(text, key):
    request = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format={FORMAT}",
        data=json.dumps({"text": text, "model_id": MODEL}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request) as response:
        return response.read()


def main():
    record_all = "--all" in sys.argv
    key = api_key()
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "lines.json"
    recorded = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    lines = tutorial_lines()
    for line in lines:
        file = OUT / f"{line['id']}.mp3"
        if not record_all and recorded.get(line["id"]) == line["text"] and file.exists():
            continue
        file.write_bytes(record(line["spoken"], key))
        recorded[line["id"]] = line["text"]
        # Saved after every line, so a failure part way keeps what was recorded.
        manifest_path.write_text(json.dumps(dict(sorted(recorded.items())), indent=2) + "\n")
        print(f"{line['id']}: {file.stat().st_size // 1024} KB")

    # Forget lines that were removed from the tour, and their recordings.
    current = {line["id"] for line in lines}
    for old in set(recorded) - current:
        (OUT / f"{old}.mp3").unlink(missing_ok=True)
        del recorded[old]
    manifest_path.write_text(json.dumps(dict(sorted(recorded.items())), indent=2) + "\n")


if __name__ == "__main__":
    main()
