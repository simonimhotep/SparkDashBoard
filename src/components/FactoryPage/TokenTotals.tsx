import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchLlmTokenTotals } from "../../api/llmTokenClient";
import type { LlmTokenSeriesTotals } from "../../api/llmTokenTypes";
import { formatTokensCompact } from "../../shared/tokenFormat";

const POLL_MS = 60_000;

interface Totals {
  prompt: number;
  completion: number;
  cached: number;
  unreported: number;
  /** False when no series said it measured its cache: cached/computed stay unknown. */
  cacheKnown: boolean;
}

/** The cumulative rows are only trustworthy once every reporting series agreed. */
function notAllReported(series: ReadonlyArray<LlmTokenSeriesTotals>): boolean {
  return series.some((s) => s.totals?.cacheReported === false);
}

export function sumTokenTotals(series: ReadonlyArray<LlmTokenSeriesTotals>): Totals | null {
  if (series.length === 0) return null;
  let prompt = 0;
  let completion = 0;
  let cached = 0;
  let unreported = 0;
  for (const s of series) {
    const totals = s.totals;
    if (!totals) continue;
    prompt += totals.promptTokens ?? 0;
    completion += totals.completionTokens ?? 0;
    cached += totals.cachedTokens ?? 0;
    unreported += totals.unreportedPromptTokens ?? 0;
  }
  return { prompt, completion, cached, unreported, cacheKnown: !notAllReported(series) };
}

/**
 * Cumulative fleet tokens from `GET /api/llm-token-totals?range=all`. The card keeps
 * its last values when a poll fails; an unknown figure shows as "—", never as zero.
 */
export function TokenTotals() {
  const { t } = useTranslation("factory");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchLlmTokenTotals("all")
        .then((res) => {
          if (!cancelled) setTotals(sumTokenTotals(res.series));
        })
        .catch(() => {
          /* keep the last totals */
        });
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const fmt = (n: number | undefined) => (typeof n === "number" ? formatTokensCompact(n) : "—");
  const computed = totals ? Math.max(0, totals.prompt - totals.cached - totals.unreported) : undefined;

  return (
    <div className="factory-totals">
      <div className="factory-totals__row">
        <span className="factory-totals__label">{t("totalOut")}</span>
        <strong className="factory-totals__value">{fmt(totals?.completion)}</strong>
      </div>
      <button
        type="button"
        className="factory-totals__row factory-totals__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="factory-totals__label">{t("totalIn")}</span>
        <strong className="factory-totals__value">{fmt(totals?.prompt)}</strong>
      </button>
      {open ? (
        <div className="factory-totals__detail">
          <div className="factory-totals__row">
            <span className="factory-totals__label">{t("cached")}</span>
            <span className="factory-totals__value">{totals?.cacheKnown ? fmt(totals.cached) : "—"}</span>
          </div>
          <div className="factory-totals__row">
            <span className="factory-totals__label">{t("computed")}</span>
            <span className="factory-totals__value">
              {totals?.cacheKnown ? fmt(computed) : "—"}
            </span>
          </div>
          <div className="factory-totals__row">
            <span className="factory-totals__label">{t("unreported")}</span>
            <span className="factory-totals__value">
              {totals?.cacheKnown ? fmt(totals.unreported) : "—"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
