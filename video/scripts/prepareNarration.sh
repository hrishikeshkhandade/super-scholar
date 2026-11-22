#!/usr/bin/env bash
# Cleans up the student's narration recordings for the video: removes low rumble,
# lightly reduces background hiss, and evens out loudness to -16 LUFS (the usual
# level for online video), without trimming, so phrase times measured on the
# originals still line up. Usage: scripts/prepareNarration.sh "<folder with the recordings>"
set -euo pipefail

source_dir="${1:?Pass the folder holding Intro.aifc and part 2-6.aifc}"
out_dir="$(dirname "$0")/../public/narration"
mkdir -p "$out_dir"

# Recording name -> name used in the video.
names=("Intro:1-intro" "part 2:2-level" "part 3:3-boss" "part 4:4-review" "part 5:5-built" "part 6:6-ending")
for pair in "${names[@]}"; do
  from="${pair%%:*}"
  to="${pair##*:}"
  ffmpeg -v error -y -i "$source_dir/$from.aifc" \
    -af "highpass=f=80,afftdn=nf=-30,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000" \
    -ac 2 -c:a aac -b:a 192k "$out_dir/$to.m4a"
  echo "$to.m4a"
done
