import { describe, expect, it } from "vitest";
import { ARM_ART, ARM_THICKNESS, armPose, armSpriteTransform, beltCenter, beltWidth, bodyGeometry, stationLayout, triangleMatrix } from "./stationGeometry";

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("approved factory ground geometry", () => {
  it("puts the near-vertical track ends at the independently measured draft anchors", () => {
    expect(beltCenter("left", 515, 1030)).toBeCloseTo(856, 0);
    expect(beltCenter("right", 515, 1030)).toBeCloseTo(1053, 0);
    expect(beltCenter("left", 951, 1030)).toBeCloseTo(802, 0);
    expect(beltCenter("right", 951, 1030)).toBeCloseTo(1135, 0);
  });

  it("matches the four approved body feet and compact arm silhouette", () => {
    const layout = stationLayout(4);
    const expected = [
      { foot: [535, 666], base: [599, 450], elbow: [668, 379], wrist: [783, 437], tip: [815, 520] },
      { foot: [1385, 666], base: [1340, 450], elbow: [1269, 379], wrist: [1144, 437], tip: [1100, 520] },
      { foot: [485, 993], base: [545, 729], elbow: [636, 645], wrist: [767, 700], tip: [791, 786] },
      { foot: [1461, 993], base: [1394, 729], elbow: [1307, 645], wrist: [1174, 700], tip: [1138, 786] },
    ];
    layout.stations.forEach((station, i) => {
      expect(distance({ x: station.x + 270 * station.scale, y: station.y + 505 * station.scale }, { x: expected[i].foot[0], y: expected[i].foot[1] })).toBeLessThan(8);
      const pose = armPose(station.side, 0, false, station.y, layout.height, station);
      for (const key of ["base", "elbow", "wrist", "tip"] as const) {
        expect(distance({ x: station.x + pose[key].x * station.scale, y: station.y + pose[key].y * station.scale }, { x: expected[i][key][0], y: expected[i][key][1] })).toBeLessThan(8);
      }
    });
  });

  it("fills the back row before the front row, so a lone unit sits at the back left", () => {
    expect(stationLayout(1).stations.map((s) => [s.side, s.depth])).toEqual([["left", 0]]);
    expect(stationLayout(2).stations.map((s) => [s.side, s.depth])).toEqual([["left", 0], ["right", 0]]);
    expect(stationLayout(3).stations.map((s) => [s.side, s.depth])).toEqual([["left", 0], ["right", 0], ["left", 1]]);
    expect(stationLayout(4).stations.map((s) => [s.side, s.depth])).toEqual([["left", 0], ["right", 0], ["left", 1], ["right", 1]]);
    // The back row is the far one: it sits higher and smaller than the front row.
    const [back] = stationLayout(1).stations;
    const [, , front] = stationLayout(4).stations;
    expect(back.y).toBeLessThan(front.y);
    expect(back.scale).toBeLessThan(front.scale);
  });

  it.each([1, 2, 4])("keeps %i units and their connected full-cycle arms on the common floor", (count) => {    const layout = stationLayout(count);
    expect(layout.stations).toHaveLength(count);
    for (const station of layout.stations) {
      const rest = armPose(station.side, 0, false, station.y, layout.height, station);
      for (let step = 0; step <= 100; step++) {
        const pose = armPose(station.side, step / 100, true, station.y, layout.height, station);
        expect(distance(pose.base, pose.elbow)).toBeCloseTo(distance(rest.base, rest.elbow), 4);
        expect(distance(pose.elbow, pose.wrist)).toBeCloseTo(distance(rest.elbow, rest.wrist), 4);
        expect(pose.elbow.y).toBeLessThan(pose.base.y);
        const y = station.y + pose.tip.y * station.scale;
        const x = station.x + pose.tip.x * station.scale;
        expect(y).toBeGreaterThanOrEqual(515);
        expect(y).toBeLessThanOrEqual(layout.height - 79);
        // The claw lands at the machine-side edge of the visible belt, not its centerline.
        expect(Math.abs(x - beltCenter(station.side, y, layout.height))).toBeLessThanOrEqual(beltWidth(y, layout.height) / 2 + 8);
      }
    }
  });

  it("projects the original roof to the measured draft without stretching the front face", () => {
    const stations = stationLayout(4).stations;
    const expected = [
      [[540, 421], [315, 490], [542, 561], [767, 492]],
      [[463, 692], [218, 784], [481, 868], [726, 776]],
    ];
    for (const [i, station] of [stations[0], stations[2]].entries()) {
      const body = bodyGeometry(station.depth);
      body.roof.forEach((point, j) => {
        expect(station.x + point.x * station.scale).toBeCloseTo(expected[i][j][0], 3);
        expect(station.y + point.y * station.scale).toBeCloseTo(expected[i][j][1], 3);
      });
      const width = body.roof[3].x - body.roof[1].x;
      const faceHeight = body.foot.y - body.roof[2].y;
      expect(faceHeight / width).toBeGreaterThan(0.22);
      expect(faceHeight / width).toBeLessThan(0.25);
    }
  });

  it("keeps the LCD source quad on its projected front face", () => {
    for (const depth of [0, 1]) {
      const body = bodyGeometry(depth);
      const source = [{ x: 113, y: 400 }, { x: 690, y: 672 }, { x: 690, y: 979 }];
      const target = [body.roof[1], body.roof[2], body.foot];
      const values = triangleMatrix(source, target).slice(7, -1).split(" ").map(Number);
      const [a, b, c, d, e, f] = values;
      const project = (x: number, y: number) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
      source.forEach((point, i) => expect(distance(project(point.x, point.y), target[i])).toBeLessThan(0.001));
      const top = project(139, 436);
      const bottom = project(139, 657);
      expect(top.y).toBeGreaterThan(body.roof[1].y);
      expect(bottom.y).toBeLessThan(body.leftFoot.y);
      expect(project(670, 695).x).toBeGreaterThan(top.x);
    }
  });

  it("keeps both original sprite anchors connected while widening each link to the draft's thickness", () => {
    const layout = stationLayout(4);
    for (const station of layout.stations) for (let step = 0; step <= 40; step++) {
      const pose = armPose(station.side, step / 40, true, station.y, layout.height, station);
      for (const [sprite, a, b, sourceA, sourceB] of [
        [ARM_ART.upper, pose.base, pose.elbow, { x: 32, y: 120 }, { x: 132, y: 29 }],
        [ARM_ART.fore, pose.elbow, pose.wrist, { x: 30, y: 42 }, { x: 173, y: 102 }],
      ] as const) {
        const [aa, bb, cc, dd, ee, ff] = armSpriteTransform(sprite, a, b, station.side).slice(7, -1).split(" ").map(Number);
        const map = (p: { x: number; y: number }) => ({ x: aa * p.x + cc * p.y + ee, y: bb * p.x + dd * p.y + ff });
        expect(distance(map(sourceA), a)).toBeLessThan(0.0001);
        expect(distance(map(sourceB), b)).toBeLessThan(0.0001);
        // The link is widened across its own axis only: no shear along it, and the length is kept.
        const axis = { x: sourceB.x - sourceA.x, y: sourceB.y - sourceA.y };
        const normal = { x: -axis.y, y: axis.x };
        const axisImage = { x: aa * axis.x + cc * axis.y, y: bb * axis.x + dd * axis.y };
        const normalImage = { x: aa * normal.x + cc * normal.y, y: bb * normal.x + dd * normal.y };
        expect(axisImage.x * normalImage.x + axisImage.y * normalImage.y).toBeCloseTo(0, 6);
        const along = Math.hypot(axisImage.x, axisImage.y) / Math.hypot(axis.x, axis.y);
        const across = Math.hypot(normalImage.x, normalImage.y) / Math.hypot(normal.x, normal.y);
        expect(across / along).toBeCloseTo(ARM_THICKNESS, 6);
        expect(Math.sign(aa * dd - bb * cc)).toBe(station.side === "left" ? 1 : -1);
      }
    }
  });

  it("lands at the midpoint of the articulated original finger pixels throughout a cycle", () => {
    const layout = stationLayout(4);
    for (const station of layout.stations) for (let step = 0; step <= 40; step++) {
      const pose = armPose(station.side, step / 40, true, station.y, layout.height, station);
      const closing = (18 - pose.opening) / 9 * Math.PI / 18;
      // These root, pivot and contact pixels are the independent art handoff contract.
      const inner = { x: 25 + 24 * Math.cos(-closing) - 64 * Math.sin(-closing), y: 64 + 24 * Math.sin(-closing) + 64 * Math.cos(-closing) };
      const outer = { x: 53 + 41 * Math.cos(closing) - 68 * Math.sin(closing), y: 67 + 41 * Math.sin(closing) + 68 * Math.cos(closing) };
      const x = ((inner.x + outer.x) / 2 - 29) * (station.side === "left" ? 1 : -1);
      const y = (inner.y + outer.y) / 2 - 35;
      const midpoint = { x: pose.wrist.x + pose.clawScale * (x * Math.cos(pose.clawAngle) - y * Math.sin(pose.clawAngle)), y: pose.wrist.y + pose.clawScale * (x * Math.sin(pose.clawAngle) + y * Math.cos(pose.clawAngle)) };
      expect(distance(midpoint, pose.tip)).toBeLessThan(0.0001);
    }
  });

  it("caps the scene at four stations without extending its ground", () => {
    const layout = stationLayout(7);
    expect(layout.stations).toHaveLength(4);
    expect(layout.height).toBe(1030);
    const front = layout.stations[3];
    expect(front.x + 270 * front.scale).toBe(1461);
    expect(front.y + 505 * front.scale).toBe(993);
  });
});
