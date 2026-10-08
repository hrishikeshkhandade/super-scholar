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
  C: NES.sky,
};

const SPRITES: Record<string, string[]> = {
  "player-idle": [
    "NNNNNNNN",
    "..NNNNY.",
    ".KTTTTKY",
    ".KTKTKK.",
    ".KTTTTK.",
    "..KBBK..",
    ".KBBBBK.",
    "TKBBBBKT",
    ".KNNNNK.",
    ".KK..KK.",
  ],
  "player-walk1": [
    "NNNNNNNN",
    "..NNNNY.",
    ".KTTTTKY",
    ".KTKTKK.",
    ".KTTTTK.",
    "..KBBK..",
    ".KBBBBK.",
    "TKBBBBKT",
    ".KNNNNK.",
    "KK....KK",
  ],
  "player-walk2": [
    "NNNNNNNN",
    "..NNNNY.",
    ".KTTTTKY",
    ".KTKTKK.",
    ".KTTTTK.",
    "..KBBK..",
    ".KBBBBK.",
    "TKBBBBKT",
    "..KNNK..",
    "..KKKK..",
  ],
  "player-jump": [
    "NNNNNNNN",
    "..NNNNY.",
    ".KTTTTKY",
    ".KTKTKK.",
    ".KTTTTK.",
    "..KBBK..",
    "TKBBBBKT",
    ".KBBBBK.",
    ".KNNNNK.",
    "KK....KK",
  ],
  "bear-walk1": [
    ".KK....KK.",
    "KOOKKKKOOK",
    "KOOOOOOOOK",
    "KOKOOOOKOK",
    "KOOOTTOOOK",
    "KOOTKKTOOK",
    ".KOOOOOOK.",
    ".KK.KK.KK.",
  ],
  "bear-walk2": [
    ".KK....KK.",
    "KOOKKKKOOK",
    "KOOOOOOOOK",
    "KOKOOOOKOK",
    "KOOOTTOOOK",
    "KOOTKKTOOK",
    ".KOOOOOOK.",
    "..KK..KK..",
  ],
  "bear-flat": [
    "KKKKKKKKKK",
    "KOKOOOOKOK",
    "KOOOOOOOOK",
    "KKKKKKKKKK",
  ],
  coin1: [
    ".YYYY.",
    "YYWWYY",
    "YWYYYY",
    "YYWWYY",
    "YYYYWY",
    "YYWWYY",
    ".YYYY.",
  ],
  coin2: [
    "..YY..",
    ".YWYY.",
    ".YWYY.",
    ".YWYY.",
    ".YWYY.",
    ".YWYY.",
    "..YY..",
  ],
  coin3: [
    "..YY..",
    "..WY..",
    "..WY..",
    "..WY..",
    "..WY..",
    "..WY..",
    "..YY..",
  ],
  shield: [
    ".BBBBB.",
    "BWWWWWB",
    "BWBBBWB",
    "BWBWBWB",
    "BWBBBWB",
    ".BWWWB.",
    "..BWB..",
    "...B...",
  ],
  "ground-top": [
    "LLLLLLLL",
    "GLGLLGLG",
    "GGGGGGGG",
    "OOOOOOOO",
    "OOTOOOOO",
    "OOOOOTOO",
    "OTOOOOOO",
    "OOOOOOTO",
  ],
  ground: [
    "OOOOOOOO",
    "OOTOOOOO",
    "OOOOOTOO",
    "OTOOOOOO",
    "OOOOOOTO",
    "OOOTOOOO",
    "OOOOOOOO",
    "TOOOOTOO",
  ],
  brick: [
    "TTTOTTTT",
    "TTTOTTTT",
    "OOOOOOOO",
    "TTTTTTOT",
    "TTTTTTOT",
    "OOOOOOOO",
    "TTTOTTTT",
    "OOOOOOOO",
  ],
  "question-block": [
    "KKKKKKKK",
    "KYYKKYYK",
    "KYKYYKYK",
    "KYYYYKYK",
    "KYYYKYYK",
    "KYYYYYYK",
    "KYYYKYYK",
    "KKKKKKKK",
  ],
  "used-block": [
    "KKKKKKKK",
    "KOOOOOOK",
    "KOTOOTOK",
    "KOOOOOOK",
    "KOOOOOOK",
    "KOTOOTOK",
    "KOOOOOOK",
    "KKKKKKKK",
  ],
  platform: [
    "WWWWWWWW",
    "AAAAAAAA",
    ".A....A.",
  ],
  "moving-platform": [
    "PPPPPPPPPPPPPPPPPPPPPPPP",
    "NNNNNNNNNNNNNNNNNNNNNNNN",
    ".N....N....N....N....N..",
  ],
  spike: [
    "...KK...",
    "..KRRK..",
    "..KRRK..",
    ".KRSRRK.",
    ".KRSRRK.",
    "KRRSRRRK",
    "KRRRRRRK",
    "KKKKKKKK",
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
  linkedin: [
    "BBBBBBBBB",
    "BWBBBBBBB",
    "BBBBBBBBB",
    "BWBWWWBBB",
    "BWBWBBWBB",
    "BWBWBBWBB",
    "BWBWBBWBB",
    "BWBWBBWBB",
    "BBBBBBBBB",
  ],
  github: [
    "..WWWWW..",
    ".WKWWWKW.",
    "WWKKKKKWW",
    "WKKWKWKKW",
    "WKKKKKKKW",
    "WWKKKKKWW",
    "WWWKKKWWW",
    ".WKWKWWW.",
    "..WWKWW..",
  ],
  // A see-through "market bubble" with a shine on one side.
  bubble: [
    "..CCCC..",
    ".CWW..C.",
    "CWW....C",
    "CW.....C",
    "C......C",
    "C.....BC",
    ".C...BC.",
    "..CCCC..",
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

// Draws one text-grid sprite. `recolor` swaps letters for other colors,
// which is how each level theme gets its own ground.
export function drawSprite(scene: Phaser.Scene, key: string, rows: string[], recolor: Record<string, number> = {}): void {
  const graphics = scene.add.graphics();
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const color = recolor[char] ?? COLORS[char];
      if (color === undefined) return;
      graphics.fillStyle(color, 1);
      graphics.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
    });
  });
  graphics.generateTexture(key, rows[0].length * PIXEL, rows.length * PIXEL);
  graphics.destroy();
}

export function spriteRows(key: string): string[] {
  return SPRITES[key];
}

export function createTextures(scene: Phaser.Scene): void {
  for (const [key, rows] of Object.entries(SPRITES)) drawSprite(scene, key, rows);
  drawFlagpole(scene);
  createAnimations(scene);
}

function drawFlagpole(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillStyle(NES.lightGray, 1).fillRect(18, 8, 4, 152);
  g.fillStyle(NES.yellow, 1).fillCircle(20, 6, 6);
  g.fillStyle(NES.lime, 1).fillTriangle(22, 14, 22, 50, 40, 32);
  g.fillStyle(NES.green, 1).fillRect(12, 152, 16, 8);
  g.generateTexture("flagpole", 40, 160);
  g.destroy();
}

function createAnimations(scene: Phaser.Scene): void {
  const frames = (...keys: string[]) => keys.map((key) => ({ key }));
  scene.anims.create({ key: "player-walk", frames: frames("player-walk1", "player-walk2"), frameRate: 8, repeat: -1 });
  scene.anims.create({ key: "bear-walk", frames: frames("bear-walk1", "bear-walk2"), frameRate: 4, repeat: -1 });
  scene.anims.create({ key: "coin-spin", frames: frames("coin1", "coin2", "coin3", "coin2"), frameRate: 8, repeat: -1 });
}
