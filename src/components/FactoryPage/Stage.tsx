import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import bgFactory from "./assets/bg-factory.webp";
import officeGlass from "./assets/office-glass.webp";
import { BossOffice } from "./BossOffice";
import hopper from "./assets/hopper.webp";
import { Conveyor } from "./Conveyor";
import { factoryColumns, tokenRatePerSecond, type FactoryFleet } from "./factoryModel";
import { SparkUnit } from "./SparkUnit";
import { useFactoryStage } from "./useFactoryStage";

const DESIGN_W = 1920;
const DESIGN_H = 1080;

interface StageProps {
  fleet: FactoryFleet;
  tempUnit: "celsius" | "fahrenheit";
  onSelectUnit: (id: string) => void;
  /** The stage root: the animation driver writes its CSS variables here. */
  rootRef: RefObject<HTMLDivElement | null>;
  /** Freeze the animation phase; the numbers keep updating. */
  paused?: boolean;
  /** Drive the scene at a demo pace while the numbers stay real. */
  preview?: boolean;
  /** The snapshot stopped describing the fleet: desaturate the art, keep the numbers. */
  stale?: boolean;
}

/**
 * The factory scene in 1920 × 1080 design coordinates. One scale variable shrinks
 * the whole scene inside the viewport, so the layered art always lines up.
 */
export function Stage({ fleet, tempUnit, onSelectUnit, rootRef, paused = false, preview = false, stale = false }: StageProps) {
  const [scale, setScale] = useState(1);
  const { subscribe } = useFactoryStage(rootRef, { intensity: fleet.intensity, paused, preview });

  // Measure before the first paint so the art never flashes at full 1920 px scale.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const read = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setScale(Math.min(width / DESIGN_W, height / DESIGN_H));
    };
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootRef]);

  const columns = factoryColumns(fleet.units.length);
  // The head keeps the main station; everything else holds its fleet order.
  const ordered = [...fleet.units].sort(
    (a, b) => Number(b.station === "head") - Number(a.station === "head"),
  );

  return (
    <main className={`factory-stage${stale ? " is-stale" : ""}`} ref={rootRef}>
      <div
        className="factory-stage__inner"
        style={{ "--factory-scale": scale } as CSSProperties}
      >
        <img className="factory-bg" src={bgFactory} alt="" aria-hidden="true" />
        <img className="factory-office" src={officeGlass} alt="" aria-hidden="true" />
        <div className="factory-office-stand" aria-hidden="true" />
        {/* Idle shows tea/newspaper; the nap is reserved for a genuinely flat line. */}
        <BossOffice
          intensity={fleet.intensity}
          busy={fleet.intensity > 0.15}
          asleep={false}
        />
        <Conveyor subscribe={subscribe} rate={tokenRatePerSecond(fleet.decodeTps)} />
        <img className="factory-hopper" src={hopper} alt="" aria-hidden="true" />
        <div
          className={`factory-floor factory-floor--cols-${columns}${fleet.units.length > 6 ? " factory-floor--scroll" : ""}`}
        >
          {ordered.map((unit, index) => (
            <SparkUnit
              key={unit.id}
              unit={unit}
              index={index + 1}
              tempUnit={tempUnit}
              intensity={fleet.intensity}
              onSelect={onSelectUnit}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
