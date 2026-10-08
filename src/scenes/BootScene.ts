import Phaser from "phaser";
import { createThemeTextures } from "../levels/themeTextures";
import { createTextures } from "../pixelArt";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    createTextures(this);
    createThemeTextures(this);
    this.scene.start("Title");
  }
}
