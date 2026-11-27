import { useTranslation } from "react-i18next";
import { formatTemperature } from "../../shared/fleetExceptions";
import armBase from "./assets/arm-base.webp";
import armFore from "./assets/arm-fore.webp";
import armUpper from "./assets/arm-upper.webp";
import canopy from "./assets/canopy.webp";
import joystick from "./assets/joystick.webp";
import unitBody from "./assets/unit-body.webp";
import type { FactoryUnit } from "./factoryModel";
import { WhaleOperator, type WhaleState } from "./WhaleOperator";

interface SparkUnitProps {
  unit: FactoryUnit;
  /** 1-based station number shown on the LCD. */
  index: number;
  tempUnit: "celsius" | "fahrenheit";
  /** Cluster intensity: the whole line moves even where no local endpoint runs. */
  intensity: number;
  onSelect: (id: string) => void;
}

/** One workstation: the DGX body, its LCD readout, the joystick and the role plate. */
export function SparkUnit({ unit, index, tempUnit, intensity, onSelect }: SparkUnitProps) {
  const { t } = useTranslation("factory");
  const roleLabel =
    unit.station === "worker"
      ? t("workerOf", { name: unit.modelText ?? "—" })
      : unit.station === "head"
        ? t("roleHead")
        : t("roleStandalone");
  const pct = unit.gpuPct === null ? "—" : `${Math.round(unit.gpuPct)}%`;
  const temp = unit.gpuTempC === null ? "—" : formatTemperature(unit.gpuTempC, tempUnit);
  const modelLabel =
    unit.modelText ??
    (unit.note === "headOffline"
      ? t("headOffline")
      : unit.note === "headApiNotReady"
        ? t("headApiNotReady")
        : unit.note === "noHeadPort"
          ? t("noHeadPort")
          : unit.note === "noLocalInference"
            ? t("noLocalInference")
            : t("noLlm"));
  const hasOperator = unit.online && (unit.station === "worker" || unit.modelText !== null);
  const whaleState: WhaleState = unit.hotspot
    ? "sweat"
    : intensity > 0.05 && (unit.decodeTps === null || unit.decodeTps > 0)
      ? "typing"
      : "idle";
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
        <div className="factory-unit__arm-boom">
          <img className="factory-unit__arm-upper" src={armUpper} alt="" />
          <div className="factory-unit__arm-stick">
            <img className="factory-unit__arm-fore" src={armFore} alt="" />
          </div>
        </div>
      </div>

      <div className="factory-unit__lcd">
        <span className="factory-unit__tag">#{String(index).padStart(2, "0")}</span>
        <span className="factory-unit__model">{modelLabel}</span>
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

      <div className="factory-unit__cab" aria-hidden="true">
        {hasOperator ? (
          <div className="factory-unit__whale">
            <WhaleOperator state={whaleState} />
          </div>
        ) : null}
        <img className="factory-unit__canopy" src={canopy} alt="" />
      </div>

      <span className="factory-unit__nameplate" aria-hidden="true">
        {unit.id}
      </span>

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
