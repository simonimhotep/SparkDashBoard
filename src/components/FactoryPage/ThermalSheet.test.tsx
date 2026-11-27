import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n";
import { cleanupRenders, render } from "../../testing/render";
import type { FactoryUnit } from "./factoryModel";
import { ThermalSheet } from "./ThermalSheet";

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

describe("ThermalSheet", () => {
  beforeEach(async () => {
    await setLocale("en");
  });
  afterEach(() => {
    cleanupRenders();
    vi.restoreAllMocks();
  });

  it("lists every unit's temperature, power and throttle state", () => {
    const hot = unit({ id: "h", name: "Spark hot", hotspot: true });
    const { container } = render(
      <ThermalSheet units={[unit(), hot]} tempUnit="celsius" onClose={() => {}} />,
    );
    expect(container.textContent).toContain("Spark hot");
    expect(container.textContent).toContain("55°C");
    expect(container.textContent).toContain("50 W");
    expect(container.textContent).toContain("Thermal throttle");
  });

  it("takes focus into the dialog and gives it back on close", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "open";
    document.body.append(trigger);
    trigger.focus();

    const { root } = render(<ThermalSheet units={[unit()]} tempUnit="celsius" onClose={() => {}} />);
    expect(document.activeElement?.textContent).toBe("Close");

    act(() => root.render(<ThermalSheet units={null} tempUnit="celsius" onClose={() => {}} />));
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
