import { setLocale } from "../../i18n";
import type { SparkSnapshot } from "../../api/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupRenders, flush, render } from "../../testing/render";
import { FactoryPage } from "./FactoryPage";

let sparks: SparkSnapshot[] = [];

vi.mock("../../hooks/useSnapshot", () => ({
  useSnapshot: () => ({
    sparks,
    connected: true,
    lastValidSnapshotAt: Date.now(),
    refreshInterval: 2_000,
    serverAlerts: null,
  }),
}));

vi.mock("../../api/client", () => ({
  fetchSettings: () => Promise.resolve({ temperatureUnit: "celsius" }),
  getUnitHistory: () => Promise.resolve({ enabled: false }),
}));

describe("FactoryPage", () => {
  beforeEach(async () => {
    await setLocale("en");
    sparks = [];
  });
  afterEach(() => cleanupRenders());

  it("shows the empty state and an add-device action", async () => {
    const { container } = render(<FactoryPage />);
    await flush();
    expect(container.textContent).toContain("No units yet");
    expect(container.querySelector("button")?.textContent).toContain("Add device");
  });
});
