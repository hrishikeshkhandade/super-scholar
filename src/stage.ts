import type { Paper } from "./content/types";

// Where the player is in a paper: passed between the level, cutscene, and boss scenes.
export interface StageData {
  paper: Paper;
  worldIndex: number;
  checkpointsCleared: number;
  lives: number;
  // Hits taken so far in this level; carried over when a pit fall restarts
  // it, so falling still costs the "no hits" star.
  levelHits?: number;
  // Facts found so far in this level (indexes into the world's facts),
  // carried over the same way so they still show on the LEVEL CLEAR card.
  levelFacts?: number[];
}
