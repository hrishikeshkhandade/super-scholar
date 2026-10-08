import Phaser from "phaser";
import { audio } from "../audio/audio";
import { NES } from "../palette";
import { loadSettings, saveSettings } from "../save";
import { GAME_HEIGHT, GAME_WIDTH, Menu, panel, textStyle } from "../ui";

// Shown on top of a paused level or boss fight. Esc or P resumes.

const onOff = (value: boolean) => (value ? "ON" : "OFF");

export class PauseScene extends Phaser.Scene {
  private from = "";

  constructor() {
    super("Pause");
  }

  create(data: { from: string }): void {
    this.from = data.from;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, NES.black, 0.7).setOrigin(0, 0);
    panel(this, 220, 90, 360, 280);
    this.add.text(GAME_WIDTH / 2, 130, "PAUSED", textStyle(32, NES.yellow)).setOrigin(0.5);

    const settings = loadSettings();
    let confirmingQuit = false;
    const menu = new Menu(this, 280, 180, [
      { label: "RESUME", onSelect: () => this.resume() },
      {
        label: `MUSIC: ${onOff(settings.music)}`,
        onSelect: () => {
          settings.music = !settings.music;
          saveSettings(settings);
          audio.applySettings(settings);
          menu.setLabel(1, `MUSIC: ${onOff(settings.music)}`);
        },
      },
      {
        label: `SOUND: ${onOff(settings.sfx)}`,
        onSelect: () => {
          settings.sfx = !settings.sfx;
          saveSettings(settings);
          audio.applySettings(settings);
          menu.setLabel(2, `SOUND: ${onOff(settings.sfx)}`);
        },
      },
      {
        label: "QUIT TO TITLE",
        onSelect: () => {
          // Quitting loses the level in progress, so ask once more.
          if (!confirmingQuit) {
            confirmingQuit = true;
            menu.setLabel(3, "SURE? SELECT AGAIN");
            return;
          }
          this.scene.stop(this.from);
          this.scene.start("Title");
        },
      },
    ]);
    this.add
      .text(GAME_WIDTH / 2, 350, "ESC / P: RESUME", textStyle(8, NES.lightGray))
      .setOrigin(0.5);

    // Listen from the next frame, so the Esc that opened this menu doesn't
    // immediately close it.
    this.time.delayedCall(0, () => {
      this.input.keyboard?.on("keydown-ESC", () => this.resume());
      this.input.keyboard?.on("keydown-P", () => this.resume());
    });
  }

  private resume(): void {
    this.scene.resume(this.from);
    this.scene.stop();
  }
}

// Lets a gameplay scene be paused with Esc or P, and pauses it on its own
// when the game window loses focus. canPause says when pausing makes sense
// (not during a question or after the level ended).
export function enablePause(scene: Phaser.Scene, canPause: () => boolean): void {
  const pause = () => {
    if (!scene.scene.isActive() || !canPause()) return;
    scene.scene.pause();
    scene.scene.launch("Pause", { from: scene.scene.key });
    scene.scene.bringToTop("Pause");
  };
  scene.input.keyboard?.on("keydown-ESC", pause);
  scene.input.keyboard?.on("keydown-P", pause);
  scene.game.events.on(Phaser.Core.Events.BLUR, pause);

  // Keys released while paused never reached this scene, so forget them;
  // otherwise the player would keep running after resuming.
  scene.events.on(Phaser.Scenes.Events.RESUME, () => scene.input.keyboard?.resetKeys());
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.game.events.off(Phaser.Core.Events.BLUR, pause);
    scene.events.off(Phaser.Scenes.Events.RESUME);
  });
}
