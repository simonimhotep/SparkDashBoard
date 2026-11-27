import { act } from "react";
import { setLocale } from "../../i18n";
import type { SparkSnapshot } from "../../api/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSpark } from "../../testing/fixtures";
import { cleanupRenders, flush, render } from "../../testing/render";
import { FactoryPage } from "./FactoryPage";

let sparks: SparkSnapshot[] = [];
let connected = true;
let lastValidSnapshotAt: number | null = Date.now();

vi.mock("../../hooks/useSnapshot", () => ({
  useSnapshot: () => ({
    sparks,
    connected,
    lastValidSnapshotAt,
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
    connected = true;
    lastValidSnapshotAt = Date.now();
  });
  afterEach(() => {
    cleanupRenders();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the empty state and an add-device action", async () => {
    const { container } = render(<FactoryPage />);
    await flush();
    expect(container.textContent).toContain("No units yet");
    expect(container.querySelector("button")?.textContent).toContain("Add device");
  });

  it("desaturates the stage when the socket drops but keeps the last numbers", async () => {
    sparks = [makeSpark("a")];
    connected = false;
    const { container } = render(<FactoryPage />);
    await flush();
    expect(container.querySelector(".factory-stage")?.classList.contains("is-stale")).toBe(true);
    expect(container.textContent).toContain("Spark a");
    expect(container.textContent).toContain("42%");
  });

  it("leaves for the overview on Escape when nothing is layered over the stage", async () => {
    sparks = [makeSpark("a")];
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...original, assign },
    });
    try {
      render(<FactoryPage />);
      await flush();
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(assign).toHaveBeenCalledWith("/");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });

  it("hides the cursor after three idle seconds", async () => {
    sparks = [makeSpark("a")];
    const { container } = render(<FactoryPage />);
    await flush();
    vi.useFakeTimers();
    act(() => {
      window.dispatchEvent(new Event("mousemove"));
      vi.advanceTimersByTime(3_100);
    });
    expect(container.querySelector(".factory")?.classList.contains("is-idle")).toBe(true);
  });
});
