import Phaser from "phaser";
import { createTextures } from "../pixelArt";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    createTextures(this);
    this.scene.start("Title");
  }
}
