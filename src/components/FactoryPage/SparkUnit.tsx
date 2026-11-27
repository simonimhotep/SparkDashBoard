import { useTranslation } from "react-i18next";
import { formatTemperature } from "../../shared/fleetExceptions";
import armBase from "./assets/arm-base.png";
import armFore from "./assets/arm-fore.png";
import armUpper from "./assets/arm-upper.png";
import joystick from "./assets/joystick.png";
import unitBody from "./assets/unit-body.webp";
import type { FactoryUnit } from "./factoryModel";

interface SparkUnitProps {
  unit: FactoryUnit;
  /** 1-based station number shown on the LCD. */
  index: number;
  tempUnit: "celsius" | "fahrenheit";
  onSelect: (id: string) => void;
}

/** One workstation: the DGX body, its LCD readout, the joystick and the role plate. */
export function SparkUnit({ unit, index, tempUnit, onSelect }: SparkUnitProps) {
  const { t } = useTranslation("factory");
  const roleLabel =
    unit.station === "worker"
      ? t("workerOf", { name: unit.modelText ?? "—" })
      : t(unit.station === "head" ? "roleHead" : "roleStandalone");
  const pct = unit.gpuPct === null ? "—" : `${Math.round(unit.gpuPct)}%`;
  const temp = unit.gpuTempC === null ? "—" : formatTemperature(unit.gpuTempC, tempUnit);
  const classes = [
    "factory-unit",
    unit.station === "head" ? "is-head" : "",
    unit.online ? "" : "is-offline",
    unit.hotspot ? "is-hot" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      role="button"
      tabIndex={0}
      aria-label={`${roleLabel} · ${unit.name}`}
      onClick={() => onSelect(unit.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(unit.id);
        }
      }}
    >
      <img className="factory-unit__body" src={unitBody} alt="" aria-hidden="true" />

      <div className="factory-unit__arm" aria-hidden="true">
        <img className="factory-unit__arm-base" src={armBase} alt="" />
        <img className="factory-unit__arm-upper" src={armUpper} alt="" />
        <img className="factory-unit__arm-fore" src={armFore} alt="" />
      </div>

      <div className="factory-unit__lcd">
        <span className="factory-unit__tag">#{String(index).padStart(2, "0")}</span>
        <span className="factory-unit__model">{unit.modelText ?? t("noLlm")}</span>
        <span className="factory-unit__metrics">
          <span className="factory-unit__metric">{pct}</span>
          <span className="factory-unit__metric">{temp}</span>
          {unit.station !== "worker" && (
            <span className="factory-unit__metric">
              {unit.decodeTps === null ? "—" : unit.decodeTps.toFixed(1)} {t("tokPerSec")}
            </span>
          )}
        </span>
      </div>

      <div className="factory-unit__joystick" aria-hidden="true">
        <img src={joystick} alt="" />
        <span className={`factory-unit__led${unit.online ? " is-on" : ""}`} />
        <span className={`factory-unit__led${unit.activeStreams ? " is-on" : ""}`} />
        <span className={`factory-unit__led${unit.hotspot ? " is-hot" : ""}`} />
      </div>

      <div className="factory-unit__plate">
        <span className="factory-unit__role">{roleLabel}</span>
        <span className="factory-unit__name">{unit.name}</span>
        {unit.online ? null : (
          <span className="factory-unit__offline">
            {t("offline")}
            {unit.offlineReason ? ` · ${unit.offlineReason}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
