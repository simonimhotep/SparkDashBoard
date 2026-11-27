import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setLocale } from "../../i18n";
import { makeSpark } from "../../testing/fixtures";
import { cleanupRenders, render } from "../../testing/render";
import { factoryFleet } from "./factoryModel";
import { SparkUnit } from "./SparkUnit";

function station(online = true) {
  return factoryFleet([makeSpark("a", online)]).units[0];
}

describe("SparkUnit", () => {
  beforeEach(async () => {
    await setLocale("en");
  });
  afterEach(() => cleanupRenders());

  it("seats the operator in a cab on the machine and stencils the host name", () => {
    const unit = station();
    const { container } = render(
      <SparkUnit unit={unit} index={1} tempUnit="celsius" intensity={0.5} onSelect={() => {}} />,
    );
    const cab = container.querySelector(".factory-unit__cab");
    expect(cab).not.toBeNull();
    expect(cab!.querySelector(".factory-unit__canopy")).not.toBeNull();
    // The operator rides inside the cab, behind its glass.
    expect(cab!.querySelector(".factory-unit__whale")).not.toBeNull();
    expect(container.querySelector(".factory-unit__nameplate")!.textContent).toBe(unit.id);
  });

  it("keeps the empty cab when the unit is offline", () => {
    const { container } = render(
      <SparkUnit unit={station(false)} index={1} tempUnit="celsius" intensity={0} onSelect={() => {}} />,
    );
    expect(container.querySelector(".factory-unit__cab")).not.toBeNull();
    expect(container.querySelector(".factory-unit__whale")).toBeNull();
  });
});
