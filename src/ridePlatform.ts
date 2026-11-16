// Riding a moving platform: a player standing on one moves along with it, with no key held,
// the way a real platform would carry them.

// A physics body's edges, in world pixels.
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Rider extends Box {
  velocityY: number;
}

export interface MovingPlatform extends Box {
  velocityX: number;
}

// How far the player's feet may be from a platform's top and still count as standing on it.
// Gravity pulls the player a pixel or two into the platform each frame before the physics
// pushes them back out, so an exact match would miss.
const FEET_TOLERANCE = 4;

// The horizontal speed of the moving platform the player stands on, or 0 when they aren't on one.
export function rideSpeed(player: Rider, platforms: readonly MovingPlatform[]): number {
  if (player.velocityY < 0) return 0; // jumping up, not standing
  const platform = platforms.find(
    (p) => Math.abs(player.bottom - p.top) <= FEET_TOLERANCE && player.right > p.left && player.left < p.right,
  );
  return platform?.velocityX ?? 0;
}
