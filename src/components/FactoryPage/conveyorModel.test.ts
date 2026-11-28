import { describe, expect, it } from "vitest";
import { advanceBelt, advanceTokens, CUBE_SLOT, createBeltFeed, feedTokens, POOL_MAX, type Token } from "./conveyorModel";
import { beltCenter } from "./stationGeometry";

const token = (over: Partial<Token> = {}): Token => ({ x: 850, y: 300, side: "left", falling: false, vy: 0, tilt: 0, ...over });
const claw = { x: 815, y: 520 };
const CUBES_PER_RELEASE = 80;

/** Runs a rail exactly as the stage does: queue at the claw, release, then move everything. */
const runBelt = (frames: number, count: number, side: "left" | "right" = "left", intensity = 1, height = 1030) => {
  const feed = createBeltFeed();
  feedTokens(feed, claw, count);
  const pool: Token[] = [];
  for (let i = 0; i < frames; i++) {
    advanceBelt(feed, pool, side, 1 / 60, intensity, height);
    advanceTokens(pool, 1 / 60, intensity, height);
  }
  return { feed, pool };
};

const ridingGaps = (pool: Token[]) => {
  const ys = pool.filter((cube) => !cube.falling).map((cube) => cube.y).sort((a, b) => a - b);
  return ys.slice(1).map((y, i) => y - ys[i]);
};

describe("longitudinal conveyor", () => {
  it("queues a measured release instead of dumping it onto the belt at once", () => {
    const feed = createBeltFeed();
    feedTokens(feed, { x: 1100, y: 520 }, CUBES_PER_RELEASE);
    const pool: Token[] = [];
    advanceBelt(feed, pool, "right", 1 / 60, 1, 1030);
    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({ side: "right", x: 1100, y: 520, falling: false });
  });

  it("keeps consecutive cubes one slot apart, as on the approved belt", () => {
    const { pool } = runBelt(60, CUBES_PER_RELEASE);
    const gaps = ridingGaps(pool);
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    // One frame of spawn quantisation (speed 210 px/s at 60 fps) is the only allowed jitter.
    gaps.forEach((gap) => expect(Math.abs(gap - CUBE_SLOT)).toBeLessThan(4));
  });

  it("keeps one ordered line when both claws on a rail release", () => {
    const feed = createBeltFeed();
    const pool: Token[] = [];
    const far = { x: 830, y: 560 };
    const near = { x: 810, y: 600 };
    for (let i = 0; i < 90; i++) {
      if (i % 20 === 0) feedTokens(feed, i % 40 ? far : near, 40);
      advanceBelt(feed, pool, "left", 1 / 60, 1, 1030);
      advanceTokens(pool, 1 / 60, 1, 1030);
    }
    const gaps = ridingGaps(pool);
    expect(gaps.length).toBeGreaterThanOrEqual(4);
    gaps.forEach((gap) => expect(Math.abs(gap - CUBE_SLOT)).toBeLessThan(4));
  });

  it("never lands a second claw's cube on one already at that spot", () => {
    const feed = createBeltFeed();
    const pool: Token[] = [];
    // Two machines feed one rail from their own landing points, far up and near the mouth.
    const far = { x: 830, y: 520 };
    const near = { x: 810, y: 786 };
    let closest = Infinity;
    for (let i = 0; i < 600; i++) {
      if (i % 10 === 0) feedTokens(feed, i % 20 ? far : near, 60);
      advanceBelt(feed, pool, "left", 1 / 60, 1, 1030);
      advanceTokens(pool, 1 / 60, 1, 1030);
      ridingGaps(pool).forEach((gap) => { closest = Math.min(closest, gap); });
    }
    expect(closest).toBeGreaterThan(CUBE_SLOT - 4);
  });

  it("holds enough backlog that a busy belt keeps feeding between releases", () => {
    const feed = createBeltFeed();
    feedTokens(feed, claw, 1000);
    const pool: Token[] = [];
    let spawned = 0;
    for (let i = 0; i < 240; i++) {
      const before = pool.length;
      advanceBelt(feed, pool, "left", 1 / 60, 1, 1030);
      spawned += pool.length - before;
      advanceTokens(pool, 1 / 60, 1, 1030);
    }
    // Four seconds of belt at one cube per 50 px is about 17 cubes; one measured release must cover it.
    expect(spawned).toBeGreaterThanOrEqual(16);
  });

  it("holds a fractional release until it adds up to a whole cube", () => {
    const feed = createBeltFeed();
    const pool: Token[] = [];
    feedTokens(feed, claw, 0.5);
    advanceBelt(feed, pool, "left", 1 / 60, 1, 1030);
    expect(pool).toHaveLength(0);
    feedTokens(feed, claw, 0.25);
    advanceBelt(feed, pool, "left", 1 / 60, 1, 1030);
    expect(pool).toHaveLength(1);
  });

  it("keeps a lone 15 tok/s unit's rail populated between arm releases", () => {
    // #04 in the four-unit scene: 15 tok/s = 2.5 tokens/s, released only when the arm crosses its
    // drop pose (one 1.96 s cycle). Its rail must still carry a line, not one pair of cubes.
    const tokensPerCycle = 15 / 6 * 1.96;
    const feed = createBeltFeed();
    feedTokens(feed, { x: 1129, y: 786 }, tokensPerCycle);
    const pool: Token[] = [];
    let most = 0;
    for (let i = 0; i < 120; i++) {
      advanceBelt(feed, pool, "right", 1 / 60, 1, 1030);
      advanceTokens(pool, 1 / 60, 1, 1030);
      most = Math.max(most, pool.filter((cube) => cube.side === "right").length);
    }
    expect(most).toBeGreaterThanOrEqual(4);
  });

  it("works off a long frame one cube at a time instead of stacking them on one spot", () => {
    const feed = createBeltFeed();
    feedTokens(feed, claw, 40);
    const pool: Token[] = [];
    advanceBelt(feed, pool, "left", 0.5, 1, 1030);
    expect(pool).toHaveLength(1);
    advanceTokens(pool, 0.5, 1, 1030);
    advanceBelt(feed, pool, "left", 1 / 60, 1, 1030);
    expect(pool).toHaveLength(2);
    // The second cube takes the free slot above, never the one the first is sitting in.
    expect(Math.abs(pool[1].y - pool[0].y)).toBeGreaterThan(CUBE_SLOT - 4);
  });

  it("caps the drawn pool", () => {
    const feed = createBeltFeed();
    const pool = Array.from({ length: POOL_MAX }, (_, i) => token({ side: "right", y: 560 + i * CUBE_SLOT }));
    feedTokens(feed, { x: 1100, y: 520 }, 1000);
    advanceBelt(feed, pool, "right", 1 / 60, 1, 8000);
    expect(pool).toHaveLength(POOL_MAX);
  });

  it.each([0, -1, -80])("queues nothing for release %i", (count) => {
    const feed = createBeltFeed();
    feedTokens(feed, { x: 850, y: 300 }, count);
    const pool: Token[] = [];
    advanceBelt(feed, pool, "left", 1 / 60, 1, 1030);
    expect(feed.payloads).toHaveLength(0);
    expect(pool).toHaveLength(0);
  });

  it("snaps from the claw onto the belt centerline within a short run, then rides it exactly", () => {
    const pool: Token[] = [];
    const feed = createBeltFeed();
    feedTokens(feed, { x: 690, y: 700 }, 1.5);
    advanceBelt(feed, pool, "left", 1 / 60, 1, 1030);
    expect(Math.abs(pool[0].x - 690)).toBeLessThan(1);
    for (let i = 0; i < 40; i++) advanceTokens(pool, 1 / 60, 1, 1030);
    expect(pool[0].x).toBeCloseTo(beltCenter("left", pool[0].y, 1030), 5);
  });

  it("follows its own perspective rail toward the rectangular mouth then falls out", () => {
    const pool = [token()];
    advanceTokens(pool, 0.1, 1, 700);
    expect(pool[0].y).toBeGreaterThan(300);
    expect(pool[0].x).toBeCloseTo(beltCenter("left", pool[0].y, 700));
    for (let i = 0; i < 200; i++) advanceTokens(pool, 0.05, 1, 700);
    expect(pool).toHaveLength(0);
  });

  it("keeps both rails distinct and removes tokens below the scene", () => {
    const pool = [token({ side: "left" }), token({ side: "right" })];
    advanceTokens(pool, 0.1, 0.5, 1030);
    expect(pool[0].x).toBeLessThan(960);
    expect(pool[1].x).toBeGreaterThan(960);
    const falling = [token({ y: 1050, falling: true, vy: 200 })];
    advanceTokens(falling, 0.1, 0.5, 1030);
    expect(falling).toHaveLength(0);
  });

  it("culls a cube before it can surface under the collector's front casting", () => {
    // The casting's bottom edge is at height + 10, so the cull line has to sit a cube's
    // half-height above it; a cube at height - 10 still reaches the floor in front of the tray.
    const pool = [token({ y: 1020, falling: true, vy: 0 })];
    advanceTokens(pool, 1 / 60, 1, 1030);
    expect(pool).toHaveLength(0);
  });
});
