import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n";
import { cleanupRenders, flush, render } from "../../testing/render";
import { getUnitHistory } from "../../api/client";
import type { FactoryUnit } from "./factoryModel";
import { TrendDrawer } from "./TrendDrawer";

vi.mock("../../api/client", () => ({
  getUnitHistory: vi.fn(() => Promise.resolve({ enabled: false })),
}));

const mocked = vi.mocked(getUnitHistory);

const unit = (over: Partial<FactoryUnit> = {}): FactoryUnit => ({
  id: "spark-1",
  name: "Spark spark-1",
  online: true,
  offlineReason: null,
  station: "standalone",
  modelText: "fixture-model",
  modelMuted: false,
  note: null,
  decodeTps: 20,
  activeStreams: 1,
  gpuPct: 42,
  gpuTempC: 55,
  gpuW: 50,
  hotspot: false,
  ...over,
});

function history() {
  const to = Date.now();
  const stepMs = 60_000;
  const points = Array.from({ length: 30 }, (_, i) => ({
    t: to - (29 - i) * stepMs,
    gpuUtil: { avg: 40 + i, max: 80 },
  }));
  return {
    enabled: true,
    range: "1h",
    stepMs,
    from: to - 29 * stepMs,
    to,
    points,
    llm: [
      {
        port: 8888,
        points: points.map((p, i) => ({ t: p.t, genTps: { avg: 10 + i, max: 30 } })),
      },
    ],
  };
}

describe("TrendDrawer", () => {
  beforeEach(async () => {
    await setLocale("en");
    mocked.mockReset();
    mocked.mockResolvedValue({ enabled: false });
  });
  afterEach(() => cleanupRenders());

  it("says there is no history instead of drawing an empty chart", async () => {
    const { container } = render(<TrendDrawer units={[unit()]} onClose={() => {}} />);
    await flush();
    expect(container.textContent).toContain("No history yet");
  });

  it("draws a GPU line and a separately scaled token line per unit", async () => {
    mocked.mockResolvedValue(history() as never);
    const { container } = render(<TrendDrawer units={[unit()]} onClose={() => {}} />);
    await flush();

    expect(container.textContent).toContain("Last 30 minutes");
    expect(container.textContent).toContain("Spark spark-1");
    const gpu = container.querySelector(".factory-trend__gpu")?.getAttribute("d") ?? "";
    const gen = container.querySelector(".factory-trend__gen")?.getAttribute("d") ?? "";
    expect(gpu).toMatch(/^M/);
    expect(gen).toMatch(/^M/);
    expect(gpu).not.toBe(gen);
    expect(container.textContent).toMatch(/\d+ tok\/s/);
  });

  it("renders nothing while it is closed", () => {
    const { container } = render(<TrendDrawer units={null} onClose={() => {}} />);
    expect(container.textContent).toBe("");
  });
});
