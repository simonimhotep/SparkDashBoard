import { act, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupRenders, flush, render } from "../../testing/render";
import { useFactoryStage } from "./useFactoryStage";

function Probe({ intensity = 0.8, paused = false, stale = false, preview = false }: { intensity?: number; paused?: boolean; stale?: boolean; preview?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFactoryStage(ref, { intensity, paused, stale, preview });
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

  it("reacts to pause and resume after mounting instead of capturing the initial pause", () => {
    stubMatchMedia(false);
    let nextId = 0;
    const pending = new Map<number, FrameRequestCallback>();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => { pending.set(++nextId, fn); return nextId; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { pending.delete(id); });
    const { root } = render(<Probe paused />);
    expect(pending.size).toBe(0);
    act(() => root.render(<Probe paused={false} />));
    expect(pending.size).toBe(1);
    act(() => root.render(<Probe paused />));
    expect(pending.size).toBe(0);
  });

  it("reacts to a live reduced-motion preference and never animates an initially hidden page", () => {
    let reduced = false;
    let changed = () => {};
    vi.stubGlobal("matchMedia", () => ({ get matches() { return reduced; }, addEventListener(_event: string, fn: () => void) { changed = fn; }, removeEventListener() {} }));
    const request = vi.spyOn(window, "requestAnimationFrame");
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    render(<Probe />);
    expect(request).toHaveBeenCalledTimes(1);
    act(() => { reduced = true; changed(); });
    expect(cancel).toHaveBeenCalled();
    act(() => { reduced = false; changed(); });
    expect(request).toHaveBeenCalledTimes(2);
    cleanupRenders();
    request.mockClear();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    render(<Probe />);
    expect(request).not.toHaveBeenCalled();
  });

  it("freezes stale data even when preview is selected", () => {
    stubMatchMedia(false);
    const request = vi.spyOn(window, "requestAnimationFrame");
    render(<Probe stale preview />);
    expect(request).not.toHaveBeenCalled();
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
