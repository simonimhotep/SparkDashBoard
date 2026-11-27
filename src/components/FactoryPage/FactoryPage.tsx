import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchSettings } from "../../api/client";
import type { Settings } from "../../api/types";
import { idToPath, OVERVIEW_ID } from "../../constants";
import { useSnapshot } from "../../hooks/useSnapshot";
import { factoryFleet } from "./factoryModel";
import { Stage } from "./Stage";
import { ThermalCard } from "./ThermalCard";
import { ThermalSheet } from "./ThermalSheet";
import { TopBar } from "./TopBar";
import { TrendDrawer } from "./TrendDrawer";
import "../../styles/factory.css";

/**
 * /factory — the Token Factory stage. Rendered outside the dashboard shell
 * (useAppRoute), like /kiosk: the fleet's telemetry drives one animated scene.
 */
export function FactoryPage() {
  const { t } = useTranslation("factory");
  const { sparks, connected, lastValidSnapshotAt, refreshInterval } = useSnapshot();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [paused, setPaused] = useState(false);
  const [preview, setPreview] = useState(false);
  const [thermalsOpen, setThermalsOpen] = useState(false);
  const [trendIds, setTrendIds] = useState<string[] | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fleet = useMemo(() => factoryFleet(sparks), [sparks]);
  const tempUnit = settings?.temperatureUnit === "fahrenheit" ? "fahrenheit" : "celsius";
  const trendUnits = trendIds === null ? null : fleet.units.filter((u) => trendIds.includes(u.id));

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

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    const root = document.documentElement;
    if (root.requestFullscreen) void root.requestFullscreen().catch(() => {});
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
      <TopBar
        fleet={fleet}
        connected={connected}
        lastValidSnapshotAt={lastValidSnapshotAt}
        refreshInterval={refreshInterval}
        tempUnit={tempUnit}
        paused={paused}
        preview={preview}
        onTogglePause={() => setPaused((v) => !v)}
        onTogglePreview={() => setPreview((v) => !v)}
        onOpenThermals={() => setThermalsOpen(true)}
        onOpenTrend={() => setTrendIds(fleet.units.map((u) => u.id))}
        onToggleFullscreen={toggleFullscreen}
      />
      <div className="factory-body">
        <Stage
          fleet={fleet}
          tempUnit={tempUnit}
          onSelectUnit={(id) => setTrendIds([id])}
          rootRef={stageRef}
          paused={paused}
          preview={preview}
        />
        <ThermalCard fleet={fleet} tempUnit={tempUnit} onExpand={() => setThermalsOpen(true)} />
      </div>
      <ThermalSheet
        units={thermalsOpen ? fleet.units : null}
        tempUnit={tempUnit}
        onClose={() => setThermalsOpen(false)}
      />
      <TrendDrawer units={trendUnits} onClose={() => setTrendIds(null)} />
    </div>
  );
}
