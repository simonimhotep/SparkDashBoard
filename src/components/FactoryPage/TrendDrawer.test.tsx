import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n";
import { cleanupRenders, flush, render } from "../../testing/render";
import type { FactoryUnit } from "./factoryModel";
import { TrendDrawer } from "./TrendDrawer";

vi.mock("../../api/client", () => ({
  getUnitHistory: () => Promise.resolve({ enabled: false }),
}));

const unit = (over: Partial<FactoryUnit> = {}): FactoryUnit => ({
  id: "spark-1",
  name: "Spark spark-1",
  online: true,
  offlineReason: null,
  station: "standalone",
  modelText: "fixture-model",
  modelMuted: false,
  decodeTps: 20,
  activeStreams: 1,
  gpuPct: 42,
  gpuTempC: 55,
  gpuW: 50,
  hotspot: false,
  ...over,
});

describe("TrendDrawer", () => {
  beforeEach(async () => {
    await setLocale("en");
  });
  afterEach(() => cleanupRenders());

  it("says there is no history instead of drawing an empty chart", async () => {
    const { container } = render(<TrendDrawer units={[unit()]} onClose={() => {}} />);
    await flush();
    expect(container.textContent).toContain("No history yet");
  });

  it("renders nothing while it is closed", () => {
    const { container } = render(<TrendDrawer units={null} onClose={() => {}} />);
    expect(container.textContent).toBe("");
  });
});
