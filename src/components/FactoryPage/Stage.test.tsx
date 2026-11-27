import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n";
import { makeSpark } from "../../testing/fixtures";
import { cleanupRenders, render } from "../../testing/render";
import { factoryFleet } from "./factoryModel";
import { Stage } from "./Stage";

describe("Stage", () => {
  beforeEach(async () => {
    await setLocale("en");
    // jsdom has no canvas; the conveyor skips drawing when there is no 2D context.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
  });
  afterEach(() => {
    cleanupRenders();
    vi.restoreAllMocks();
  });

  it("renders each unit with measured values and dashes for unknown ones", () => {
    const f = factoryFleet([makeSpark("a")]);
    const { container } = render(
      <Stage fleet={f} tempUnit="celsius" onSelectUnit={() => {}} rootRef={createRef()} />,
    );
    expect(container.textContent).toContain("Spark a");
    expect(container.textContent).toContain("42%");
    expect(container.textContent).toContain("55");

    const off = factoryFleet([makeSpark("b", false)]);
    const r2 = render(
      <Stage fleet={off} tempUnit="celsius" onSelectUnit={() => {}} rootRef={createRef()} />,
    );
    expect(r2.container.textContent).toContain("Offline");
    expect(r2.container.textContent).not.toContain("0 tok/s");
  });

  it("desaturates the scene when the snapshot goes stale but keeps its numbers", () => {
    const f = factoryFleet([makeSpark("a")]);
    const { container } = render(
      <Stage fleet={f} tempUnit="celsius" onSelectUnit={() => {}} rootRef={createRef()} stale />,
    );
    expect(container.querySelector(".factory-stage")?.classList.contains("is-stale")).toBe(true);
    expect(container.textContent).toContain("42%");
  });
});
