import { beltCenter, type Point, type StationSide } from "./stationGeometry";

export const POOL_MAX = 120;
/** Earned tokens per cube. The rail holds one cube per 50 px at the fleet belt speed, so a unit
 *  has to clear ~2.8 tok/s to keep its own stretch of belt full; at 1.5 a lone 15 tok/s machine
 *  dropped a pair of cubes per arm cycle and left the rest of its rail bare. */
const TOKENS_PER_CUBE = 0.75;
/** Enough backlog to bridge one arm cycle, so a busy belt never runs dry between releases. */
const MAX_QUEUED_CUBES = 24;
/** The queue keeps one cube every this many pixels of belt, as on the approved belt. */
export const CUBE_SLOT = 50;
/** How far a cube travels before it has settled onto the belt centerline. */
const LANDING_DISTANCE = 90;

export interface Token {
  x: number;
  y: number;
  side: StationSide;
  falling: boolean;
  vy: number;
  tilt: number;
  laneOffset?: number;
  releaseY?: number;
}

/** Output waiting at one claw. The rail, not the unit, owns their order. */
interface Payload {
  x: number;
  y: number;
  tokens: number;
}

/**
 * One queue per rail, shared by every unit feeding it: two claws releasing into the same
 * track must not interleave their own queues, or cubes end up drawn on top of each other.
 */
export interface BeltFeed {
  payloads: Payload[];
  timer: number;
}

export const createBeltFeed = (): BeltFeed => ({ payloads: [], timer: 0 });

/** A measured release joins the rail's queue instead of dumping a burst onto the belt. */
export function feedTokens(feed: BeltFeed, at: Point, count: number): void {
  if (!(count > 0)) return;
  const queued = feed.payloads.reduce((sum, payload) => sum + payload.tokens, 0);
  const room = MAX_QUEUED_CUBES * TOKENS_PER_CUBE - queued;
  if (room > 0) feed.payloads.push({ x: at.x, y: at.y, tokens: Math.min(count, room) });
}

/**
 * Both claws on a rail release over the same lane, so a cube born under the second claw would
 * otherwise land on one already passing there. It waits for the slot instead: the belt clears
 * a slot in a quarter of a second, and a cube always appears under the claw that made it.
 */
function slotFree(pool: Token[], side: StationSide, at: number): boolean {
  return pool.every((cube) => cube.side !== side || cube.falling || Math.abs(cube.y - at) >= CUBE_SLOT - 2);
}

/**
 * Releases queued cubes at a fixed slot interval, so consecutive cubes are always the same
 * distance apart and the rail reads as an ordered line instead of a bunch.
 */
export function advanceBelt(feed: BeltFeed, pool: Token[], side: StationSide, dtSec: number, intensity: number, height: number): void {
  const speed = 90 + 120 * intensity;
  const slotSeconds = CUBE_SLOT / speed;
  // A long frame is capped at one slot of debt, so a stalled tab resumes the line instead of
  // dumping a burst; the debt is worked off one cube per frame.
  feed.timer = Math.max(-slotSeconds, feed.timer - dtSec);
  if (feed.timer > 0 || pool.length >= POOL_MAX) return;
  // A fractional payload cannot fill a cube on its own; the next payload carries it instead.
  while (feed.payloads.length > 1 && feed.payloads[0].tokens < TOKENS_PER_CUBE) {
    const head = feed.payloads.shift()!;
    feed.payloads[0].tokens += head.tokens;
  }
  const head = feed.payloads[0];
  if (!head || head.tokens < TOKENS_PER_CUBE || !slotFree(pool, side, head.y)) return;
  pool.push({ x: head.x, y: head.y, side, falling: false, vy: 0, tilt: 0, laneOffset: head.x - beltCenter(side, head.y, height), releaseY: head.y });
  head.tokens -= TOKENS_PER_CUBE;
  if (head.tokens <= 0) feed.payloads.shift();
  feed.timer += slotSeconds;
}

export function advanceTokens(pool: Token[], dtSec: number, intensity: number, height: number): void {
  for (const token of pool) {
    if (token.falling) {
      token.vy += 400 * dtSec;
      token.y += token.vy * dtSec;
    } else {
      const speed = 90 + 120 * intensity;
      token.y += speed * dtSec;
      // Leave the claw, then settle onto the centerline within a short run and ride it exactly.
      const travelled = token.y - (token.releaseY ?? token.y);
      const landing = Math.max(0, Math.min(1, travelled / LANDING_DISTANCE));
      token.x = beltCenter(token.side, token.y, height) + (token.laneOffset ?? 0) * (1 - landing);
      // Drop at the speed it was already travelling: starting slower lets the cube behind
      // ride into it, and the queue bunches right above the mouth.
      if (token.y >= height - 79) { token.falling = true; token.vy = speed; }
    }
  }
  // Culled while still behind the collector's front casting. Lower than this and the cube's lower
  // half clears the casting's bottom edge and shows on the floor in front of the tray.
  for (let i = pool.length - 1; i >= 0; i--) if (pool[i].y > height - 15) pool.splice(i, 1);
}
