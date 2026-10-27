// The player's jump, kept free of Phaser so the tests can check how high it goes.

export const GRAVITY = 1400;
// Strong enough to land on blocks and platforms 4 tiles above the ground (the
// tallest step in any level or boss arena) with some room to spare. At -600 a
// full jump peaked 4 px short, so the player fell back every time.
export const JUMP_VELOCITY = -660;

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
