import Phaser from "phaser";
import { NES } from "../palette";
import { TEXT_SPEEDS, clearProgress, loadSettings, saveSettings } from "../save";
import { GAME_WIDTH, Menu, textStyle } from "../ui";

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super("Settings");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    this.add.text(GAME_WIDTH / 2, 60, "SETTINGS", textStyle(24, NES.yellow)).setOrigin(0.5);

    const settings = loadSettings();
    const status = this.add.text(GAME_WIDTH / 2, 380, "", textStyle(12, NES.lime)).setOrigin(0.5);
    let confirmingReset = false;

    const menu = new Menu(this, 200, 150, [
      {
        label: this.speedLabel(settings.textSpeed),
        onSelect: () => {
          const next = TEXT_SPEEDS[(TEXT_SPEEDS.indexOf(settings.textSpeed) + 1) % TEXT_SPEEDS.length];
          settings.textSpeed = next;
          saveSettings(settings);
          menu.setLabel(0, this.speedLabel(next));
          status.setText("Saved");
        },
      },
      {
        label: "RESET PROGRESS",
        onSelect: () => {
          if (!confirmingReset) {
            confirmingReset = true;
            menu.setLabel(1, "SURE? SELECT AGAIN");
            status.setText("");
            return;
          }
          clearProgress();
          confirmingReset = false;
          menu.setLabel(1, "RESET PROGRESS");
          status.setText("Progress erased");
        },
      },
      { label: "BACK", onSelect: () => this.scene.start("Title") },
    ]);
  }

  private speedLabel(speed: string): string {
    return `TEXT SPEED: ${speed.toUpperCase()}`;
  }
}
