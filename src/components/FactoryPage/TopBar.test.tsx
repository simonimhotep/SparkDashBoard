import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
      />,
    );
    expect(container.textContent).toMatch(/Data from/);
    expect(container.textContent).toContain("20.0");
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
