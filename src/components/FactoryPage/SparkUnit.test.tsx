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

  it("seats the operator in a glass booth with a desk and a computer", () => {
    const { container } = render(
      <SparkUnit unit={station()} index={1} tempUnit="celsius" intensity={0.5} onSelect={() => {}} />,
    );
    const booth = container.querySelector(".factory-unit__booth");
    expect(booth).not.toBeNull();
    expect(booth!.querySelector(".factory-booth__desk")).not.toBeNull();
    expect(booth!.querySelector(".factory-booth__monitor")).not.toBeNull();
    // The operator sits inside the booth, behind its desk.
    expect(booth!.querySelector(".factory-unit__whale")).not.toBeNull();
  });

  it("keeps the empty booth when the unit is offline", () => {
    const { container } = render(
      <SparkUnit unit={station(false)} index={1} tempUnit="celsius" intensity={0} onSelect={() => {}} />,
    );
    expect(container.querySelector(".factory-unit__booth")).not.toBeNull();
    expect(container.querySelector(".factory-unit__whale")).toBeNull();
  });
});
