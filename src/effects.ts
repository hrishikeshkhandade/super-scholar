import Phaser from "phaser";

// Little bursts of square pixels for stomps, coins, and boss hits. Each burst
// is a short-lived particle emitter that removes itself, so nothing piles up.

const PIXEL_TEXTURE = "particle-pixel";

// A plain white square, tinted per burst. Made once at startup.
export function createParticleTexture(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics().fillStyle(0xffffff, 1).fillRect(0, 0, 4, 4);
  graphics.generateTexture(PIXEL_TEXTURE, 4, 4);
  graphics.destroy();
}

export interface BurstOptions {
  count?: number;
  speed?: number;
  lifespanMs?: number;
  gravity?: number;
  scrollFactor?: number;
}

export function burst(scene: Phaser.Scene, x: number, y: number, colors: number[], options: BurstOptions = {}): void {
  const { count = 12, speed = 160, lifespanMs = 450, gravity = 500, scrollFactor = 1 } = options;
  const emitter = scene.add.particles(0, 0, PIXEL_TEXTURE, {
    speed: { min: speed * 0.4, max: speed },
    angle: { min: 200, max: 340 }, // mostly upward, like a pop
    lifespan: lifespanMs,
    gravityY: gravity,
    // Chunky 8px squares shrinking to 4px, matching the game's 4px art pixels.
    scale: { start: 2, end: 1 },
    alpha: { start: 1, end: 0.3 },
    tint: colors,
    emitting: false,
  });
  emitter.setDepth(12).setScrollFactor(scrollFactor);
  emitter.explode(count, x, y);
  scene.time.delayedCall(lifespanMs + 50, () => emitter.destroy());
}
