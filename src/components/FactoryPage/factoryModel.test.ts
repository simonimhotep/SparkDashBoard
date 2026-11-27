import { describe, expect, it } from "vitest";
import { makeSpark } from "../../testing/fixtures";
import {
  armPeriodMs,
  factoryColumns,
  factoryFleet,
  intensityFor,
  isSnapshotStale,
  smoothIntensity,
  tokenRatePerSecond,
} from "./factoryModel";

describe("factoryFleet", () => {
  it("counts an endpoint once and leaves the worker without its own rate", () => {
    const head = makeSpark("h");
    head.role = "head";
    const w = makeSpark("w");
    w.role = "worker";
    w.workerNode = true;
    w.workerHeadId = "h";
    w.metrics.llm = [];
    const f = factoryFleet([head, w]);
    expect(f.decodeTps).toBe(20); // only the head's 20
    expect(f.units.find((u) => u.id === "w")!.decodeTps).toBeNull();
    expect(f.units.find((u) => u.id === "w")!.modelText).toBe("fixture-model");
  });

  it("treats an unmeasured rate as unknown, not zero", () => {
    const s = makeSpark("s");
    s.metrics.llm[0].measurementValid = false;
    const f = factoryFleet([s]);
    expect(f.units[0].decodeTps).toBeNull();
    expect(f.intensity).toBe(0);
  });

  it("keeps a standalone unit as its own line", () => {
    const f = factoryFleet([makeSpark("solo")]);
    expect(f.units[0].station).toBe("standalone");
    expect(f.decodeTps).toBe(20);
  });

  it("serves an offline unit without inventing numbers", () => {
    const f = factoryFleet([makeSpark("off", false)]);
    expect(f.units[0].online).toBe(false);
    expect(f.units[0].gpuTempC).toBeNull();
    expect(f.decodeTps).toBe(0);
  });

  it("separates thermal throttling from a power cap", () => {
    const a = makeSpark("a");
    (a.metrics.gpu as unknown as Record<string, unknown>).throttle = { thermal: true, active: true };
    const b = makeSpark("b");
    (b.metrics.gpu as unknown as Record<string, unknown>).throttle = { powerCap: true, active: true };
    const f = factoryFleet([a, b]);
    expect(f.thermalThrottled).toBe(1);
    expect(f.powerCapped).toBe(1);
    expect(f.units[0].hotspot).toBe(true);
    expect(f.units[1].hotspot).toBe(false);
  });

  it("sums the queue and the streams from the endpoints that report them", () => {
    const head = makeSpark("h");
    head.role = "head";
    head.metrics.llm[0].requestsRunning = 2;
    head.metrics.llm[0].requestsWaiting = 3;
    const w = makeSpark("w");
    w.role = "worker";
    w.metrics.llm = [];
    expect(factoryFleet([head, w]).activeStreams).toBe(2);
    expect(factoryFleet([head, w]).queued).toBe(3);
    expect(factoryFleet([makeSpark("x")]).queued).toBeNull();
  });

  it("omits the fan row when no card reports a fan", () => {
    expect(factoryFleet([makeSpark("a")]).fanPctAvg).toBeNull();
    const b = makeSpark("b");
    (b.metrics.gpu as unknown as Record<string, unknown>).gpus = [{ fanPct: 40 }, { fanPct: null }];
    expect(factoryFleet([b]).fanPctAvg).toBe(40);
  });

  it("maps throughput to an intensity between 0 and 1", () => {
    expect(intensityFor(0)).toBe(0);
    expect(intensityFor(20)).toBeCloseTo(0.5);
    expect(intensityFor(40)).toBe(1);
    expect(intensityFor(400)).toBe(1);
    expect(intensityFor(-3)).toBe(0);
    expect(intensityFor(Number.NaN)).toBe(0);
    expect(tokenRatePerSecond(6)).toBe(1);
    expect(tokenRatePerSecond(600)).toBe(8);
    expect(armPeriodMs(0)).toBe(2600);
    expect(armPeriodMs(1)).toBe(900);
    expect(smoothIntensity(0, 1, 1200)).toBeCloseTo(1 - Math.exp(-1), 3);
    expect(factoryColumns(1)).toBe(1);
    expect(factoryColumns(3)).toBe(2);
    expect(factoryColumns(6)).toBe(3);
  });

  it("calls a snapshot stale when the socket is down or it is older than three polls", () => {
    expect(isSnapshotStale(true, 1_000, 2_000, 6_999)).toBe(false);
    expect(isSnapshotStale(true, 1_000, 2_000, 7_001)).toBe(true);
    expect(isSnapshotStale(false, 1_000, 2_000, 1_500)).toBe(true);
    // Nothing received yet is "connecting", not stale.
    expect(isSnapshotStale(false, null, 2_000, 9_999)).toBe(false);
    expect(isSnapshotStale(true, 1_000, null, 999_999)).toBe(false);
  });
});
