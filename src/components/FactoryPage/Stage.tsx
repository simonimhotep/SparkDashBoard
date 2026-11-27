import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import bgFactory from "./assets/bg-factory.webp";
import { factoryColumns, type FactoryFleet } from "./factoryModel";
import { SparkUnit } from "./SparkUnit";

const DESIGN_W = 1920;
const DESIGN_H = 1080;

interface StageProps {
  fleet: FactoryFleet;
  tempUnit: "celsius" | "fahrenheit";
  onSelectUnit: (id: string) => void;
  /** The stage root: the animation driver reads it in later tasks. */
  rootRef: RefObject<HTMLDivElement | null>;
}

/**
 * The factory scene in 1920 × 1080 design coordinates. One scale variable shrinks
 * the whole scene inside the viewport, so the layered art always lines up.
 */
export function Stage({ fleet, tempUnit, onSelectUnit, rootRef }: StageProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
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
    <main className="factory-stage" ref={rootRef}>
      <div
        className="factory-stage__inner"
        style={{ "--factory-scale": scale } as CSSProperties}
      >
        <img className="factory-bg" src={bgFactory} alt="" aria-hidden="true" />
        <div className={`factory-floor factory-floor--cols-${columns}`}>
          {ordered.map((unit, index) => (
            <SparkUnit
              key={unit.id}
              unit={unit}
              index={index + 1}
              tempUnit={tempUnit}
              onSelect={onSelectUnit}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
