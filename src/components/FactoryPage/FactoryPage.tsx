import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchSettings } from "../../api/client";
import type { Settings } from "../../api/types";
import { idToPath, OVERVIEW_ID } from "../../constants";
import { useSnapshot } from "../../hooks/useSnapshot";
import { factoryFleet, isSnapshotStale } from "./factoryModel";
import { Stage } from "./Stage";
import { ThermalCard } from "./ThermalCard";
import { ThermalSheet } from "./ThermalSheet";
import { TopBar } from "./TopBar";
import { TrendDrawer } from "./TrendDrawer";
import "../../styles/factory.css";

const CURSOR_IDLE_MS = 3_000;

/** Re-render only when the answer flips, not once a second. */
function useSnapshotStale(
  connected: boolean,
  lastValidSnapshotAt: number | null,
  refreshInterval: number | null,
): boolean {
  const [stale, setStale] = useState(() =>
    isSnapshotStale(connected, lastValidSnapshotAt, refreshInterval, Date.now()),
  );
  useEffect(() => {
    const read = () => isSnapshotStale(connected, lastValidSnapshotAt, refreshInterval, Date.now());
    setStale(read());
    const timer = window.setInterval(() => {
      setStale((prev) => {
        const next = read();
        return prev === next ? prev : next;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [connected, lastValidSnapshotAt, refreshInterval]);
  return stale;
}

/** Hide the cursor after a few seconds without movement, as the kiosk wall does. */
function useCursorActive(): boolean {
  const [active, setActive] = useState(true);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const poke = () => {
      setActive(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setActive(false), CURSOR_IDLE_MS);
    };
    poke();
    window.addEventListener("mousemove", poke);
    window.addEventListener("touchstart", poke);
    return () => {
      window.removeEventListener("mousemove", poke);
      window.removeEventListener("touchstart", poke);
      window.clearTimeout(timer.current);
    };
  }, []);
  return active;
}

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
  const stale = useSnapshotStale(connected, lastValidSnapshotAt, refreshInterval);
  const cursorActive = useCursorActive();

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

  // Esc backs out of the wall: an open sheet closes itself first, fullscreen belongs
  // to the browser, and otherwise the wall returns to the overview.
  useEffect(() => {
    if (sparks.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (thermalsOpen || trendIds !== null || document.fullscreenElement) return;
      window.location.assign(idToPath(OVERVIEW_ID));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sparks.length, thermalsOpen, trendIds]);

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
    <div className={`factory${cursorActive ? "" : " is-idle"}`}>
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
        onOpenThermals={() => {
          setTrendIds(null);
          setThermalsOpen(true);
        }}
        onOpenTrend={() => {
          setThermalsOpen(false);
          setTrendIds(fleet.units.map((u) => u.id));
        }}
        onToggleFullscreen={toggleFullscreen}
      />
      <div className="factory-body">
        <Stage
          fleet={fleet}
          tempUnit={tempUnit}
          onSelectUnit={(id) => {
            setThermalsOpen(false);
            setTrendIds([id]);
          }}
          rootRef={stageRef}
          paused={paused}
          preview={preview}
          stale={stale}
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
