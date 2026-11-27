import { useTranslation } from "react-i18next";
import { formatTemperature } from "../../shared/fleetExceptions";
import type { FactoryFleet } from "./factoryModel";

interface ThermalCardProps {
  fleet: FactoryFleet;
  tempUnit: "celsius" | "fahrenheit";
  onExpand: () => void;
}

/**
 * The read-only thermal card: peak temperature, total GPU power and how many units
 * throttle thermally. A fan row appears only when a card actually reports fan duty;
 * power caps and hardware slowdowns are weak tags, never counted as thermal throttling.
 */
export function ThermalCard({ fleet, tempUnit, onExpand }: ThermalCardProps) {
  const { t } = useTranslation("factory");
  const peak = fleet.peakTempC === null ? "—" : formatTemperature(fleet.peakTempC, tempUnit);

  return (
    <button type="button" className="factory-thermal" onClick={onExpand}>
      <span className="factory-thermal__head">{t("thermals")}</span>
      <span className="factory-thermal__rows">
        <span className="factory-thermal__row">
          <span className="factory-thermal__label">{t("peakTemp")}</span>
          <strong className="factory-thermal__value">{peak}</strong>
        </span>
        <span className="factory-thermal__row">
          <span className="factory-thermal__label">{t("power")}</span>
          <strong className="factory-thermal__value">
            {fleet.powerW === null ? "—" : `${Math.round(fleet.powerW)} W`}
          </strong>
        </span>
        <span className="factory-thermal__row">
          <span className="factory-thermal__label">{t("throttled")}</span>
          <strong className="factory-thermal__value">{fleet.thermalThrottled}</strong>
        </span>
        {fleet.fanPctAvg === null ? null : (
          <span className="factory-thermal__row">
            <span className="factory-thermal__label">{t("fan")}</span>
            <strong className="factory-thermal__value">{Math.round(fleet.fanPctAvg)}%</strong>
          </span>
        )}
      </span>
      {fleet.powerCapped > 0 || fleet.hardwareSlowdowns > 0 ? (
        <span className="factory-thermal__tags">
          {fleet.powerCapped > 0 ? (
            <span className="factory-thermal__tag">
              {t("powerCapped")} {fleet.powerCapped}
            </span>
          ) : null}
          {fleet.hardwareSlowdowns > 0 ? (
            <span className="factory-thermal__tag">
              {t("hwSlowdown")} {fleet.hardwareSlowdowns}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
