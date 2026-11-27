import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatTemperature } from "../../shared/fleetExceptions";
import type { FactoryFleet } from "./factoryModel";
import { TokenTotals } from "./TokenTotals";

interface TopBarProps {
  fleet: FactoryFleet;
  connected: boolean;
  lastValidSnapshotAt: number | null;
  refreshInterval: number | null;
  tempUnit: "celsius" | "fahrenheit";
  paused: boolean;
  preview: boolean;
  onTogglePause: () => void;
  onTogglePreview: () => void;
  onOpenThermals: () => void;
  onOpenTrend: () => void;
  onToggleFullscreen: () => void;
}

function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function useFullscreenActive(): boolean {
  const [active, setActive] = useState(() => document.fullscreenElement !== null);
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return active;
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * The factory's top strip: title, fleet status, the four glance figures on the right and
 * the controls. When a snapshot stops arriving it keeps the last numbers and names their
 * age instead of blanking the line.
 */
export function TopBar({
  fleet,
  connected,
  lastValidSnapshotAt,
  refreshInterval,
  tempUnit,
  paused,
  preview,
  onTogglePause,
  onTogglePreview,
  onOpenThermals,
  onOpenTrend,
  onToggleFullscreen,
}: TopBarProps) {
  const { t } = useTranslation("factory");
  const now = useClock();
  const fullscreen = useFullscreenActive();

  const age = lastValidSnapshotAt === null ? null : now - lastValidSnapshotAt;
  const staleLimit = refreshInterval !== null && refreshInterval > 0 ? refreshInterval * 3 : null;
  const stale = !connected || (age !== null && staleLimit !== null && age > staleLimit);

  let status: string;
  if (lastValidSnapshotAt === null) status = t("statusConnecting");
  else if (stale) status = t("statusStale", { time: timeLabel(lastValidSnapshotAt) });
  else if (fleet.decodeTps <= 0) status = t("statusIdle");
  else status = t("statusRunning");

  const speed = fleet.decodeTps.toFixed(1);
  const streams = fleet.activeStreams === null ? "—" : String(fleet.activeStreams);
  const queued = fleet.queued === null ? "—" : String(fleet.queued);
  const peak = fleet.peakTempC === null ? "—" : formatTemperature(fleet.peakTempC, tempUnit);

  return (
    <header className="factory-topbar">
      <div className="factory-topbar__brand">
        <h1 className="factory-topbar__title">{t("title")}</h1>
        {preview ? <span className="factory-topbar__demo">{t("demoBadge")}</span> : null}
      </div>

      <div className="factory-topbar__status">
        <span className={`factory-topbar__dot${connected ? " is-live" : ""}`} aria-hidden="true" />
        <span className="factory-topbar__online">
          {t("online", { online: fleet.online, total: fleet.total })}
        </span>
        <span className={`factory-topbar__note${stale ? " is-stale" : ""}`}>{status}</span>
        <span className="factory-topbar__clock">{new Date(now).toLocaleTimeString([], { hour12: false })}</span>
      </div>

      <div className="factory-topbar__kpis">
        <span className="factory-kpi">
          <strong className="factory-kpi__value">{speed}</strong>
          <span className="factory-kpi__label">{t("tokPerSec")}</span>
        </span>
        <span className="factory-kpi">
          <strong className="factory-kpi__value">{streams}</strong>
          <span className="factory-kpi__label">{t("activeStreams")}</span>
        </span>
        <span className="factory-kpi">
          <strong className="factory-kpi__value">{queued}</strong>
          <span className="factory-kpi__label">{t("queued")}</span>
        </span>
        <span className="factory-kpi">
          <strong className="factory-kpi__value">{peak}</strong>
          <span className="factory-kpi__label">{t("peakTemp")}</span>
        </span>
      </div>

      <TokenTotals />

      <div className="factory-topbar__actions">
        <button
          type="button"
          className="factory-btn"
          aria-pressed={paused}
          onClick={onTogglePause}
        >
          <span aria-hidden="true">{paused ? "▶" : "⏸"}</span> {paused ? t("resume") : t("pause")}
        </button>
        <button
          type="button"
          className="factory-btn"
          aria-pressed={preview}
          onClick={onTogglePreview}
        >
          <span aria-hidden="true">{preview ? "■" : "▶"}</span>{" "}
          {preview ? t("stopPreview") : t("preview")}
        </button>
        <button type="button" className="factory-btn" onClick={onOpenThermals}>
          {t("thermals")}
        </button>
        <button type="button" className="factory-btn" onClick={onOpenTrend}>
          {t("trend")}
        </button>
        <button type="button" className="factory-btn" onClick={onToggleFullscreen}>
          <span aria-hidden="true">⛶</span> {fullscreen ? t("exitFullscreen") : t("fullscreen")}
        </button>
      </div>
    </header>
  );
}
