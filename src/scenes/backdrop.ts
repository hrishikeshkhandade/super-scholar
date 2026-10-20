import Phaser from "phaser";
import { TILE } from "../levels/parseLevel";
import { farKey, groundKey, groundTopKey, hillsKey } from "../levels/themeTextures";
import { THEMES } from "../levels/themes";
import { NES } from "../palette";
import { GAME_HEIGHT, GAME_WIDTH } from "../ui";

// The forest scene from the title screen, shared by every menu screen so
// the whole game has one look: sky bands, drifting clouds, mountains,
// hills, and two rows of ground.

const THEME = THEMES.find((theme) => theme.name === "forest") ?? THEMES[0];
export const GROUND_TOP = GAME_HEIGHT - 2 * TILE;
const SKY_BAND = 90;
const PANEL_INSET = 12;
const PANEL_BORDER = 4;
// The inside of the menu panel, for HTML laid over it (the feedback form).
export const PANEL_INNER = { x: PANEL_INSET + PANEL_BORDER, y: PANEL_INSET + PANEL_BORDER };

export function drawBackdrop(scene: Phaser.Scene): void {
  scene.cameras.main.setBackgroundColor(THEME.sky[2]);
  THEME.sky.slice(0, 2).forEach((color, i) => scene.add.rectangle(0, i * SKY_BAND, GAME_WIDTH, SKY_BAND, color).setOrigin(0, 0));
  for (let i = 0; i < 4; i++) {
    const cloud = scene.add.image(80 + i * 220, 40 + (i % 2) * 34, "cloud").setAlpha(THEME.cloudAlpha);
    scene.tweens.add({ targets: cloud, x: cloud.x + 40, duration: 7000 + i * 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }
  scene.add.tileSprite(0, GROUND_TOP - 200, GAME_WIDTH, 200, farKey(THEME)).setOrigin(0, 0).setAlpha(0.9);
  scene.add.tileSprite(0, GROUND_TOP - 120, GAME_WIDTH, 128, hillsKey(THEME)).setOrigin(0, 0);
  for (let x = 0; x < GAME_WIDTH; x += TILE) {
    scene.add.image(x + TILE / 2, GROUND_TOP + TILE / 2, groundTopKey(THEME));
    scene.add.image(x + TILE / 2, GROUND_TOP + TILE * 1.5, groundKey(THEME));
  }
}

// For menu screens full of text: the backdrop, then a framed, see-through
// dark panel (like the title's signboard) so everything stays readable.
export function drawMenuBackdrop(scene: Phaser.Scene): void {
  drawBackdrop(scene);
  scene.add
    .rectangle(PANEL_INSET, PANEL_INSET, GAME_WIDTH - PANEL_INSET * 2, GAME_HEIGHT - PANEL_INSET * 2, NES.black, 0.72)
    .setOrigin(0, 0)
    .setStrokeStyle(PANEL_BORDER, NES.white);
}
