import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useOverlayClose } from "../../hooks/useOverlayClose";
import { formatTemperature } from "../../shared/fleetExceptions";
import type { FactoryUnit } from "./factoryModel";

interface ThermalSheetProps {
  /** Null keeps the sheet closed. */
  units: FactoryUnit[] | null;
  tempUnit: "celsius" | "fahrenheit";
  onClose: () => void;
}

/** Per-unit temperature, power and throttle state, in the same right-slide drawer as the trend. */
export function ThermalSheet({ units, tempUnit, onClose }: ThermalSheetProps) {
  const { t } = useTranslation("factory");
  const overlay = useOverlayClose(onClose, units !== null);

  useEffect(() => {
    if (units === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [units, onClose]);

  if (units === null) return null;

  return (
    <div className="factory-sheet" {...overlay}>
      <aside className="factory-sheet__panel" role="dialog" aria-modal="true" aria-label={t("thermals")}>
        <header className="factory-sheet__head">
          <h2 className="factory-sheet__title">{t("thermals")}</h2>
          <button type="button" className="factory-btn" onClick={onClose}>
            {t("trendClose")}
          </button>
        </header>
        <ul className="factory-sheet__list">
          {units.map((unit) => (
            <li key={unit.id} className="factory-sheet__row">
              <div className="factory-sheet__unit">
                <span className="factory-sheet__name">{unit.name}</span>
                <span className="factory-sheet__role">
                  {unit.station === "worker"
                    ? t("workerOf", { name: unit.modelText ?? "—" })
                    : unit.station === "head"
                      ? t("roleHead")
                      : t("roleStandalone")}
                </span>
              </div>
              <div className="factory-sheet__metrics">
                <span className="factory-sheet__metric">
                  {unit.gpuTempC === null ? "—" : formatTemperature(unit.gpuTempC, tempUnit)}
                </span>
                <span className="factory-sheet__metric">
                  {unit.gpuW === null ? "—" : `${Math.round(unit.gpuW)} W`}
                </span>
                <span className={`factory-sheet__state${unit.hotspot ? " is-hot" : ""}`}>
                  {unit.hotspot ? t("throttled") : unit.online ? t("statusRunning") : t("offline")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
