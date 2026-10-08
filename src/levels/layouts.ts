// Level layouts, drawn as text. Each character is one 32px tile:
//   #  ground        B  brick         ?  coin block     H  heart block
//   S  shield block  -  thin platform (jump up through it, S to drop)
//   ~  moving platform  ^  candle spikes  b  bear  u  market bubble  o  coin
//   P  player start  F  goal flag
// Levels are shared by every paper: a world's Nth lesson uses the Nth layout.

export interface LevelLayout {
  name: string;
  rows: string[];
}

export const LEVEL_LAYOUTS: LevelLayout[] = [
  {
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
  },
  {
    name: "Spread Canyon",
    rows: [
      "                                                                                                              ",
      "                                                                                                              ",
      "                                                                                                              ",
      "                                                                                                              ",
      "                                                                                                              ",
      "                                                                                                              ",
      "                                                                                                              ",
      "                                         ooo                                                                  ",
      "        B?B          ooo      BSB                     ?B?                        ooo           BHB            ",
      "                                    --   ~                     --          ##    ---                          ",
      "                                                                    ##     ##                                 ",
      "  P           b             ^ b ^                 b  b    ^^        ##  b  ##           b ^ b       o o   F   ",
      "####################    ################       ###############    ##############    ##########################",
      "####################    ################       ###############    ##############    ##########################",
    ],
  },
  {
    name: "Convergence Peak",
    rows: [
      "                                                                                                                            ",
      "                                                                                                                            ",
      "                                                                                                                            ",
      "                                                                                                                            ",
      "                                                              ooo                                                           ",
      "                                                              ---                                                           ",
      "                                                                                                                            ",
      "                               ooo             ooo       H                                 ooo                 #            ",
      "      ?B?      oo        BSB            B?B               ---                                          ?BH    ##            ",
      "               --              ~               ~                       --            ###   ~                 ##             ",
      "                                                                            ##       ###                    ###             ",
      "  P       b         ^b^               b  ^            b ^^ b      ^ b       ##  b ^  ###          b ^ b ^   ###     ooo F   ",
      "##############    ############       #########      ##################    ################     #############################",
      "##############    ############       #########      ##################    ################     #############################",
    ],
  },
];
