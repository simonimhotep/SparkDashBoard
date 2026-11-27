import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n";
import { cleanupRenders, flush, render } from "../../testing/render";
import { fetchLlmTokenTotals } from "../../api/llmTokenClient";
import { TokenTotals } from "./TokenTotals";

vi.mock("../../api/llmTokenClient", () => ({ fetchLlmTokenTotals: vi.fn() }));

const mocked = vi.mocked(fetchLlmTokenTotals);

const series = (sparkId: string, totals: Record<string, number | boolean>) => ({
  sparkId,
  port: 8888,
  updatedAt: null,
  lastModelId: null,
  models: [],
  totals: totals as never,
});

describe("TokenTotals", () => {
  beforeEach(async () => {
    await setLocale("en");
    mocked.mockReset();
  });
  afterEach(() => cleanupRenders());

  it("sums every series and expands the input split on demand", async () => {
    mocked.mockResolvedValue({
      range: "all",
      series: [
        series("a", {
          promptTokens: 1000,
          completionTokens: 500,
          cachedTokens: 200,
          cacheReported: true,
          unreportedPromptTokens: 100,
        }),
        series("b", { promptTokens: 50, completionTokens: 25, cachedTokens: 0 }),
      ],
    });

    const { container } = render(<TokenTotals />);
    await flush();

    expect(container.textContent).toContain("525");
    expect(container.textContent).toContain("1,050");
    expect(container.textContent).not.toContain("Computed");

    const input = container.querySelector("button");
    expect(input?.textContent).toContain("Total input");
    act(() => input!.click());

    expect(container.textContent).toContain("Cached");
    expect(container.textContent).toContain("750");
    expect(container.textContent).toContain("Unreported");
  });

  it("keeps an unknown total unknown instead of showing zero", async () => {
    mocked.mockRejectedValue(new Error("offline"));
    const { container } = render(<TokenTotals />);
    await flush();
    expect(container.textContent).toContain("—");
  });
});
