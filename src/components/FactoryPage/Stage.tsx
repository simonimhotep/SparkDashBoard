import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import bgFactory from "./assets/bg-factory.webp";
import officeGlass from "./assets/office-glass.webp";
import referenceFloor from "./assets/reference-floor.webp";
import { BossOffice } from "./BossOffice";
import { Conveyor } from "./Conveyor";
import type { FactoryFleet } from "./factoryModel";
import { SparkUnit } from "./SparkUnit";
import { stationLayout } from "./stationGeometry";import { useFactoryStage } from "./useFactoryStage";

const DESIGN_W = 1920;
const DESIGN_H = 1080;

interface StageProps {
  fleet: FactoryFleet;
  tempUnit: "celsius" | "fahrenheit";
  onSelectUnit: (id: string) => void;
  rootRef: RefObject<HTMLDivElement | null>;
  paused?: boolean;
  preview?: boolean;
  stale?: boolean;
}

/** The approved 1920 × 1080 scene, scaled once so all layered art and joints stay aligned. */
export function Stage({ fleet, tempUnit, onSelectUnit, rootRef, paused = false, preview = false, stale = false }: StageProps) {
  const [scale, setScale] = useState(1);
  const { subscribe } = useFactoryStage(rootRef, { intensity: fleet.intensity, paused, preview, stale, units: fleet.units });
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const read = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setScale(Math.min(width / DESIGN_W, height / DESIGN_H));
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

  // The approved floor ends at four stations; a longer fleet shows its four primary units.
  const ordered = [...fleet.units]
    .sort((a, b) => Number(b.station === "head") - Number(a.station === "head"))
    .slice(0, 4);
  const layout = stationLayout(ordered.length);
  const stations = ordered.map((unit, i) => ({ ...layout.stations[i], id: unit.id, online: unit.online }));

  return (
    <main className={`factory-stage${stale ? " is-stale" : ""}`} ref={rootRef}>
      <div className="factory-stage__inner" style={{ "--factory-scale": scale } as CSSProperties}>
        <img className="factory-bg" src={bgFactory} alt="" aria-hidden="true" />
        <img className="factory-ground" src={referenceFloor} alt="" aria-hidden="true" />
        <img className="factory-office" src={officeGlass} alt="" aria-hidden="true" />
        <BossOffice intensity={fleet.intensity} busy={!stale && fleet.intensity > 0.15} asleep={false} />
        <div className="factory-floor" style={{ "--factory-floor-scale": 1, "--factory-floor-height": `${layout.height + 30}px` } as CSSProperties}>
          <div className="factory-floor__surface">
            <div className="factory-floor__scene">
              <Conveyor subscribe={subscribe} stations={stations} height={layout.height} />
              {ordered.map((unit, index) => (
                <div key={unit.id} className="factory-station" style={{ "--station-x": `${stations[index].x}px`, "--station-y": `${stations[index].y}px`, "--station-scale": stations[index].scale, "--station-depth": stations[index].depth } as CSSProperties}>
                  <SparkUnit unit={unit} index={index + 1} side={stations[index].side} placement={stations[index]} rowY={stations[index].y} height={layout.height} tempUnit={tempUnit} subscribe={subscribe} stale={stale} onSelect={onSelectUnit} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
