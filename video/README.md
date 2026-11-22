# Super Scholar final video

The course video for Super Scholar, made with [Remotion](https://www.remotion.dev) (videos written as React code). It uses the game's own font and NES colors. The outline and talking points are in `../VIDEO.md`.

## Commands

Run these inside this `video/` folder.

```bash
npm install                                     # once
npm run data                                    # refresh the project's numbers (features, commits, tests)
scripts/prepareNarration.sh "<recordings folder>" # clean up the narration recordings into public/narration/
npm run dev                                     # open Remotion Studio to preview and scrub
npx remotion render FinalVideo out/final.mp4    # render the video
npm run lint                                    # lint and type-check
```

## Layout

- `src/FinalVideo.tsx`: the whole video, scene by scene, with scene lengths.
- `src/scenes/`: the opening (`Intro`), chapter cards (`SectionCard`), recorded gameplay (`Walkthrough`), "How I built it" (`PlanScroll`, `FeedbackStory`, `TestRun`, `ProjectStats`), and the closing card (`Ending`).
- `src/walkthroughs.ts`: which seconds of each recording become shots, at what speed, with which caption.
- `src/narration.ts`: where each phrase of the narration plays, cut at the pauses in the recordings.
- `src/projectData.json`: real numbers from the project, written by `npm run data` (`scripts/projectData.mjs`).
- `src/components/`: caption bar, game screen frame, panels, ground strip, and pixel clouds.
- `public/`: images and clips the video uses. Recorded OBS clips go in `public/clips/` and the cleaned narration in `public/narration/`; both stay out of git, so a fresh clone needs the recordings copied back in before it can render.
