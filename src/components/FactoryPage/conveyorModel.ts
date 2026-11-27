export const CONVEYOR_W = 1600;
export const CONVEYOR_H = 200;
export const BELT_Y = 150;
export const POOL_MAX = 120;

export interface Token {
  x: number;
  y: number;
  dir: 1 | -1;
  falling: boolean;
  vy: number;
  tilt: number;
}

/**
 * Adds the tokens earned this frame to the pool. `accumulator` carries the fraction
 * of a token; returns what is left for the next frame. The pool is capped, not queued.
 */
export function spawnTokens(
  pool: Token[],
  accumulator: number,
  rate: number,
  dtSec: number,
  rand: () => number = Math.random,
): number {
  let left = accumulator + rate * dtSec;
  while (left >= 1 && pool.length < POOL_MAX) {
    left -= 1;
    const dir: 1 | -1 = rand() < 0.5 ? 1 : -1;
    pool.push({
      x: dir === 1 ? -10 : CONVEYOR_W + 10,
      y: BELT_Y - 4 + rand() * 8,
      dir,
      falling: false,
      vy: 0,
      tilt: (rand() - 0.5) * 0.5,
    });
  }
  return Math.min(left, 2);
}

/** Rides every token toward the hopper, then lets the ones at the mouth fall. */
export function advanceTokens(pool: Token[], dtSec: number, intensity: number): void {
  const speed = 200 + 260 * intensity;
  for (const token of pool) {
    if (token.falling) {
      token.vy += 520 * dtSec;
      token.y += token.vy * dtSec;
      continue;
    }
    token.x += token.dir * speed * dtSec;
    if (
      (token.dir === 1 && token.x >= CONVEYOR_W / 2 - 18) ||
      (token.dir === -1 && token.x <= CONVEYOR_W / 2 + 18)
    ) {
      token.falling = true;
      token.vy = 40;
    }
  }
  for (let i = pool.length - 1; i >= 0; i -= 1) {
    if (pool[i].y > CONVEYOR_H + 12) pool.splice(i, 1);
  }
}
