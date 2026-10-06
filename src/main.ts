import Phaser from "phaser";
import { NES } from "./palette";
import { AboutScene } from "./scenes/AboutScene";
import { BootScene } from "./scenes/BootScene";
import { BossScene } from "./scenes/BossScene";
import { CutsceneScene } from "./scenes/CutsceneScene";
import { PaperSelectScene } from "./scenes/PaperSelectScene";
import { RunnerScene } from "./scenes/RunnerScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { TitleScene } from "./scenes/TitleScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./ui";

async function waitForFont(): Promise<void> {
  // Text drawn before the pixel font loads would use a fallback font, so wait
  // briefly for it. If it never loads (offline), start anyway.
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([document.fonts.load('16px "Press Start 2P"'), timeout]);
}

waitForFont().then(() => {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: NES.black,
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [
      BootScene,
      TitleScene,
      PaperSelectScene,
      CutsceneScene,
      RunnerScene,
      BossScene,
      SettingsScene,
      AboutScene,
    ],
  });
});
