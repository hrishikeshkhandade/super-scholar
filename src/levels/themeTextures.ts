import Phaser from "phaser";
import { seededRandom } from "../generator/questions";
import { drawSprite, spriteRows } from "../pixelArt";
import { THEMES, type Theme } from "./themes";

// Draws each theme's background layers and ground tiles once, at startup.
// Texture names: far-<theme>, hills-<theme>, ground-top-<theme>, ground-<theme>.

const FAR_WIDTH = 384;
const FAR_HEIGHT = 200;

export const farKey = (theme: Theme) => `far-${theme.name}`;
export const hillsKey = (theme: Theme) => `hills-${theme.name}`;
export const groundTopKey = (theme: Theme) => `ground-top-${theme.name}`;
export const groundKey = (theme: Theme) => `ground-${theme.name}`;

function drawCity(g: Phaser.GameObjects.Graphics, theme: Theme, random: () => number): void {
  let x = 0;
  while (x < FAR_WIDTH) {
    const w = Math.min(32 + Math.floor(random() * 4) * 8, FAR_WIDTH - x);
    const h = 60 + Math.floor(random() * 16) * 8;
    g.fillStyle(theme.farColors[random() > 0.5 ? 0 : 1], 1).fillRect(x, FAR_HEIGHT - h, w - 4, h);
    g.fillStyle(theme.farAccent, 1);
    for (let wy = FAR_HEIGHT - h + 8; wy < FAR_HEIGHT - 8; wy += 16) {
      for (let wx = x + 6; wx < x + w - 10; wx += 10) {
        if (random() > 0.45) g.fillRect(wx, wy, 4, 6);
      }
    }
    x += w;
  }
}

// Peaks are also drawn one tile-width over on each side, so the texture
// repeats without a visible seam.
function drawMountains(g: Phaser.GameObjects.Graphics, theme: Theme, random: () => number): void {
  const peaks = Array.from({ length: 5 }, (_, i) => ({
    x: i * (FAR_WIDTH / 5) + random() * 30,
    height: 90 + random() * 90,
    color: theme.farColors[i % 2],
  }));
  for (const shift of [-FAR_WIDTH, 0, FAR_WIDTH]) {
    for (const peak of peaks) {
      const cx = peak.x + shift;
      const top = FAR_HEIGHT - peak.height;
      const half = peak.height * 0.9;
      g.fillStyle(peak.color, 1).fillTriangle(cx - half, FAR_HEIGHT, cx, top, cx + half, FAR_HEIGHT);
      // A snowcap (or bright tip) on each peak.
      g.fillStyle(theme.farAccent, 1).fillTriangle(cx - 16, top + 18, cx, top, cx + 16, top + 18);
    }
  }
}

function drawMesas(g: Phaser.GameObjects.Graphics, theme: Theme, random: () => number): void {
  let x = 0;
  while (FAR_WIDTH - x >= 40) {
    const w = Math.min(60 + Math.floor(random() * 5) * 12, FAR_WIDTH - x);
    const h = 50 + Math.floor(random() * 10) * 10;
    const top = FAR_HEIGHT - h;
    g.fillStyle(theme.farColors[random() > 0.5 ? 0 : 1], 1);
    const point = (px: number, py: number) => new Phaser.Math.Vector2(px, py);
    g.fillPoints([point(x, FAR_HEIGHT), point(x + 10, top), point(x + w - 10, top), point(x + w, FAR_HEIGHT)], true);
    g.fillStyle(theme.farAccent, 1).fillRect(x + 10, top + 10, w - 20, 4);
    x += w + Math.floor(random() * 3) * 16;
  }
}

function drawHills(g: Phaser.GameObjects.Graphics, theme: Theme): void {
  g.fillStyle(theme.hills[0], 1);
  g.fillCircle(64, 120, 80).fillCircle(240, 130, 96).fillCircle(384, 120, 80);
  g.fillStyle(theme.hills[1], 1);
  g.fillRect(56, 60, 8, 8).fillRect(232, 52, 8, 8);
}

export function createThemeTextures(scene: Phaser.Scene): void {
  THEMES.forEach((theme, index) => {
    const random = seededRandom(index + 11);
    const far = scene.add.graphics();
    if (theme.far === "city") drawCity(far, theme, random);
    else if (theme.far === "mountains") drawMountains(far, theme, random);
    else drawMesas(far, theme, random);
    far.generateTexture(farKey(theme), FAR_WIDTH, FAR_HEIGHT);
    far.destroy();

    const hills = scene.add.graphics();
    drawHills(hills, theme);
    hills.generateTexture(hillsKey(theme), FAR_WIDTH, 128);
    hills.destroy();

    // The ground sprites with the theme's grass, dirt, and speck colors.
    const recolor = { L: theme.grass[0], G: theme.grass[1], O: theme.dirt, T: theme.speck };
    drawSprite(scene, groundTopKey(theme), spriteRows("ground-top"), recolor);
    drawSprite(scene, groundKey(theme), spriteRows("ground"), recolor);
  });
}
