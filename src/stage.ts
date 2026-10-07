import type { Paper } from "./content/types";

// Where the player is in a paper: passed between the level, cutscene, and boss scenes.
export interface StageData {
  paper: Paper;
  worldIndex: number;
  checkpointsCleared: number;
  lives: number;
}
