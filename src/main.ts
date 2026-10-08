import Phaser from "phaser";
import { audio } from "./audio/audio";
import { NES } from "./palette";
import { AboutScene } from "./scenes/AboutScene";
import { BootScene } from "./scenes/BootScene";
import { BossScene } from "./scenes/BossScene";
import { CutsceneScene } from "./scenes/CutsceneScene";
import { GenerateScene } from "./scenes/GenerateScene";
import { LevelScene } from "./scenes/LevelScene";
import { PaperDetailScene } from "./scenes/PaperDetailScene";
import { PaperSelectScene } from "./scenes/PaperSelectScene";
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
    physics: { default: "arcade" },
    // Sound comes from our own chiptune synth (src/audio), not Phaser.
    audio: { noAudio: true },
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
      SettingsScene,
      AboutScene,
    ],
  });
  // Lets the browser console inspect the running game during development.
  if (import.meta.env.DEV) Object.assign(window, { game });
});
