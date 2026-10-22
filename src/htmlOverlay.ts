import Phaser from "phaser";
import { GAME_WIDTH } from "./ui";

// HTML laid over the game canvas (forms get native typing, paste and the
// phone keyboard). These place an element over a rectangle given in game
// coordinates, and keep it there when the window resizes.

export interface GameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function placeOverGame(game: Phaser.Game, element: HTMLElement, rect: GameRect): void {
  const canvas = game.canvas.getBoundingClientRect();
  const container = element.parentElement!.getBoundingClientRect();
  const scale = canvas.width / GAME_WIDTH;
  Object.assign(element.style, {
    left: `${canvas.left - container.left + rect.x * scale}px`,
    top: `${canvas.top - container.top + rect.y * scale}px`,
    width: `${rect.width * scale}px`,
    height: `${rect.height * scale}px`,
  });
  // Text scales with the canvas, but never so small it's hard to read.
  element.style.setProperty("--scale", String(Math.max(scale, 0.75)));
}

// Shows the element over rect for as long as the scene runs.
export function showOverGame(scene: Phaser.Scene, element: HTMLElement, rect: GameRect): void {
  const place = () => placeOverGame(scene.game, element, rect);
  window.addEventListener("resize", place);
  scene.scale.on(Phaser.Scale.Events.RESIZE, place);
  element.hidden = false;
  place();
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    element.hidden = true;
    window.removeEventListener("resize", place);
    scene.scale.off(Phaser.Scale.Events.RESIZE, place);
  });
}
