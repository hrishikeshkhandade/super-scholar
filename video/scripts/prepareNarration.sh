#!/usr/bin/env bash
# Cleans up the student's narration recordings for the video, without trimming
# them, so phrase times measured on the originals still line up:
#   1. removes low rumble, and quiets the room's background hum (about 300-600 Hz)
#      in the pauses with a gate: between phrases it drops about 30 dB, while the
#      voice itself is untouched. Stronger denoisers (anlmdn, afwtdn, RNNoise)
#      were tried and blurred words: scored by transcribing each version, the
#      gate kept 96-100% of the original's words, the others 82-94%.
#   2. raises the whole file by one fixed amount to -16 LUFS (the usual level for
#      online video), with a limiter on peaks. A fixed raise, unlike a dynamic
#      one, doesn't lift the hum in the pauses.
# Usage: scripts/prepareNarration.sh "<folder with the recordings>"
set -euo pipefail

source_dir="${1:?Pass the folder holding Intro.aifc and part 2-6.aifc}"
out_dir="$(dirname "$0")/../public/narration"
mkdir -p "$out_dir"

TARGET_LUFS=-16
# The gate works on the recordings' own level (they all sit near -40 LUFS):
# below about -44 dBFS it eases the sound down by up to 30 dB.
CLEAN="highpass=f=80,agate=threshold=0.006:ratio=6:range=0.03:attack=5:release=150:knee=2"

# Recording name -> name used in the video.
names=("Intro:1-intro" "part 2:2-level" "part 3:3-boss" "part 4:4-review" "part 5:5-built" "part 6:6-ending")
for pair in "${names[@]}"; do
  from="${pair%%:*}"
  to="${pair##*:}"
  filters="$CLEAN"
  # Seconds left out of the loudness measurement: part 2 has a Mac notification
  # chime at 18.2-20.4 s (that sentence isn't used in the video), which would
  # otherwise make the file measure louder than the voice and come out too quiet.
  measured="$filters"
  if [ "$from" = "part 2" ]; then measured="$filters,aselect='not(between(t\,18.2\,20.4))'"; fi

  # Measure the cleaned recording's loudness, then raise it by one fixed amount.
  loudness=$(ffmpeg -hide_banner -i "$source_dir/$from.aifc" -af "$measured,ebur128" -f null - </dev/null 2>&1 |
    awk '/^ +I:/ { value = $2 } END { print value }')
  gain=$(echo "$TARGET_LUFS - ($loudness)" | bc -l)
  ffmpeg -v error -y -i "$source_dir/$from.aifc" \
    -af "$filters,volume=${gain}dB,alimiter=limit=0.84:level=false,aresample=48000" \
    -ac 2 -c:a aac -b:a 192k "$out_dir/$to.m4a" </dev/null
  printf "%s.m4a (raised %.1f dB)\n" "$to" "$gain"
done
