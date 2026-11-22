import type { WalkthroughProps } from "./scenes/Walkthrough";

// The first recorded play-through (2026-11-21): an uploaded paper, "Language
// Models Need Sleep", from the title screen through level 1-1 to 1-2. Times
// are seconds into public/clips/dreaming-lab.mp4.
export const UPLOADED_PAPER_RUN: WalkthroughProps = {
  clip: "clips/dreaming-lab.mp4",
  shots: [
    { from: 0.5, to: 5.5, speed: 1, caption: "Pick a paper from the library, or upload any PDF." },
    { from: 6, to: 21, speed: 2, caption: "Prof. Quant explains the paper in plain words, then shows you how to play." },
    { from: 22, to: 34, speed: 1, caption: "Stomp bears to collect fun facts from the paper." },
    { from: 34, to: 49.2, speed: 1.5, caption: "Jump the gaps and reach the flag to clear the level." },
    // LEVEL CLEAR and FACTS FOUND flash by in under two seconds, so slow them down to read.
    { from: 49.2, to: 51, speed: 0.6, caption: "The lesson and every fact you found are saved to your Notebook." },
    { from: 51, to: 60, speed: 2, caption: "Then a short lesson teaches one idea from the paper." },
    { from: 60, to: 64.4, speed: 1, caption: "A practice question checks you got it. A right answer earns a life." },
    // Ends before the pause menu the recording stops on.
    { from: 64.5, to: 67.3, speed: 1, caption: "On to the next level." },
  ],
};
