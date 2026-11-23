#!/usr/bin/env bash
# Cleans up the student's narration recordings for the video, without trimming
# them, so phrase times measured on the originals still line up:
#   1. removes low rumble, and quiets the room's background hum (about 300-600 Hz)
#      in the pauses with a gate: between phrases it drops about 30 dB, while the
#      voice itself is untouched. Stronger denoisers (anlmdn, afwtdn, RNNoise)
#      were tried and blurred words: scored by transcribing each version, the
#      gate kept 96-100% of the original's words, the others 82-94%.
#   2. in "part 2", removes a Mac notification chime at 18.3 s (two tones, 696 Hz
#      and 1048 Hz, with overtones), only while it rings: wide notches for its loud
#      first 0.8 s, a treble cut over its 0.2 s strike, a smooth 5 dB dip there,
#      then narrow notches over its fading tail, which rings under "Then you play"
#      until about 20.3 s (measured: the tones hold their pitch as they fade),
#   3. raises the whole file by one fixed amount to -16 LUFS (the usual level for
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

# The chime filters, each switched on only while the chime rings.
RINGING="enable='between(t,18.25,19.05)'"
FADING="enable='between(t,19.05,20.4)'"
STRIKE="enable='between(t,18.27,18.47)'"
notch() { echo "bandreject=f=$1:width_type=h:width=$2:$RINGING"; }
tail_notch() { echo "bandreject=f=$1:width_type=h:width=40:$FADING"; }
CHIME="$(notch 700 140),$(notch 700 140),$(notch 700 140)"
CHIME+=",$(notch 1048 140),$(notch 1048 140),$(notch 1048 140)"
CHIME+=",$(notch 1395 100),$(notch 1395 100),$(notch 2092 100),$(notch 2092 100)"
CHIME+=",lowpass=f=1200:$STRIKE,lowpass=f=1200:$STRIKE,lowpass=f=1200:$STRIKE"
CHIME+=",$(tail_notch 700),$(tail_notch 700),$(tail_notch 700),$(tail_notch 1045),$(tail_notch 1045),$(tail_notch 1045)"
CHIME+=",volume='1-0.45*min(1\,max(0\,min((t-18.24)/0.04\,(18.50-t)/0.04)))':eval=frame"

# Recording name -> name used in the video.
names=("Intro:1-intro" "part 2:2-level" "part 3:3-boss" "part 4:4-review" "part 5:5-built" "part 6:6-ending")
for pair in "${names[@]}"; do
  from="${pair%%:*}"
  to="${pair##*:}"
  filters="$CLEAN"
  if [ "$from" = "part 2" ]; then filters="$CHIME,$filters"; fi

  # Measure the cleaned recording's loudness, then raise it by one fixed amount.
  loudness=$(ffmpeg -hide_banner -i "$source_dir/$from.aifc" -af "$filters,ebur128" -f null - </dev/null 2>&1 |
    awk '/^ +I:/ { value = $2 } END { print value }')
  gain=$(echo "$TARGET_LUFS - ($loudness)" | bc -l)
  ffmpeg -v error -y -i "$source_dir/$from.aifc" \
    -af "$filters,volume=${gain}dB,alimiter=limit=0.84:level=false,aresample=48000" \
    -ac 2 -c:a aac -b:a 192k "$out_dir/$to.m4a" </dev/null
  printf "%s.m4a (raised %.1f dB)\n" "$to" "$gain"
done
