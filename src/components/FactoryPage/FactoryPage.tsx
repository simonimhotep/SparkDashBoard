import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchSettings } from "../../api/client";
import type { Settings } from "../../api/types";
import { idToPath, OVERVIEW_ID } from "../../constants";
import { useSnapshot } from "../../hooks/useSnapshot";
import { factoryFleet } from "./factoryModel";
import { Stage } from "./Stage";
import "../../styles/factory.css";

/**
 * /factory — the Token Factory stage. Rendered outside the dashboard shell
 * (useAppRoute), like /kiosk: the fleet's telemetry drives one animated scene.
 */
export function FactoryPage() {
  const { t } = useTranslation("factory");
  const { sparks } = useSnapshot();
  const [settings, setSettings] = useState<Settings | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fleet = useMemo(() => factoryFleet(sparks), [sparks]);
  const tempUnit = settings?.temperatureUnit === "fahrenheit" ? "fahrenheit" : "celsius";

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch(() => {
        /* keep the last settings */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (sparks.length === 0) {
    return (
      <div className="factory factory--empty">
        <div className="factory-empty">
          <h1 className="factory-empty__title">{t("title")}</h1>
          <p className="factory-empty__head">{t("emptyTitle")}</p>
          <p className="factory-empty__body">{t("emptyBody")}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.assign(idToPath(OVERVIEW_ID))}
          >
            {t("addDevice")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="factory">
      <header className="factory-topbar">
        <h1 className="factory-topbar__title">{t("title")}</h1>
      </header>
      <Stage fleet={fleet} tempUnit={tempUnit} onSelectUnit={() => {}} rootRef={stageRef} />
    </div>
  );
}
