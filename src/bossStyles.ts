// Each world's boss fights in its own style, in a fixed order so every paper
// builds up the same way. Papers with more worlds than styles start over.

export type BossStyle = "charger" | "jumper" | "thrower";

export const BOSS_STYLES: BossStyle[] = ["charger", "jumper", "thrower"];

export const BOSS_STYLE_NAMES: Record<BossStyle, string> = {
  charger: "THE CHARGER",
  jumper: "THE JUMPER",
  thrower: "THE THROWER",
};

export function bossStyleFor(worldIndex: number): BossStyle {
  return BOSS_STYLES[worldIndex % BOSS_STYLES.length];
}
