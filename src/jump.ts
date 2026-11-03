// The player's jump, kept free of Phaser so the tests can check how high it goes.

export const GRAVITY = 1400;
// Strong enough to land on blocks and platforms 4 tiles above the ground (the
// tallest step in any level or boss arena) with some room to spare. At -600 a
// full jump peaked 4 px short, so the player fell back every time.
export const JUMP_VELOCITY = -660;
export const RUN_SPEED = 210;

// How many pixels a full jump rises, stepped the way Arcade physics does it
// (speed changes first, then position, once per frame), which comes out a
// little lower than the v²/2g formula.
export function jumpHeight(velocity = JUMP_VELOCITY, gravity = GRAVITY, fps = 60): number {
  let speed = -velocity;
  let rise = 0;
  while (speed > 0) {
    speed -= gravity / fps;
    rise += Math.max(speed, 0) / fps;
  }
  return rise;
}

// How far a running jump carries the player sideways by the time their feet
// come back down to `rise` px above where they jumped from (negative: below),
// or undefined if the jump never gets that high. Stepped like jumpHeight.
export function jumpReach(rise: number, velocity = JUMP_VELOCITY, gravity = GRAVITY, speed = RUN_SPEED, fps = 60): number | undefined {
  let up = -velocity;
  let height = 0;
  let highest = 0;
  let sideways = 0;
  for (let frame = 0; frame < fps * 5; frame++) {
    up -= gravity / fps;
    height += up / fps;
    highest = Math.max(highest, height);
    sideways += speed / fps;
    if (up < 0 && height <= rise) return highest >= rise ? sideways : undefined;
  }
  return undefined;
}

// How high a running jump is (px above take-off) once it has carried the
// player `sideways` px, or undefined if they've already landed back by then.
export function jumpHeightAt(sideways: number, velocity = JUMP_VELOCITY, gravity = GRAVITY, speed = RUN_SPEED, fps = 60): number | undefined {
  let up = -velocity;
  let height = 0;
  for (let travelled = 0; travelled < sideways; travelled += speed / fps) {
    up -= gravity / fps;
    height += up / fps;
    if (height < 0) return undefined;
  }
  return height;
}
