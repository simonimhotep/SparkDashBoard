import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getUnitHistory } from "../../api/client";
import type { MetricsHistoryRange } from "../../api/types";
import { useOverlayClose } from "../../hooks/useOverlayClose";
import { smoothPath, tracesFromHistory } from "../KioskPage/kioskModel";
import { forEachLimited } from "../KioskPage/useKioskTraces";
import type { FactoryUnit } from "./factoryModel";

const RANGE: MetricsHistoryRange = "1h";
const W = 320;
const H = 108;
const PAD = 6;

interface TrendSeries {
  id: string;
  name: string;
  gpu: Array<number | null>;
  gen: Array<number | null>;
}

function lastKnown(values: ReadonlyArray<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i];
    if (v !== null) return v;
  }
  return null;
}

function genScale(values: ReadonlyArray<number | null>): number {
  const known = values.filter((v): v is number => v !== null);
  return Math.max(1, Math.ceil(Math.max(0, ...known)));
}

/** The 30-minute trace in chart coordinates; null keeps its gap. */
function pathFor(values: ReadonlyArray<number | null>, scale: number): string {
  const step = values.length <= 1 ? 0 : (W - PAD * 2) / (values.length - 1);
  return smoothPath(
    values.map((v, i) =>
      v === null
        ? null
        : ([PAD + i * step, H - PAD - Math.min(1, v / scale) * (H - PAD * 2)] as const),
    ),
  );
}

interface TrendDrawerProps {
  /** Null keeps the drawer closed; one unit draws its own trend, several draw the fleet's. */
  units: FactoryUnit[] | null;
  onClose: () => void;
}

/**
 * A right-slide drawer with one 30-minute chart per unit: GPU% as a solid line, generation
 * tokens/s on its own scale as a dashed one. History comes from the server store, so a unit
 * that kept no history shows the empty note rather than a flat line at zero.
 */
export function TrendDrawer({ units, onClose }: TrendDrawerProps) {
  const { t } = useTranslation("factory");
  const overlay = useOverlayClose(onClose, units !== null);
  const [rows, setRows] = useState<TrendSeries[] | null>(null);
  const key = units === null ? "" : units.map((u) => u.id).join("|");

  useEffect(() => {
    if (!units) return;
    let cancelled = false;
    setRows(null);
    const collected: TrendSeries[] = [];
    void forEachLimited(units, 4, async (unit) => {
      try {
        const history = await getUnitHistory(unit.id, RANGE);
        if (history.enabled === false) return;
        const traces = tracesFromHistory(
          history.points,
          history.llm,
          history.stepMs,
          Date.now(),
        );
        if (lastKnown(traces.gpu) === null && lastKnown(traces.gen) === null) return;
        collected.push({ id: unit.id, name: unit.name, gpu: traces.gpu, gen: traces.gen });
      } catch {
        /* one unit's failed fetch leaves its row out; the others still draw */
      }
    }).then(() => {
      if (!cancelled) setRows(collected);
    });
    return () => {
      cancelled = true;
    };
    // Refetch when the set of units changes, not on every two-second snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (units === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [units, onClose]);

  if (units === null) return null;

  const title = units.length > 1 ? t("trendFleet") : t("trendTitle");

  return (
    <div className="factory-sheet" {...overlay}>
      <aside className="factory-sheet__panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="factory-sheet__head">
          <h2 className="factory-sheet__title">{title}</h2>
          <button type="button" className="factory-btn" onClick={onClose}>
            {t("trendClose")}
          </button>
        </header>
        {rows === null ? null : rows.length === 0 ? (
          <p className="factory-trend__empty">{t("trendNoHistory")}</p>
        ) : (
          <ul className="factory-trend__list">
            {rows.map((row) => {
              const gpu = lastKnown(row.gpu);
              const gen = lastKnown(row.gen);
              return (
                <li key={row.id} className="factory-trend">
                  <div className="factory-trend__head">
                    <span className="factory-trend__name">{row.name}</span>
                    <span className="factory-trend__legend">
                      <span className="factory-trend__key is-gpu">
                        GPU {gpu === null ? "—" : `${Math.round(gpu)}%`}
                      </span>
                      <span className="factory-trend__key is-gen">
                        {gen === null ? "—" : `${gen.toFixed(1)} ${t("tokPerSec")}`}
                      </span>
                    </span>
                  </div>
                  <svg
                    className="factory-trend__chart"
                    viewBox={`0 0 ${W} ${H}`}
                    role="img"
                    aria-label={row.name}
                  >
                    <path className="factory-trend__gpu" d={pathFor(row.gpu, 100)} />
                    <path className="factory-trend__gen" d={pathFor(row.gen, genScale(row.gen))} />
                  </svg>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
