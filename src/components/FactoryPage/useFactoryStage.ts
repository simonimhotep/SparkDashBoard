import { useCallback, useEffect, useRef } from "react";
import { armPeriodMs, smoothIntensity } from "./factoryModel";

export interface StagePhase {
  intensity: number;
  armPhase: number;
  beltOffset: number;
}

export type StageFrame = (dtMs: number, phase: StagePhase) => void;

export interface FactoryStageOptions {
  intensity: number;
  paused: boolean;
  preview: boolean;
}

const PREVIEW_INTENSITY = 0.45;
/** Belt travel at full intensity, in px/s; the treads repeat every BELT_TILE px. */
const BELT_PX_PER_SEC = 130;
const BELT_TILE = 64;
const IDLE = 0.02;

/**
 * One rAF loop for the whole stage. It smooths throughput into an intensity, advances
 * the arm and belt phases, writes them as CSS variables on the stage root and hands each
 * frame to the canvas subscribers. Reduced motion, pause and a hidden document all stop it.
 */
export function useFactoryStage(rootRef: React.RefObject<HTMLElement | null>, opts: FactoryStageOptions) {
  const phase = useRef<StagePhase>({ intensity: 0, armPhase: 0, beltOffset: 0 });
  const subscribers = useRef(new Set<StageFrame>());
  const rate = useRef(opts);

  useEffect(() => {
    rate.current = opts;
  }, [opts]);

  const subscribe = useCallback((draw: StageFrame) => {
    subscribers.current.add(draw);
    return () => {
      subscribers.current.delete(draw);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const write = () => {
      const p = phase.current;
      root.style.setProperty("--factory-intensity", p.intensity.toFixed(3));
      root.style.setProperty("--factory-arm-phase", p.armPhase.toFixed(4));
      root.style.setProperty("--factory-arm-angle", `${(-25 + Math.sin(p.armPhase * Math.PI * 2) * 8).toFixed(1)}deg`);
      root.style.setProperty(
        "--factory-arm-angle-2",
        `${(110 + Math.sin(p.armPhase * Math.PI * 4) * 14).toFixed(1)}deg`,
      );
      root.style.setProperty("--factory-belt-offset", `${p.beltOffset.toFixed(1)}px`);
    };

    // A unit's first render knows the real throughput; start from it instead of 0.
    if (phase.current.intensity === 0 && opts.intensity > 0) phase.current.intensity = opts.intensity;
    write();

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || opts.paused) return;

    let raf = 0;
    let last = 0;

    const tick = (ts: number) => {
      const dt = last === 0 ? 16 : Math.min(64, ts - last);
      last = ts;
      const p = phase.current;
      const target = rate.current.preview ? PREVIEW_INTENSITY : rate.current.intensity;

      p.intensity = smoothIntensity(p.intensity, target, dt);
      if (p.intensity < IDLE) {
        p.armPhase = 0;
      } else {
        p.armPhase = (p.armPhase + dt / armPeriodMs(p.intensity)) % 1;
        p.beltOffset = (p.beltOffset + (dt / 1000) * BELT_PX_PER_SEC * (0.15 + 0.85 * p.intensity)) % BELT_TILE;
      }
      write();
      for (const draw of subscribers.current) draw(dt, p);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf === 0) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // The loop reads the latest options through `rate`; only rootRef may restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef]);

  return { subscribe };
}
