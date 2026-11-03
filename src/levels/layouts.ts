// Level layouts, drawn as text. Each character is one 32px tile:
//   #  ground        B  brick         ?  coin block     H  heart block
//   S  shield block  -  thin platform (jump up through it, S to drop)
//   ~  moving platform  ^  candle spikes  b  bear  u  market bubble  o  coin
//   P  player start  F  goal flag

export interface LevelLayout {
  name: string;
  rows: string[];
}

// Every world has this many levels, each ending in one lesson.
export const LEVELS_PER_WORLD = 3;

// The built-in paper's first level, made by hand as a gentle start: a few of
// each thing the game has, with room to learn the controls. Every other level
// is generated (see generateLayout.ts).
export const TUTORIAL_LAYOUT: LevelLayout = {
  name: "Warm-Up Market",
  rows: [
    "                                                                                                ",
    "                                                                                                ",
    "                                                                                                ",
    "                                                                                                ",
    "                                                                                                ",
    "                                                    ooo                                         ",
    "                                                    ---                                         ",
    "                                                                                                ",
    "          ?B?B             ooo      BHB                           ?             #               ",
    "                           ---                  ---                            ##               ",
    "                                                                      ##      ###               ",
    "  P         b     o o o ^               b   ^^          b             ##  b   ###     o o o F   ",
    "##############################   ###########################  ##################################",
    "##############################   ###########################  ##################################",
  ],
};
