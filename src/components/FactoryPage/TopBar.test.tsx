import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n";
import { makeSpark } from "../../testing/fixtures";
import { cleanupRenders, render } from "../../testing/render";
import { factoryFleet } from "./factoryModel";
import { ThermalCard } from "./ThermalCard";
import { TopBar } from "./TopBar";

const noop = () => {};

const fleet = () => factoryFleet([makeSpark("a")]);

describe("TopBar", () => {
  beforeEach(async () => {
    await setLocale("en");
  });
  afterEach(() => cleanupRenders());

  it("keeps the last values and names their age when the snapshot goes stale", () => {
    const { container } = render(
      <TopBar
        fleet={fleet()}
        connected={false}
        lastValidSnapshotAt={Date.now() - 600_000}
        refreshInterval={2_000}
        tempUnit="celsius"
        paused={false}
        preview={false}
        onTogglePause={noop}
        onTogglePreview={noop}
        onOpenThermals={noop}
        onOpenTrend={noop}
        onToggleFullscreen={noop}
        onBack={noop}
      />,
    );
    expect(container.textContent).toMatch(/Data from/);
    expect(container.textContent).toContain("20.0");
  });

  it("shows an unknown rate as a dash, never as a measured zero", () => {
    const unmeasured = makeSpark("a");
    unmeasured.metrics.llm[0].measurementValid = false;
    const { container } = render(
      <TopBar
        fleet={factoryFleet([unmeasured])}
        connected
        lastValidSnapshotAt={Date.now()}
        refreshInterval={2_000}
        tempUnit="celsius"
        paused={false}
        preview={false}
        onTogglePause={noop}
        onTogglePreview={noop}
        onOpenThermals={noop}
        onOpenTrend={noop}
        onToggleFullscreen={noop}
        onBack={noop}
      />,
    );
    expect(container.textContent).not.toContain("0.0");
    expect(container.textContent).toContain("—");
  });

  it("offers a visible way back to the dashboard, not only the Esc key", () => {
    const onBack = vi.fn();
    const { container } = render(
      <TopBar
        fleet={fleet()}
        connected
        lastValidSnapshotAt={Date.now()}
        refreshInterval={2_000}
        tempUnit="celsius"
        paused={false}
        preview={false}
        onTogglePause={noop}
        onTogglePreview={noop}
        onOpenThermals={noop}
        onOpenTrend={noop}
        onToggleFullscreen={noop}
        onBack={onBack}
      />,
    );
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Overview"));
    expect(button).toBeTruthy();
    button?.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("ThermalCard", () => {
  beforeEach(async () => {
    await setLocale("en");
  });
  afterEach(() => cleanupRenders());

  it("hides the fan line when no card reports one", () => {
    const f = { ...fleet(), fanPctAvg: null };
    const { container } = render(<ThermalCard fleet={f} tempUnit="celsius" onExpand={noop} />);
    expect(container.textContent).not.toMatch(/Fan/);
  });
});
