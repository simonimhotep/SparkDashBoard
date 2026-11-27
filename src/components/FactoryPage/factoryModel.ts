import type { LlmMetrics, SparkSnapshot } from "../../api/types";
import { resolveSparkRole } from "../../api/sparkRole";
import { makeHeadResolver, usableHead, type HeadResolver } from "../../shared/sparkHead";

export type FactoryStation = "head" | "worker" | "standalone";

export interface FactoryUnit {
  id: string;
  name: string;
  online: boolean;
  offlineReason: string | null;
  station: FactoryStation;
  /** Workers show the head's model name; null when there is no usable head. */
  modelText: string | null;
  modelMuted: boolean;
  /** Workers never report their own rate: their LLM probe is off. */
  decodeTps: number | null;
  activeStreams: number | null;
  gpuPct: number | null;
  gpuTempC: number | null;
  gpuW: number | null;
  /** Thermal slowdown only; a power cap is not a hotspot. */
  hotspot: boolean;
}

export interface FactoryFleet {
  units: FactoryUnit[];
  online: number;
  total: number;
  heads: number;
  workers: number;
  /** Sum of the measured head/standalone rates; unknown rates never count as zero. */
  decodeTps: number;
  activeStreams: number | null;
  queued: number | null;
  peakTempC: number | null;
  powerW: number | null;
  thermalThrottled: number;
  powerCapped: number;
  hardwareSlowdowns: number;
  fanPctAvg: number | null;
  intensity: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function intensityFor(tps: number): number {
  return Number.isFinite(tps) && tps > 0 ? Math.min(1, tps / 40) : 0;
}

export function tokenRatePerSecond(tps: number): number {
  return Number.isFinite(tps) && tps > 0 ? Math.min(8, tps / 6) : 0;
}

export function armPeriodMs(intensity: number): number {
  return 2600 - 1700 * clamp01(intensity);
}

export function smoothIntensity(prev: number, target: number, dtMs: number, tauMs = 1200): number {
  return prev + (target - prev) * (1 - Math.exp(-dtMs / tauMs));
}

export function factoryColumns(count: number): number {
  return count <= 1 ? 1 : Math.min(3, Math.ceil(Math.sqrt(count)));
}

/**
 * The last snapshot no longer describes the fleet: the socket dropped, or the last good
 * one is older than three polls. Nothing received yet is "connecting", not stale.
 */
export function isSnapshotStale(
  connected: boolean,
  lastValidSnapshotAt: number | null,
  refreshInterval: number | null,
  now: number,
): boolean {
  if (lastValidSnapshotAt === null) return false;
  if (!connected) return true;
  if (refreshInterval === null || refreshInterval <= 0) return false;
  return now - lastValidSnapshotAt > refreshInterval * 3;
}

/** Endpoints whose rates were actually measured this poll. */
function measuredEndpoints(spark: SparkSnapshot): LlmMetrics[] {
  return (spark.metrics.llm ?? []).filter((e) => e.available && e.measurementValid !== false);
}

/** The served model of an endpoint that answers, whether or not its rates were readable. */
function availableModelId(spark: SparkSnapshot | null): string | null {
  return spark?.metrics.llm?.find((e) => e.available && e.modelId)?.modelId ?? null;
}

function sumOf(values: ReadonlyArray<number | null | undefined>): number | null {
  const known = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

function maxOf(values: ReadonlyArray<number | null | undefined>): number | null {
  const known = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return known.length === 0 ? null : Math.max(...known);
}

function measured(value: number | null | undefined, available: boolean): number | null {
  return available && typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unitOf(spark: SparkSnapshot, headOf: HeadResolver<SparkSnapshot>): FactoryUnit {
  const station = resolveSparkRole(spark);
  const isWorker = station === "worker";
  const endpoints = measuredEndpoints(spark);

  let modelText: string | null;
  if (isWorker) {
    const head = usableHead(headOf(spark));
    modelText = availableModelId(head) ?? spark.workerLabel ?? null;
  } else {
    modelText = availableModelId(spark);
  }

  const gpu = spark.metrics.gpu;
  const availability = gpu?.metricAvailability;

  return {
    id: spark.id,
    name: spark.name,
    online: spark.online,
    offlineReason: spark.offlineReason ?? null,
    station,
    modelText,
    modelMuted: modelText === null,
    decodeTps: isWorker || endpoints.length === 0
      ? null
      : sumOf(endpoints.map((e) => e.generationTps)),
    activeStreams: isWorker || endpoints.length === 0
      ? null
      : sumOf(endpoints.map((e) => e.requestsRunning ?? e.slotsActive)),
    gpuPct: measured(gpu?.usage, availability?.usage !== false),
    gpuTempC: measured(gpu?.temperature, availability?.temperature !== false),
    gpuW: measured(gpu?.power?.draw, availability?.powerDraw !== false),
    hotspot: gpu?.throttle?.thermal === true,
  };
}

/** Queue depth of the endpoints that report one; workers never probe an engine. */
function queuedOf(spark: SparkSnapshot): number | null {
  if (resolveSparkRole(spark) === "worker") return null;
  const endpoints = measuredEndpoints(spark);
  return endpoints.length === 0 ? null : sumOf(endpoints.map((e) => e.requestsWaiting));
}

function fanAverage(list: readonly SparkSnapshot[]): number | null {
  const values: number[] = [];
  for (const spark of list) {
    for (const card of spark.metrics.gpu?.gpus ?? []) {
      const pct = card.fanPct;
      if (typeof pct === "number" && Number.isFinite(pct)) values.push(pct);
    }
  }
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function factoryFleet(sparks: readonly SparkSnapshot[]): FactoryFleet {
  const list = Array.isArray(sparks) ? sparks : [];
  const headOf = makeHeadResolver(list);
  const units = list.map((spark) => unitOf(spark, headOf));
  const decodeTps = units.reduce((sum, unit) => sum + (unit.decodeTps ?? 0), 0);

  return {
    units,
    online: units.filter((u) => u.online).length,
    total: units.length,
    heads: units.filter((u) => u.station === "head").length,
    workers: units.filter((u) => u.station === "worker").length,
    decodeTps,
    activeStreams: sumOf(units.map((u) => u.activeStreams)),
    queued: sumOf(list.map(queuedOf)),
    peakTempC: maxOf(units.map((u) => u.gpuTempC)),
    powerW: sumOf(units.map((u) => u.gpuW)),
    thermalThrottled: list.filter((s) => s.metrics.gpu?.throttle?.thermal === true).length,
    powerCapped: list.filter((s) => s.metrics.gpu?.throttle?.powerCap === true).length,
    hardwareSlowdowns: list.filter((s) => s.metrics.gpu?.throttle?.hwSlowdown === true).length,
    fanPctAvg: fanAverage(list),
    intensity: intensityFor(decodeTps),
  };
}
