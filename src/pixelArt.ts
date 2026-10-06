import Phaser from "phaser";
import { NES } from "./palette";

// Sprites are drawn as text grids: each character is one pixel, "." is
// transparent. This keeps the art in code, with no image files to load.

const COLORS: Record<string, number> = {
  K: NES.black,
  W: NES.white,
  R: NES.red,
  S: NES.salmon,
  Y: NES.yellow,
  G: NES.green,
  L: NES.lime,
  B: NES.blue,
  N: NES.navy,
  P: NES.purple,
  O: NES.brown,
  T: NES.tan,
  A: NES.gray,
};

const SPRITES: Record<string, string[]> = {
  runner: [
    "...KKKK.",
    "..KTTTTK",
    "..KTKTKK",
    "..KTTTTK",
    "...KBBK.",
    "..KBBBBK",
    ".KTBBBBT",
    "..KBBBBK",
    "..KNNNNK",
    "..KN..NK",
    "..KK..KK",
  ],
  heart: [
    ".RR.RR.",
    "RSRRRRR",
    "RRRRRRR",
    ".RRRRR.",
    "..RRR..",
    "...R...",
  ],
  emptyHeart: [
    ".AA.AA.",
    "A..A..A",
    "A.....A",
    ".A...A.",
    "..A.A..",
    "...A...",
  ],
  candle: [
    "..K..",
    "..K..",
    "KKKKK",
    "KRRRK",
    "KRSRK",
    "KRRRK",
    "KRRRK",
    "KRRRK",
    "KRRRK",
    "KKKKK",
    "..K..",
  ],
  flag: [
    "KYYYYY",
    "KYYYY.",
    "KYYY..",
    "KYYYY.",
    "KYYYYY",
    "K.....",
    "K.....",
    "K.....",
    "K.....",
    "K.....",
    "K.....",
    "K.....",
  ],
  cloud: [
    "...WWW....",
    ".WWWWWWW..",
    "WWWWWWWWWW",
    ".WWWWWWWW.",
  ],
  boss: [
    "..K..........K..",
    ".KPK........KPK.",
    ".KPPK......KPPK.",
    "..KPPKKKKKKPPK..",
    "..KPPPPPPPPPPK..",
    ".KPPPPPPPPPPPPK.",
    ".KPPWWPPPPWWPPK.",
    ".KPPWKPPPPWKPPK.",
    ".KPPPPPPPPPPPPK.",
    ".KPPPKKKKKKPPPK.",
    ".KPPKWKWKWKKPPK.",
    "..KPPPPPPPPPPK..",
    "...KPPPPPPPPK...",
    "..KPPKPPPPKPPK..",
    "..KKK.KKKK.KKK..",
  ],
  professor: [
    "..KKKKKK..",
    ".KAAAAAAK.",
    "KAWWWWWWAK",
    "KWTTTTTTWK",
    "KTKKTTKKTK",
    "KTKWTTKWTK",
    "KTTTTTTTTK",
    ".KTTKKTTK.",
    "..KTTTTK..",
    ".KWWWWWWK.",
    "KWWWNNWWWK",
    "KWWWNNWWWK",
  ],
};

export const PIXEL = 4;

export function createTextures(scene: Phaser.Scene): void {
  for (const [key, rows] of Object.entries(SPRITES)) {
    const graphics = scene.add.graphics();
    rows.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const color = COLORS[char];
        if (color === undefined) return;
        graphics.fillStyle(color, 1);
        graphics.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
      });
    });
    graphics.generateTexture(key, rows[0].length * PIXEL, rows.length * PIXEL);
    graphics.destroy();
  }
}
