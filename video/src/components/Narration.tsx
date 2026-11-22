import { Audio } from "@remotion/media";
import { interpolate, Sequence, staticFile, useVideoConfig } from "remotion";

// One phrase of the student's narration: seconds `from` to `to` of a recording
// in public/narration/, starting `at` seconds into the scene it belongs to.
// Phrases are cut at the pauses in the recording, so each can land on the
// moment of gameplay it describes.
export type NarrationClip = {
  file: string;
  from: number;
  to: number;
  at: number;
};

// When a clip ends, in seconds from its scene's start.
export const clipEnd = (clip: NarrationClip): number =>
  clip.at + clip.to - clip.from;

// A few frames of fade at each end, so cutting at a pause never clicks.
const FADE_FRAMES = 3;

export const Narration: React.FC<{ clips: NarrationClip[] }> = ({ clips }) => {
  const { fps } = useVideoConfig();

  return (
    <>
      {clips.map((clip) => {
        const frames = Math.round((clip.to - clip.from) * fps);
        return (
          <Sequence
            key={`${clip.file}-${clip.from}`}
            name={`Narration ${clip.file} ${clip.from}s`}
            from={Math.round(clip.at * fps)}
            durationInFrames={frames}
            layout="none"
          >
            <Audio
              src={staticFile(`narration/${clip.file}.m4a`)}
              trimBefore={Math.round(clip.from * fps)}
              trimAfter={Math.round(clip.to * fps)}
              volume={(f) =>
                interpolate(
                  f,
                  [0, FADE_FRAMES, frames - FADE_FRAMES, frames],
                  [0, 1, 1, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                )
              }
            />
          </Sequence>
        );
      })}
    </>
  );
};
