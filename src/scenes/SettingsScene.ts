import Phaser from "phaser";
import { audio } from "../audio/audio";
import { NES } from "../palette";
import { MUSIC_STYLES, TEXT_SPEEDS, clearProgress, loadSettings, saveSettings, type Settings } from "../save";
import { GAME_WIDTH, Menu, textStyle } from "../ui";

const STYLE_LABELS = { upbeat: "UPBEAT", tradingFloor: "TRADING FLOOR" } as const;
const onOff = (value: boolean) => (value ? "ON" : "OFF");

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super("Settings");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    this.add.text(GAME_WIDTH / 2, 50, "SETTINGS", textStyle(24, NES.yellow)).setOrigin(0.5);
    audio.playMusic("title");

    const settings = loadSettings();
    const status = this.add.text(GAME_WIDTH / 2, 400, "", textStyle(16, NES.lime)).setOrigin(0.5);
    let confirmingReset = false;

    const labels = (s: Settings) => [
      `TEXT SPEED: ${s.textSpeed.toUpperCase()}`,
      `MUSIC: ${onOff(s.music)}`,
      `MUSIC STYLE: ${STYLE_LABELS[s.musicStyle]}`,
      `SOUND EFFECTS: ${onOff(s.sfx)}`,
    ];
    const update = (change: Partial<Settings>, message: string) => {
      Object.assign(settings, change);
      saveSettings(settings);
      audio.applySettings(settings);
      labels(settings).forEach((label, i) => menu.setLabel(i, label));
      status.setText(message);
    };
    const next = <T>(list: T[], current: T) => list[(list.indexOf(current) + 1) % list.length];
    const [speedLabel, musicLabel, styleLabel, sfxLabel] = labels(settings);

    const menu = new Menu(this, 150, 110, [
      { label: speedLabel, onSelect: () => update({ textSpeed: next(TEXT_SPEEDS, settings.textSpeed) }, "Saved") },
      { label: musicLabel, onSelect: () => update({ music: !settings.music }, "Saved") },
      {
        label: styleLabel,
        onSelect: () =>
          update(
            { musicStyle: next(MUSIC_STYLES, settings.musicStyle) },
            settings.music ? "Saved - previewing now" : "Saved - turn music on to hear it",
          ),
      },
      { label: sfxLabel, onSelect: () => update({ sfx: !settings.sfx }, "Saved") },
      {
        label: "RESET PROGRESS",
        onSelect: () => {
          if (!confirmingReset) {
            confirmingReset = true;
            menu.setLabel(4, "SURE? SELECT AGAIN");
            status.setText("");
            return;
          }
          clearProgress();
          confirmingReset = false;
          menu.setLabel(4, "RESET PROGRESS");
          status.setText("Progress erased");
        },
      },
      { label: "BACK", onSelect: () => this.scene.start("Title") },
    ]);
  }
}
