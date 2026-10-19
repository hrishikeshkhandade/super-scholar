import { loadSettings, type Settings } from "../save";
import { SONGS, noteFrequency, steps, type SongName } from "./songs";

// Chiptune sound made live with the browser's Web Audio API, so there are no
// audio files. A pulse wave plays the melody and a triangle wave the bass,
// like the NES sound chip; drums are bursts of noise.

export type SfxName =
  | "move"
  | "select"
  | "text"
  | "jump"
  | "coin"
  | "stomp"
  | "bump"
  | "powerup"
  | "hurt"
  | "fall"
  | "clear"
  | "correct"
  | "wrong"
  | "gameover";

const LOOKAHEAD_S = 0.12;
const SCHEDULE_EVERY_MS = 25;
const MUSIC_VOLUME = 0.35;
const SFX_VOLUME = 0.5;

interface Voices {
  lead: string[];
  bass: string[];
  drums: string[];
}

class AudioEngine {
  private context?: AudioContext;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  private pulseWave?: PeriodicWave;
  private noise?: AudioBuffer;
  private settings: Settings = loadSettings();
  private songName?: SongName;
  private voices?: Voices;
  private stepSeconds = 0;
  private step = 0;
  private nextStepTime = 0;
  private timer?: ReturnType<typeof setInterval>;

  // Browsers only allow sound after the player presses a key or clicks, so
  // the audio context is created on that first interaction.
  unlockOnFirstInput(): void {
    const unlock = () => {
      this.ensureContext();
      void this.context?.resume();
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerdown", unlock);
    document.addEventListener("visibilitychange", () => {
      if (!this.context) return;
      if (document.hidden) void this.context.suspend();
      else void this.context.resume();
    });
  }

  applySettings(settings: Settings): void {
    const styleChanged = settings.musicStyle !== this.settings.musicStyle;
    this.settings = { ...settings };
    this.applyVolumes();
    if (settings.musicVolume === 0) this.stopMusic();
    else if (this.songName && (styleChanged || !this.timer)) this.startSong(this.songName);
  }

  // Switches to a scene's song. Calling it again with the same song keeps it
  // playing without restarting.
  playMusic(name: SongName): void {
    if (name === this.songName && this.timer) return;
    this.songName = name;
    if (this.settings.musicVolume > 0) this.startSong(name);
  }

  // 100% is the original loudness; lower levels scale it down.
  private applyVolumes(): void {
    if (this.musicGain) this.musicGain.gain.value = (MUSIC_VOLUME * this.settings.musicVolume) / 100;
    if (this.sfxGain) this.sfxGain.gain.value = (SFX_VOLUME * this.settings.sfxVolume) / 100;
  }

  playSfx(name: SfxName): void {
    if (this.settings.sfxVolume === 0 || !this.context || this.context.state !== "running") return;
    const t = this.context.currentTime;
    switch (name) {
      case "move":
        this.tone("square", 660, t, 0.04, 0.15);
        break;
      case "select":
        this.tone("square", 880, t, 0.06, 0.2);
        this.tone("square", 1320, t + 0.06, 0.08, 0.2);
        break;
      case "text":
        this.tone("square", 1200, t, 0.02, 0.05);
        break;
      case "jump":
        this.sweep("square", 300, 750, t, 0.15, 0.25);
        break;
      case "coin":
        this.tone("square", 988, t, 0.07, 0.25);
        this.tone("square", 1319, t + 0.07, 0.18, 0.25);
        break;
      case "stomp":
        this.sweep("square", 400, 80, t, 0.15, 0.35);
        this.noiseBurst(t, 0.08, 0.3, 1200);
        break;
      case "bump":
        this.sweep("triangle", 220, 110, t, 0.1, 0.5);
        break;
      case "powerup":
        ["C5", "E5", "G5", "C6", "E6"].forEach((note, i) =>
          this.tone("square", noteFrequency(note)!, t + i * 0.06, 0.07, 0.22),
        );
        break;
      case "hurt":
        this.sweep("sawtooth", 600, 120, t, 0.3, 0.25);
        break;
      case "fall":
        this.sweep("triangle", 800, 60, t, 0.6, 0.4);
        break;
      case "clear":
        ["G4", "C5", "E5", "G5", "E5", "G5", "C6"].forEach((note, i) =>
          this.tone("square", noteFrequency(note)!, t + i * 0.1, i === 6 ? 0.4 : 0.09, 0.25),
        );
        break;
      case "correct":
        ["C5", "E5", "G5"].forEach((note, i) => this.tone("square", noteFrequency(note)!, t + i * 0.07, 0.1, 0.25));
        break;
      case "wrong":
        this.tone("sawtooth", 180, t, 0.15, 0.25);
        this.tone("sawtooth", 140, t + 0.15, 0.3, 0.25);
        break;
      case "gameover":
        ["G4", "F4", "E4", "C4"].forEach((note, i) =>
          this.tone("triangle", noteFrequency(note)!, t + i * 0.2, 0.18, 0.5),
        );
        break;
    }
  }

  private ensureContext(): void {
    if (this.context) return;
    const context = new AudioContext();
    this.context = context;
    this.musicGain = context.createGain();
    this.musicGain.gain.value = MUSIC_VOLUME;
    this.musicGain.connect(context.destination);
    this.sfxGain = context.createGain();
    this.sfxGain.gain.value = SFX_VOLUME;
    this.sfxGain.connect(context.destination);

    // A 25% pulse wave: the thin, buzzy NES lead sound.
    const harmonics = 32;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);
    for (let n = 1; n < harmonics; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
    this.pulseWave = context.createPeriodicWave(real, imag);

    this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.applyVolumes();
    if (this.songName && this.settings.musicVolume > 0) this.startSong(this.songName);
  }

  private startSong(name: SongName): void {
    this.stopMusic();
    if (!this.context) return; // starts once the player unlocks audio
    const song = SONGS[this.settings.musicStyle][name];
    this.voices = { lead: steps(song.lead), bass: steps(song.bass), drums: steps(song.drums) };
    this.stepSeconds = 60 / song.bpm / 2;
    this.step = 0;
    this.nextStepTime = this.context.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), SCHEDULE_EVERY_MS);
  }

  private stopMusic(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  // Queues the notes due in the next fraction of a second. Scheduling ahead
  // keeps the rhythm steady even when the game is busy drawing a frame.
  private schedule(): void {
    const context = this.context;
    const voices = this.voices;
    if (!context || !voices || context.state !== "running") return;
    if (this.nextStepTime < context.currentTime - 0.2) this.nextStepTime = context.currentTime + 0.05;
    while (this.nextStepTime < context.currentTime + LOOKAHEAD_S) {
      const t = this.nextStepTime;
      const length = this.stepSeconds * 0.85;
      const lead = noteFrequency(voices.lead[this.step]);
      if (lead) this.pulse(lead, t, length, 0.18);
      const bass = noteFrequency(voices.bass[this.step]);
      if (bass) this.tone("triangle", bass, t, length, 0.45, this.musicGain);
      this.drum(voices.drums[this.step], t);
      this.step = (this.step + 1) % voices.lead.length;
      this.nextStepTime += this.stepSeconds;
    }
  }

  private envelope(start: number, length: number, volume: number, output: AudioNode): GainNode {
    const gain = this.context!.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    gain.connect(output);
    return gain;
  }

  private tone(
    type: OscillatorType,
    frequency: number,
    start: number,
    length: number,
    volume: number,
    output: AudioNode = this.sfxGain!,
  ): void {
    const oscillator = this.context!.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(this.envelope(start, length, volume, output));
    oscillator.start(start);
    oscillator.stop(start + length);
  }

  private pulse(frequency: number, start: number, length: number, volume: number): void {
    const oscillator = this.context!.createOscillator();
    oscillator.setPeriodicWave(this.pulseWave!);
    oscillator.frequency.value = frequency;
    oscillator.connect(this.envelope(start, length, volume, this.musicGain!));
    oscillator.start(start);
    oscillator.stop(start + length);
  }

  private sweep(type: OscillatorType, from: number, to: number, start: number, length: number, volume: number): void {
    const oscillator = this.context!.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + length);
    oscillator.connect(this.envelope(start, length, volume, this.sfxGain!));
    oscillator.start(start);
    oscillator.stop(start + length);
  }

  private noiseBurst(start: number, length: number, volume: number, cutoff: number, output: AudioNode = this.sfxGain!) {
    const source = this.context!.createBufferSource();
    source.buffer = this.noise!;
    const filter = this.context!.createBiquadFilter();
    filter.type = cutoff > 5000 ? "highpass" : "bandpass";
    filter.frequency.value = cutoff;
    source.connect(filter).connect(this.envelope(start, length, volume, output));
    source.start(start, Math.random() * 0.5, length);
  }

  private drum(hit: string | undefined, start: number): void {
    if (hit === "k") {
      const oscillator = this.context!.createOscillator();
      oscillator.frequency.setValueAtTime(150, start);
      oscillator.frequency.exponentialRampToValueAtTime(40, start + 0.12);
      oscillator.connect(this.envelope(start, 0.12, 0.6, this.musicGain!));
      oscillator.start(start);
      oscillator.stop(start + 0.12);
    } else if (hit === "s") {
      this.noiseBurst(start, 0.1, 0.3, 1800, this.musicGain);
    } else if (hit === "h") {
      this.noiseBurst(start, 0.04, 0.12, 7000, this.musicGain);
    }
  }
}

export const audio = new AudioEngine();
