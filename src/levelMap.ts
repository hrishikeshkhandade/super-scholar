import type { Paper } from "./content/types";
import { loadProgress, markCleared, saveProgress, stageKey, type ClearedStages, type Progress, type Stage } from "./save";

// Works out what the level select shows for a paper: every level and boss in
// play order, each cleared (replayable), open (the next one to beat), or
// locked. Pure logic, so it can be tested without drawing anything.

export type StopState = "cleared" | "open" | "locked";

export interface MapStop {
  worldIndex: number;
  stage: Stage; // level number in the world, or "boss"
  label: string; // "1-2" or "BOSS"
  state: StopState;
}

export interface MapWorld {
  name: string;
  stops: MapStop[];
}

// Where the saved CONTINUE point is, as an index into the play order, so
// progress made before the level select existed still counts as cleared.
function progressIndex(paper: Paper, progress: Progress | undefined): number {
  if (!progress || progress.paperId !== paper.id) return 0;
  let index = 0;
  for (let w = 0; w < Math.min(progress.worldIndex, paper.worlds.length); w++) {
    index += paper.worlds[w].cutscenes.length + 1;
  }
  return index + (progress.worldIndex < paper.worlds.length ? progress.checkpointsCleared : 0);
}

export function levelMap(paper: Paper, cleared: ClearedStages, progress?: Progress): MapWorld[] {
  const beaten = new Set(cleared[paper.id] ?? []);
  const reached = progressIndex(paper, progress);
  let order = 0;
  let openGiven = false;

  return paper.worlds.map((world, w) => {
    const stages: Stage[] = [...world.cutscenes.map((_, level) => level), "boss"];
    const stops = stages.map((stage): MapStop => {
      const isCleared = order < reached || beaten.has(stageKey(w, stage));
      order += 1;
      let state: StopState = isCleared ? "cleared" : "locked";
      // The first stop not yet cleared is the one to play next.
      if (!isCleared && !openGiven) {
        state = "open";
        openGiven = true;
      }
      return { worldIndex: w, stage, label: stage === "boss" ? "BOSS" : `${w + 1}-${stage + 1}`, state };
    });
    return { name: world.name, stops };
  });
}

// Every level and boss before the saved CONTINUE point. Recorded as cleared
// before a paper is started over, so NEW GAME doesn't darken the map.
export function stagesReached(paper: Paper, progress: Progress | undefined): { worldIndex: number; stage: Stage }[] {
  return levelMap(paper, {}, progress)
    .flatMap((world) => world.stops)
    .filter((stop) => stop.state === "cleared")
    .map(({ worldIndex, stage }) => ({ worldIndex, stage }));
}

// NEW GAME on a paper: back to 1-1, keeping everything reached so far lit
// on the level select.
export function startPaperOver(paper: Paper): void {
  for (const { worldIndex, stage } of stagesReached(paper, loadProgress())) markCleared(paper.id, worldIndex, stage);
  saveProgress({ paperId: paper.id, worldIndex: 0, checkpointsCleared: 0 });
}

// How many levels and bosses of a paper are cleared, e.g. for "7/20".
export function mapProgress(map: MapWorld[]): { cleared: number; total: number } {
  const stops = map.flatMap((world) => world.stops);
  return { cleared: stops.filter((stop) => stop.state === "cleared").length, total: stops.length };
}
