import { describe, expect, it } from "vitest";
import { factoryFleet } from "./factoryModel";
import { advanceStation, initialStationMotion } from "./stationMotion";
import { makeSpark } from "../../testing/fixtures";

describe("per-station motion", () => {
  it("makes only the busy station harvest, with smaller idle motion for its neighbor", () => {
    const idleSpark = makeSpark("idle");
    idleSpark.metrics.llm[0].generationTps = 0;
    const [busy, idle, off] = factoryFleet([makeSpark("busy"), idleSpark, makeSpark("off", false)]).units;
    const a = advanceStation(initialStationMotion(), busy, 250, false, false);
    const b = advanceStation(initialStationMotion(), idle, 250, false, false);
    const c = advanceStation(initialStationMotion(), off, 250, false, false);
    expect(a.working).toBe(true);
    expect(b.working).toBe(false);
    expect(a.phase).toBeGreaterThan(b.phase);
    expect(b.phase).toBeGreaterThan(0);
    expect(c.phase).toBe(0);
    expect(b.released).toBe(0);
  });

  it("releases earned Tokens only when the claw opens, never at an arbitrary point in the cycle", () => {
    const unit = factoryFleet([makeSpark("a")]).units[0];
    let state = initialStationMotion();
    state = advanceStation(state, unit, 200, false, false);
    expect(state.earned).toBeGreaterThan(0);
    expect(state.released).toBe(0);
    for (let i = 0; i < 30; i++) state = advanceStation(state, unit, 64, false, false);
    expect(state.released).toBeGreaterThan(0);
  });

  it("finishes releasing measured output after a short request becomes idle", () => {
    const unit = { ...factoryFleet([makeSpark("burst")]).units[0], decodeTps: 24 };
    let state = initialStationMotion();
    for (let i = 0; i < 8; i++) state = advanceStation(state, unit, 64, false, false);
    const earned = state.earned;
    expect(earned).toBeGreaterThan(2);
    expect(state.released).toBe(0);
    const idle = { ...unit, decodeTps: 0, activeStreams: 0 };
    state = advanceStation(state, idle, 64, false, false);
    expect(state.earned).toBe(earned);
    for (let i = 0; i < 200; i++) state = advanceStation(state, idle, 64, false, false);
    expect(state.released).toBe(Math.floor(earned));
    expect(state.working).toBe(false);
    const released = state.released;
    for (let i = 0; i < 200; i++) state = advanceStation(state, idle, 64, false, false);
    expect(state.released).toBe(released);
  });

  it("does not invent worker output or resume stale/offline production in preview", () => {
    const workerSpark = makeSpark("worker");
    workerSpark.role = "worker";
    const worker = factoryFleet([workerSpark]).units[0];
    let state = initialStationMotion();
    for (let i = 0; i < 200; i++) state = advanceStation(state, worker, 64, false, false);
    expect(state.working).toBe(true);
    expect(state.released).toBe(0);
    expect(state.earned).toBe(0);
    const stale = advanceStation(state, worker, 64, true, true);
    expect(stale.phase).toBe(state.phase);
    expect(stale.working).toBe(false);
    const offline = advanceStation(state, { ...worker, online: false }, 64, true, false);
    expect(offline.phase).toBe(state.phase);
    expect(offline.working).toBe(false);
  });
});
