import { describe, expect, it } from "vitest";
import {
  advanceTokens,
  BELT_Y,
  CONVEYOR_H,
  CONVEYOR_W,
  POOL_MAX,
  spawnTokens,
  type Token,
} from "./conveyorModel";

const token = (over: Partial<Token> = {}): Token => ({
  x: 100,
  y: BELT_Y,
  dir: 1,
  falling: false,
  vy: 0,
  tilt: 0,
  ...over,
});

describe("conveyorModel", () => {
  it("spawns at the token rate and never exceeds the pool cap", () => {
    const pool: Token[] = [];
    const left = spawnTokens(pool, 0, 6, 0.5, () => 0.9);
    expect(pool.length).toBe(3);
    expect(left).toBeCloseTo(0);

    for (let i = 0; i < 200; i += 1) spawnTokens(pool, 1, 60, 1, () => 0.9);
    expect(pool.length).toBe(POOL_MAX);
  });

  it("spawns nothing when the line is idle", () => {
    const pool: Token[] = [];
    spawnTokens(pool, 0, 0, 1, () => 0.9);
    expect(pool.length).toBe(0);
  });

  it("carries a token to the hopper and drops it off the belt", () => {
    const pool = [token({ x: CONVEYOR_W / 2 - 20 })];
    advanceTokens(pool, 0.016, 1);
    expect(pool[0].falling).toBe(true);

    for (let i = 0; i < 400; i += 1) advanceTokens(pool, 0.016, 1);
    expect(pool.length).toBe(0);
  });

  it("keeps a fresh token riding the belt at a higher intensity", () => {
    const slow = [token()];
    const fast = [token()];
    advanceTokens(slow, 0.016, 0);
    advanceTokens(fast, 0.016, 1);
    expect(fast[0].x).toBeGreaterThan(slow[0].x);
    expect(slow[0].y).toBe(BELT_Y);
    expect(fast[0].y).toBeGreaterThanOrEqual(BELT_Y);
    expect(CONVEYOR_H).toBeGreaterThan(BELT_Y);
  });
});
