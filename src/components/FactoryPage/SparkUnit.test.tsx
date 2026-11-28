import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "../../i18n";
import { makeSpark } from "../../testing/fixtures";
import { cleanupRenders, render } from "../../testing/render";
import { factoryFleet } from "./factoryModel";
import { SparkUnit } from "./SparkUnit";

const subscribe = () => () => {};
const station = (online = true) => factoryFleet([makeSpark("a", online)]).units[0];

describe("SparkUnit", () => {
  beforeEach(async () => { await setLocale("en"); });
  afterEach(() => cleanupRenders());

  it("seats the operator in an upright cab and prints the reported hostname", () => {
    const unit = { ...station(), hostname: "spark-e4ee" };
    const { container } = render(<SparkUnit unit={unit} index={1} side="left" tempUnit="celsius" subscribe={subscribe} onSelect={() => {}} />);
    const cab = container.querySelector(".factory-unit__cab")!;
    expect(cab.querySelector("img")?.getAttribute("src")).toContain("cab-reference-left");
    expect(container.querySelector(".factory-unit__body image")?.getAttribute("href")).toContain("body-isometric");
    expect(container.querySelector(".factory-unit__nameplate")!.textContent).toBe("spark-e4ee");
    expect(container.querySelector("svg.factory-unit__arm")).not.toBeNull();
  });

  it("keeps the floor free of labels unless the unit has state to add", () => {
    const online = render(<SparkUnit unit={station()} index={1} side="left" tempUnit="celsius" subscribe={subscribe} onSelect={() => {}} />);
    expect(online.container.querySelector(".factory-unit__plate")).toBeNull();
    const offline = render(<SparkUnit unit={station(false)} index={1} side="left" tempUnit="celsius" subscribe={subscribe} onSelect={() => {}} />);
    expect(offline.container.querySelector(".factory-unit__plate .factory-unit__offline")).not.toBeNull();
  });

  it("uses one cab art on both sides so the railing crest always matches", () => {
    const unit = station();
    const left = render(<SparkUnit unit={unit} index={1} side="left" tempUnit="celsius" subscribe={subscribe} onSelect={() => {}} />);
    const right = render(<SparkUnit unit={unit} index={2} side="right" tempUnit="celsius" subscribe={subscribe} onSelect={() => {}} />);
    const leftArt = left.container.querySelector(".factory-unit__cab img")?.getAttribute("src");
    expect(leftArt).toContain("cab-reference-left");
    expect(right.container.querySelector(".factory-unit__cab img")?.getAttribute("src")).toBe(leftArt);
    // The right-hand cab faces the track by mirroring that same drawing in CSS, never by a second copy of the art.
    expect(right.container.querySelector(".factory-unit")?.classList.contains("factory-unit--right")).toBe(true);
  });

  it("uses the approved metal layers for all connected arm parts", () => {
    const { container } = render(<SparkUnit unit={station()} index={1} side="left" tempUnit="celsius" subscribe={subscribe} onSelect={() => {}} />);
    const arm = container.querySelector(".factory-unit__arm")!;
    expect(arm.querySelectorAll("line, path, circle, ellipse")).toHaveLength(0);
    const sources = [...arm.querySelectorAll("image")].map((image) => image.getAttribute("href"));
    for (const part of ["base", "upper", "fore", "wrist", "finger-inner", "finger-outer"]) {
      expect(sources.some((source) => source?.includes(`arm-reference-${part}`))).toBe(true);
    }
  });

  it("keeps the empty cab when offline and supports keyboard selection", () => {
    const select = vi.fn();
    const { container } = render(<SparkUnit unit={station(false)} index={1} side="right" tempUnit="celsius" subscribe={subscribe} onSelect={select} />);
    expect(container.querySelector(".factory-unit__cab img")?.getAttribute("src")).toContain("cab-empty");
    expect(container.querySelector(".factory-unit__whale")).toBeNull();
    expect(container.querySelector(".factory-unit")?.classList.contains("factory-unit--right")).toBe(true);
    act(() => container.querySelector("[role=button]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(select).toHaveBeenCalledWith("a");
  });

  it("shows only local measured LCD values including power, and keeps long names inspectable", () => {
    const unit = { ...station(), modelText: "a-very-long-model-name-which-must-not-overflow", hostname: null };
    const { container } = render(<SparkUnit unit={unit} index={1} side="left" tempUnit="celsius" subscribe={subscribe} onSelect={() => {}} />);
    expect(container.textContent).toContain("42%");
    expect(container.textContent).toContain("50 W");
    expect(container.textContent).toContain("20.0");
    expect(container.querySelector(".factory-unit__model")?.getAttribute("title")).toBe(unit.modelText);
    expect(container.querySelector(".factory-unit__nameplate")?.textContent).toBe(unit.name);
  });
});
