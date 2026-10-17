import Phaser from "phaser";
import { audio } from "./audio/audio";
import { NES } from "./palette";
import { AboutScene, CreditsScene } from "./scenes/AboutScene";
import { BootScene } from "./scenes/BootScene";
import { BossScene } from "./scenes/BossScene";
import { CutsceneScene } from "./scenes/CutsceneScene";
import { GenerateScene } from "./scenes/GenerateScene";
import { LevelScene } from "./scenes/LevelScene";
import { LevelSelectScene } from "./scenes/LevelSelectScene";
import { NotebookScene } from "./scenes/NotebookScene";
import { PaperDetailScene } from "./scenes/PaperDetailScene";
import { PaperSelectScene } from "./scenes/PaperSelectScene";
import { PauseScene } from "./scenes/PauseScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { TitleScene } from "./scenes/TitleScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./ui";

async function waitForFont(): Promise<void> {
  // Text drawn before the pixel font loads would use a fallback font, so wait
  // briefly for it. If it never loads (offline), start anyway.
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([document.fonts.load('16px "Press Start 2P"'), timeout]);
}

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
      LevelScene,
      BossScene,
      PauseScene,
      SettingsScene,
      AboutScene,
      CreditsScene,
      NotebookScene,
      LevelSelectScene,
    ],
  });
  // Lets the browser console inspect the running game during development.
  if (import.meta.env.DEV) Object.assign(window, { game });
});
