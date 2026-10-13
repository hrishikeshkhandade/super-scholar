import Phaser from "phaser";
import { NES } from "./palette";
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from "./ui";

// On-screen buttons for phones and tablets: arrows under the left thumb,
// JUMP and DROP under the right. Each finger is tracked on its own, so the
// player can run and jump at the same time, and sliding a thumb from one
// arrow to the other switches direction without lifting it.

export type TouchButton = "left" | "right" | "jump" | "down";

// Phones and tablets have a coarse (finger) pointer; laptops with a mouse or
// trackpad don't, even if their screen happens to be touch-capable.
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

const BUTTON_ALPHA = 0.35;
const PRESSED_ALPHA = 0.7;
const DEPTH = 30;

interface ButtonSpec {
  name: TouchButton;
  x: number;
  y: number;
  radius: number;
  label: string;
}

const BUTTONS: ButtonSpec[] = [
  { name: "left", x: 64, y: GAME_HEIGHT - 64, radius: 44, label: "<" },
  { name: "right", x: 172, y: GAME_HEIGHT - 64, radius: 44, label: ">" },
  { name: "down", x: GAME_WIDTH - 180, y: GAME_HEIGHT - 44, radius: 32, label: "DROP" },
  { name: "jump", x: GAME_WIDTH - 72, y: GAME_HEIGHT - 80, radius: 52, label: "JUMP" },
];

export class TouchControls {
  // Which pointers (fingers) are holding each button.
  private readonly held = new Map<TouchButton, Set<number>>();
  private readonly circles = new Map<TouchButton, Phaser.GameObjects.Arc>();
  private readonly objects: (Phaser.GameObjects.Arc | Phaser.GameObjects.Text)[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly onPress: (button: TouchButton) => void,
  ) {
    for (const spec of BUTTONS) {
      this.held.set(spec.name, new Set());
      const circle = scene.add
        .circle(spec.x, spec.y, spec.radius, NES.black, BUTTON_ALPHA)
        .setStrokeStyle(4, NES.white, 0.8)
        .setScrollFactor(0)
        .setDepth(DEPTH)
        .setInteractive();
      const label = scene.add
        .text(spec.x, spec.y, spec.label, textStyle(spec.label.length > 1 ? 8 : 24, NES.white))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH + 1);
      this.circles.set(spec.name, circle);
      this.objects.push(circle, label);

      circle.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.press(spec.name, pointer.id));
      // A thumb sliding onto a button (without lifting) presses it too.
      circle.on("pointerover", (pointer: Phaser.Input.Pointer) => pointer.isDown && this.press(spec.name, pointer.id));
      circle.on("pointerout", (pointer: Phaser.Input.Pointer) => this.release(spec.name, pointer.id));
    }
    // A finger lifted anywhere lets go of whatever it was holding.
    const releaseAll = (pointer: Phaser.Input.Pointer) => {
      for (const name of this.held.keys()) this.release(name, pointer.id);
    };
    scene.input.on("pointerup", releaseAll);
    scene.input.on("pointerupoutside", releaseAll);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off("pointerup", releaseAll);
      scene.input.off("pointerupoutside", releaseAll);
    });
  }

  private visible = true;

  // Hidden while a question or menu is up, so the buttons never cover it.
  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.objects.forEach((object) => object.setVisible(visible));
    if (!visible) this.reset();
  }

  isDown(button: TouchButton): boolean {
    return this.held.get(button)!.size > 0;
  }

  // Lets go of everything, e.g. after the game was paused mid-press.
  reset(): void {
    for (const name of this.held.keys()) {
      this.held.get(name)!.clear();
      this.circles.get(name)!.setFillStyle(NES.black, BUTTON_ALPHA);
    }
  }

  private press(name: TouchButton, pointerId: number): void {
    const fingers = this.held.get(name)!;
    if (fingers.has(pointerId)) return;
    fingers.add(pointerId);
    this.circles.get(name)!.setFillStyle(NES.white, PRESSED_ALPHA);
    this.onPress(name);
  }

  private release(name: TouchButton, pointerId: number): void {
    const fingers = this.held.get(name)!;
    if (!fingers.delete(pointerId) || fingers.size > 0) return;
    this.circles.get(name)!.setFillStyle(NES.black, BUTTON_ALPHA);
  }
}

// A small tappable button for screens that otherwise need a key (pause,
// cancel, back). Returns the button so callers can hide it.
export function addTapButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onTap: () => void,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, label, textStyle(16, NES.white))
    .setOrigin(0.5)
    .setPadding(12, 10, 12, 10)
    .setBackgroundColor("#000000")
    .setScrollFactor(0)
    .setDepth(DEPTH)
    .setInteractive({ useHandCursor: true })
    .on("pointerdown", onTap);
}
