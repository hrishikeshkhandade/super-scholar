import Phaser from "phaser";
import { audio } from "../audio/audio";
import { NES, css } from "../palette";
import { VOLUME_LEVELS, loadSettings, saveSettings } from "../save";
import { addTapButton, isTouchDevice } from "../touchControls";
import { GAME_HEIGHT, GAME_WIDTH, Menu, panel, textStyle, volumeLabel } from "../ui";

// Shown on top of a paused level or boss fight. Esc or P resumes.

const nextVolume = (volume: number) => VOLUME_LEVELS[(VOLUME_LEVELS.indexOf(volume) + 1) % VOLUME_LEVELS.length];

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
    const menu = new Menu(this, 280, 180, [
      { label: "RESUME", onSelect: () => this.resume() },
      {
        label: `MUSIC: ${volumeLabel(settings.musicVolume)}`,
        onSelect: () => {
          settings.musicVolume = nextVolume(settings.musicVolume);
          saveSettings(settings);
          audio.applySettings(settings);
          menu.setLabel(1, `MUSIC: ${volumeLabel(settings.musicVolume)}`);
        },
      },
      {
        label: `SOUND: ${volumeLabel(settings.sfxVolume)}`,
        onSelect: () => {
          settings.sfxVolume = nextVolume(settings.sfxVolume);
          saveSettings(settings);
          audio.applySettings(settings);
          audio.playSfx("coin"); // a quick blip at the new volume
          menu.setLabel(2, `SOUND: ${volumeLabel(settings.sfxVolume)}`);
        },
      },
      {
        // One click: only the level in progress is lost (CONTINUE resumes
        // from the last cleared one), and a second "SURE?" step annoyed the
        // student more than it protected anyone.
        label: "QUIT TO TITLE",
        onSelect: () => {
          this.scene.stop(this.from);
          this.scene.start("Title");
        },
      },
    ]);
    this.add
      .text(GAME_WIDTH / 2, 350, isTouchDevice() ? "TAP RESUME TO PLAY ON" : "ESC / P: RESUME", textStyle(8, NES.lightGray))
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

// Lets a gameplay scene be paused with Esc or P or its pause button, and
// pauses it on its own when the game window loses focus. canPause says when
// pausing makes sense (not during a question or after the level ended).
// buttonX is a free spot in the scene's top bar.
export function enablePause(scene: Phaser.Scene, canPause: () => boolean, buttonX: number): void {
  const pause = () => {
    if (!scene.scene.isActive() || !canPause()) return;
    scene.scene.pause();
    scene.scene.launch("Pause", { from: scene.scene.key });
    scene.scene.bringToTop("Pause");
  };
  scene.input.keyboard?.on("keydown-ESC", pause);
  scene.input.keyboard?.on("keydown-P", pause);
  scene.game.events.on(Phaser.Core.Events.BLUR, pause);
  // A pause button in the top bar, so new players can find the pause menu
  // (and QUIT TO TITLE) without knowing the keys. Phones get a bigger "II".
  if (isTouchDevice()) addTapButton(scene, buttonX, 26, "II", pause);
  else addPauseButton(scene, buttonX, pause);

  // Keys released while paused never reached this scene, so forget them;
  // otherwise the player would keep running after resuming.
  scene.events.on(Phaser.Scenes.Events.RESUME, () => scene.input.keyboard?.resetKeys());
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.game.events.off(Phaser.Core.Events.BLUR, pause);
    scene.events.off(Phaser.Scenes.Events.RESUME);
  });
}

function addPauseButton(scene: Phaser.Scene, x: number, onClick: () => void): void {
  const button = scene.add
    .text(x, 24, "PAUSE\n(P)", { ...textStyle(8, NES.white), align: "center" })
    .setOrigin(0.5)
    .setPadding(10, 8, 10, 8)
    .setBackgroundColor(css(NES.black))
    .setScrollFactor(0)
    .setDepth(30)
    .setInteractive({ useHandCursor: true })
    .on("pointerdown", onClick);
  button.on("pointerover", () => button.setColor(css(NES.yellow)));
  button.on("pointerout", () => button.setColor(css(NES.white)));
}
