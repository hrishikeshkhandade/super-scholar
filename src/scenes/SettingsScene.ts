import Phaser from "phaser";
import { audio } from "../audio/audio";
import { NES } from "../palette";
import { DIFFICULTIES } from "../difficulty";
import { MUSIC_STYLES, TEXT_SPEEDS, VOLUME_LEVELS, clearProgress, loadSettings, saveSettings, type Settings } from "../save";
import { GAME_WIDTH, Menu, textStyle, volumeLabel } from "../ui";
import { drawMenuBackdrop } from "./backdrop";

const STYLE_LABELS = { upbeat: "UPBEAT", tradingFloor: "TRADING FLOOR", study: "STUDY" } as const;

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super("Settings");
  }

  create(): void {
    drawMenuBackdrop(this);
    this.add.text(GAME_WIDTH / 2, 50, "SETTINGS", textStyle(24, NES.yellow)).setOrigin(0.5);
    audio.playMusic("title");

    const settings = loadSettings();
    const status = this.add.text(GAME_WIDTH / 2, 400, "", textStyle(16, NES.lime)).setOrigin(0.5);
    let confirmingReset = false;

    const labels = (s: Settings) => [
      `TEXT SPEED: ${s.textSpeed.toUpperCase()}`,
      `MUSIC: ${volumeLabel(s.musicVolume)}`,
      `MUSIC STYLE: ${STYLE_LABELS[s.musicStyle]}`,
      `SOUND EFFECTS: ${volumeLabel(s.sfxVolume)}`,
      `DIFFICULTY: ${s.difficulty.toUpperCase()}`,
    ];
    const update = (change: Partial<Settings>, message: string) => {
      Object.assign(settings, change);
      saveSettings(settings);
      audio.applySettings(settings);
      labels(settings).forEach((label, i) => menu.setLabel(i, label));
      status.setText(message);
    };
    const next = <T>(list: T[], current: T) => list[(list.indexOf(current) + 1) % list.length];
    const [speedLabel, musicLabel, styleLabel, sfxLabel, difficultyLabel] = labels(settings);

    const menu = new Menu(this, 150, 110, [
      { label: speedLabel, onSelect: () => update({ textSpeed: next(TEXT_SPEEDS, settings.textSpeed) }, "Saved") },
      {
        label: musicLabel,
        onSelect: () => update({ musicVolume: next(VOLUME_LEVELS, settings.musicVolume) }, "Saved"),
      },
      {
        label: styleLabel,
        onSelect: () =>
          update(
            { musicStyle: next(MUSIC_STYLES, settings.musicStyle) },
            settings.musicVolume > 0 ? "Saved - previewing now" : "Saved - turn music up to hear it",
          ),
      },
      {
        label: sfxLabel,
        onSelect: () => {
          update({ sfxVolume: next(VOLUME_LEVELS, settings.sfxVolume) }, "Saved");
          audio.playSfx("coin"); // a quick blip at the new volume
        },
      },
      {
        label: difficultyLabel,
        onSelect: () => {
          const difficulty = next(DIFFICULTIES, settings.difficulty);
          update({ difficulty }, difficulty === "hard" ? "Saved - 2 hearts, faster enemies" : "Saved");
        },
      },
      {
        label: "RESET PROGRESS",
        onSelect: () => {
          if (!confirmingReset) {
            confirmingReset = true;
            menu.setLabel(5, "SURE? SELECT AGAIN");
            status.setText("");
            return;
          }
          clearProgress();
          confirmingReset = false;
          menu.setLabel(5, "RESET PROGRESS");
          status.setText("Progress erased");
        },
      },
      { label: "BACK", onSelect: () => this.scene.start("Title") },
    ]);
  }
}
