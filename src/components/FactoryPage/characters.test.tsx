import { afterEach, describe, expect, it } from "vitest";
import { cleanupRenders, render } from "../../testing/render";
import { BossOffice } from "./BossOffice";
import { WhaleOperator } from "./WhaleOperator";

describe("BossOffice", () => {
  afterEach(() => cleanupRenders());

  it("puts the boss to work when the line is running and asleep when it is not", () => {
    const busy = render(<BossOffice intensity={0.8} busy asleep={false} />);
    expect(busy.container.querySelector("img")?.getAttribute("src")).toContain("boss-busy");
    cleanupRenders();

    const idle = render(<BossOffice intensity={0} busy={false} asleep />);
    expect(idle.container.querySelector("img")?.getAttribute("src")).toContain("boss-asleep");
    cleanupRenders();

    const tea = render(<BossOffice intensity={0.05} busy={false} asleep={false} />);
    expect(tea.container.querySelector("img")?.getAttribute("src")).toContain("boss-tea");
  });
});

describe("WhaleOperator", () => {
  afterEach(() => cleanupRenders());

  it("shows a sweating operator only while a unit is thermally throttled", () => {
    const hot = render(<WhaleOperator state="sweat" />);
    expect(hot.container.querySelector("img")?.getAttribute("src")).toContain("whale-sweat");
    cleanupRenders();

    const typing = render(<WhaleOperator state="typing" />);
    expect(typing.container.querySelector("img")?.getAttribute("src")).toContain("whale-typing");
    cleanupRenders();

    const idle = render(<WhaleOperator state="idle" />);
    expect(idle.container.querySelector("img")?.getAttribute("src")).toContain("whale-idle");
  });
});
