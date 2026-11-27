import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupRenders, flush, render } from "../../testing/render";
import { useFactoryStage } from "./useFactoryStage";

function Probe({ intensity = 0.8, paused = false }: { intensity?: number; paused?: boolean }) {
  const ref = createRef<HTMLDivElement>();
  useFactoryStage(ref, { intensity, paused, preview: false });
  return <div ref={ref} />;
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches, addEventListener() {}, removeEventListener() {} }));
}

describe("useFactoryStage", () => {
  afterEach(() => {
    cleanupRenders();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not start an animation frame when the user asked for reduced motion", () => {
    stubMatchMedia(true);
    const spy = vi.spyOn(window, "requestAnimationFrame");
    render(<Probe intensity={0.8} />);
    expect(spy).not.toHaveBeenCalled();
  });

  it("stops scheduling frames while paused", async () => {
    stubMatchMedia(false);
    const spy = vi.spyOn(window, "requestAnimationFrame");
    render(<Probe intensity={0.8} paused />);
    const calls = spy.mock.calls.length;
    await flush();
    expect(spy.mock.calls.length).toBe(calls);
  });
});
