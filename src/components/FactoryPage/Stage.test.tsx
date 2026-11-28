import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n";
import { makeSpark } from "../../testing/fixtures";
import { cleanupRenders, render } from "../../testing/render";
import { factoryFleet } from "./factoryModel";
import { Stage } from "./Stage";
import { Conveyor } from "./Conveyor";
import { armPose, stationLayout } from "./stationGeometry";
import type { StageFrame } from "./useFactoryStage";

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

  it.each([1, 2, 4])("shows exactly %i configured devices on alternating sides of the twin tracks", (count) => {
    const fleet = factoryFleet(Array.from({ length: count }, (_, i) => makeSpark(String(i))));
    const { container } = render(<Stage fleet={fleet} tempUnit="celsius" onSelectUnit={() => {}} rootRef={createRef()} />);
    expect(container.querySelectorAll(".factory-unit")).toHaveLength(count);
    expect(container.querySelectorAll(".factory-unit--left")).toHaveLength(Math.ceil(count / 2));
    expect(container.querySelectorAll(".factory-unit--right")).toHaveLength(Math.floor(count / 2));
    expect(container.querySelectorAll(".factory-belt")).toHaveLength(2);
    expect(container.querySelector(".factory-collector")).not.toBeNull();
  });

  it("keeps the original factory while projecting its ground texture below the office", () => {
    const { container } = render(<Stage fleet={factoryFleet([makeSpark("a")])} tempUnit="celsius" onSelectUnit={() => {}} rootRef={createRef()} />);
    const background = container.querySelector(".factory-bg")!;
    const ground = container.querySelector(".factory-ground");
    expect(background.getAttribute("src")).toContain("bg-factory");
    expect(ground?.getAttribute("src")).toContain("reference-floor");
    expect(ground?.getAttribute("style")).toBeNull();
    expect(container.querySelector(".factory-office-stand")).toBeNull();
  });

  it("draws one output batch at the releasing unit's claw in that same phase", () => {
    const context = { clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn() };
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(context as unknown as CanvasRenderingContext2D);
    let frame: StageFrame = () => {};
    const station = { ...stationLayout(4).stations[0], id: "a", online: true };
    render(<Conveyor subscribe={(draw) => { frame = draw; return () => {}; }} stations={[station]} height={1030} />);
    const state = { phase: 0.25, intensity: 1, working: true, earned: 0, released: 0 };
    const phase = { intensity: 1, armPhase: 0, beltOffset: 0, stations: new Map([["a", state]]) };
    frame(0, phase);
    state.phase = 0.5;
    state.released = 80;
    frame(0, phase);
    const tip = armPose("left", 0.5, true, station.y, 1030, station).tip;
    expect(context.translate).toHaveBeenCalledTimes(1);
    // Born under the claw, but at its landing point: the tip rides a wave, and a bobbing
    // release point would space cubes by whatever the wave had moved that frame.
    expect(context.translate).toHaveBeenCalledWith(station.x + tip.x * station.scale, station.landingY);
  });

  it("prints the collector caption on the front nameplate", () => {
    const { container } = render(<Stage fleet={factoryFleet([makeSpark("a")])} tempUnit="celsius" onSelectUnit={() => {}} rootRef={createRef()} />);
    expect(container.querySelector(".factory-collector__label")?.textContent).toBe("{ } Token Collector");
  });

  it("does not let an active unit substitute its rates for an idle or unknown neighbor", () => {
    const idle = makeSpark("idle");
    idle.metrics.llm[0].generationTps = 0;
    const unknown = makeSpark("unknown");
    unknown.metrics.llm[0].measurementValid = false;
    const { container } = render(<Stage fleet={factoryFleet([makeSpark("busy"), idle, unknown])} tempUnit="celsius" onSelectUnit={() => {}} rootRef={createRef()} />);
    const panels = [...container.querySelectorAll(".factory-unit__lcd")];
    expect(panels[0].textContent).toContain("20.0");
    expect(panels[1].textContent).toContain("0.0");
    expect(panels[2].textContent).not.toContain("20.0");
    expect(panels[2].textContent).toContain("—");
  });

  it("renders at most four configured devices on the fixed approved floor", () => {
    const many = factoryFleet(["a", "b", "c", "d", "e"].map((id) => makeSpark(id)));
    const { container } = render(
      <Stage fleet={many} tempUnit="celsius" onSelectUnit={() => {}} rootRef={createRef()} />,
    );
    expect(container.querySelectorAll(".factory-unit")).toHaveLength(4);
    expect(container.querySelector(".factory-floor--scroll")).toBeNull();
  });
});
