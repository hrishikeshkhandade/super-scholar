import type { Paper } from "./content/types";
import type { Review } from "./review";

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
  // Played from the level select: doesn't count toward the leaderboard run.
  replay?: boolean;
  // In review mode (boss fights only): the scores so far and where it ends.
  review?: Review;
  // Drawn frozen behind the tutorial: no title card, tips, or music of its own.
  preview?: boolean;
}
