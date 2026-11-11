import Phaser from "phaser";
import { audio } from "./audio/audio";
import { NES } from "./palette";
import { AboutScene, CreditsScene } from "./scenes/AboutScene";
import { BootScene } from "./scenes/BootScene";
import { BossScene } from "./scenes/BossScene";
import { AskScholarScene } from "./scenes/AskScholarScene";
import { CutsceneScene } from "./scenes/CutsceneScene";
import { LeaderboardScene } from "./scenes/LeaderboardScene";
import { FeedbackScene } from "./scenes/FeedbackScene";
import { GenerateScene } from "./scenes/GenerateScene";
import { LevelScene } from "./scenes/LevelScene";
import { LevelSelectScene } from "./scenes/LevelSelectScene";
import { NotebookScene } from "./scenes/NotebookScene";
import { PaperDetailScene } from "./scenes/PaperDetailScene";
import { PaperSelectScene } from "./scenes/PaperSelectScene";
import { PauseScene } from "./scenes/PauseScene";
import { QuizReviewScene } from "./scenes/QuizReviewScene";
import { ReviewResultsScene } from "./scenes/ReviewResultsScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { TitleScene } from "./scenes/TitleScene";
import { TutorialScene } from "./scenes/TutorialScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./ui";

async function waitForFont(): Promise<void> {
  // Text drawn before the pixel font loads would use a fallback font, so wait
  // briefly for it. If it never loads (offline), start anyway.
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([document.fonts.load('16px "Press Start 2P"'), timeout]);
}

const SCREEN_FADE_MS = 250;

audio.unlockOnFirstInput();

waitForFont().then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: NES.black,
    pixelArt: true,
    // Physics steps with each screen refresh instead of a fixed 60 per
    // second, so movement stays smooth on 120 Hz screens (like MacBooks).
    physics: { default: "arcade", arcade: { fixedStep: false } },
    // Sound comes from our own chiptune synth (src/audio), not Phaser.
    audio: { noAudio: true },
    // Up to three fingers at once on phones: move, jump, and one spare.
    input: { activePointers: 3 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [
      BootScene,
      TitleScene,
      PaperSelectScene,
      PaperDetailScene,
      GenerateScene,
      CutsceneScene,
      AskScholarScene,
      LeaderboardScene,
      LevelScene,
      BossScene,
      PauseScene,
      SettingsScene,
      AboutScene,
      CreditsScene,
      NotebookScene,
      LevelSelectScene,
      QuizReviewScene,
      ReviewResultsScene,
      FeedbackScene,
      // Last, so the tour draws on top of the real screens frozen behind it.
      TutorialScene,
    ],
  });
  // Every screen fades in from black instead of cutting. The pause menu is
  // left out: it draws over a running level, so fading it would black out
  // the level underneath.
  game.events.once(Phaser.Core.Events.READY, () => {
    for (const scene of game.scene.scenes) {
      if (scene.scene.key === "Pause") continue;
      scene.events.on(Phaser.Scenes.Events.CREATE, () => scene.cameras.main.fadeIn(SCREEN_FADE_MS, 0, 0, 0));
    }
  });
  // Lets the browser console inspect the running game during development.
  if (import.meta.env.DEV) Object.assign(window, { game });
});
