import { useCallback, useEffect, useRef } from "react";
import { smoothIntensity, type FactoryUnit } from "./factoryModel";
import { advanceStation, initialStationMotion, type StationMotion } from "./stationMotion";

export interface StagePhase {
  intensity: number;
  armPhase: number;
  beltOffset: number;
  stations: ReadonlyMap<string, StationMotion>;
}

export type StageFrame = (dtMs: number, phase: StagePhase) => void;

export interface FactoryStageOptions {
  intensity: number;
  paused: boolean;
  preview: boolean;
  stale?: boolean;
  units?: readonly FactoryUnit[];
}

/** One clock, independent station phases. Pause and reduced-motion changes take effect live. */
export function useFactoryStage(rootRef: React.RefObject<HTMLElement | null>, opts: FactoryStageOptions) {
  const stations = useRef(new Map<string, StationMotion>());
  const phase = useRef<StagePhase>({ intensity: 0, armPhase: 0, beltOffset: 0, stations: stations.current });
  const subscribers = useRef(new Set<StageFrame>());
  const rate = useRef(opts);

  useEffect(() => { rate.current = opts; }, [opts]);

  const subscribe = useCallback((draw: StageFrame) => {
    subscribers.current.add(draw);
    draw(0, phase.current);
    return () => { subscribers.current.delete(draw); };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    let raf = 0;
    let last: number | null = null;
    const blocked = () => rate.current.paused || rate.current.stale || media?.matches || document.hidden;

    const tick = (ts: number) => {
      raf = 0;
      if (blocked()) return;
      const dt = last === null ? 16 : Math.min(64, ts - last);
      last = ts;
      const p = phase.current;
      p.intensity = smoothIntensity(p.intensity, rate.current.preview ? 0.45 : rate.current.intensity, dt);
      const ids = new Set<string>();
      for (const unit of rate.current.units ?? []) {
        ids.add(unit.id);
        stations.current.set(unit.id, advanceStation(stations.current.get(unit.id) ?? initialStationMotion(), unit, dt, rate.current.preview, !!rate.current.stale));
      }
      for (const id of stations.current.keys()) if (!ids.has(id)) stations.current.delete(id);
      if (p.intensity > 0.02) p.beltOffset = (p.beltOffset + dt / 1000 * (40 + 90 * p.intensity)) % 64;
      root.style.setProperty("--factory-intensity", p.intensity.toFixed(3));
      root.style.setProperty("--factory-belt-offset", `${p.beltOffset.toFixed(1)}px`);
      for (const draw of subscribers.current) draw(dt, p);
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = null;
    };
    const reconcile = () => {
      if (blocked()) stop();
      else if (!raf) raf = requestAnimationFrame(tick);
    };
    media?.addEventListener?.("change", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    reconcile();
    return () => {
      stop();
      media?.removeEventListener?.("change", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [rootRef, opts.paused, opts.stale]);

  return { subscribe };
}
