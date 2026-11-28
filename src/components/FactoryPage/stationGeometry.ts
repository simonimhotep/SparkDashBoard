export type StationSide = "left" | "right";
export interface Point { x: number; y: number }
export interface StationPlacement { side: StationSide; x: number; y: number; scale: number; depth: number; landingY: number }

export const FLOOR = { farY: 515, nearY: 951, height: 1030, farWidth: 80, nearWidth: 125 } as const;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The approved two rows share stage coordinates with the belt and every moving joint. */
export function stationLayout(count: number): { stations: StationPlacement[]; height: number } {
  const visible = Math.min(count, 4);
  const rows = Math.max(1, Math.ceil(visible / 2));
  return {
    stations: Array.from({ length: visible }, (_, i) => {
      const side: StationSide = i % 2 ? "right" : "left";
      const depth = rows === 1 ? 1 : Math.floor(i / 2);
      const scale = lerp(0.92, 1, depth);
      const footY = lerp(666, 993, depth);
      const footX = side === "left" ? lerp(535, 485, depth) : lerp(1385, 1461, depth);
      return { side, x: footX - 270 * scale, y: footY - 505 * scale, scale, depth, landingY: lerp(520, 786, depth) };
    }),
    height: FLOOR.height,
  };
}

export function beltProgress(y: number, height: number): number {
  return Math.min(1, Math.max(0, (y - FLOOR.farY) / (height - 79 - FLOOR.farY)));
}

export function beltCenter(side: StationSide, y: number, height: number): number {
  const progress = beltProgress(y, height);
  return side === "left" ? lerp(856, 802, progress) : lerp(1053, 1135, progress);
}

export function beltWidth(y: number, height: number): number {
  return lerp(FLOOR.farWidth, FLOOR.nearWidth, beltProgress(y, height));
}

export interface ArmPose { base: Point; elbow: Point; wrist: Point; tip: Point; opening: number; clawAngle: number; clawScale: number }

/** Pixel anchors supplied with the approved-image layers, in each original crop. */
export const ARM_ART = {
  base: { width: 146, height: 83, pivot: { x: 67, y: 7 } },
  upper: { width: 164, height: 156, pivot: { x: 32, y: 120 }, attach: { x: 132, y: 29 } },
  fore: { width: 208, height: 128, pivot: { x: 30, y: 42 }, attach: { x: 173, y: 102 } },
  wrist: { width: 70, height: 72, pivot: { x: 29, y: 35 } },
  inner: { width: 58, height: 89, pivot: { x: 21, y: 14 }, tip: { x: 45, y: 78 }, root: { x: 25, y: 64 } },
  outer: { width: 74, height: 100, pivot: { x: 15, y: 20 }, tip: { x: 56, y: 88 }, root: { x: 53, y: 67 } },
} as const;

/**
 * The sprite's own pivot-to-attach length is longer than the measured joint distance, so a plain
 * similarity would draw every link about 20% thinner than the draft. This widens each link across
 * its axis only: both hinge pixels still land exactly, the length and the silhouette angle hold.
 */
export const ARM_THICKNESS = 1.25;

/** A similarity transform preserves the cast-metal shape and maps both hinge centers exactly. */
export function armSpriteTransform(sprite: { pivot: Point; attach: Point }, a: Point, b: Point, side: StationSide): string {
  const mirror = side === "left" ? 1 : -1;
  const sx = (sprite.attach.x - sprite.pivot.x) * mirror;
  const sy = sprite.attach.y - sprite.pivot.y;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = sx ** 2 + sy ** 2;
  const cos = (dx * sx + dy * sy) / lengthSquared;
  const sin = (dy * sx - dx * sy) / lengthSquared;
  const aa = cos * mirror;
  const bb = sin * mirror;
  // Scale along the link's normal in sprite space, leaving the hinge-to-hinge axis untouched.
  const ax = sprite.attach.x - sprite.pivot.x;
  const ay = sprite.attach.y - sprite.pivot.y;
  const length = Math.hypot(ax, ay) || 1;
  const nx = -ay / length;
  const ny = ax / length;
  const k = ARM_THICKNESS - 1;
  const s11 = 1 + k * nx * nx;
  const s12 = k * nx * ny;
  const s21 = k * ny * nx;
  const s22 = 1 + k * ny * ny;
  const c11 = aa * s11 - sin * s21;
  const c12 = aa * s12 - sin * s22;
  const c21 = bb * s11 + cos * s21;
  const c22 = bb * s12 + cos * s22;
  return `matrix(${c11} ${c21} ${c12} ${c22} ${a.x - c11 * sprite.pivot.x - c12 * sprite.pivot.y} ${a.y - c21 * sprite.pivot.x - c22 * sprite.pivot.y})`;
}

export function fingerArtAngle(opening: number, inner: boolean): number {
  return (18 - opening) / 9 * (Math.PI / 18) * (inner ? -1 : 1);
}

function clawGeometry(side: StationSide, opening: number, restOffset: Point) {
  const tips = ([ARM_ART.inner, ARM_ART.outer] as const).map((part, i) => {
    const angle = fingerArtAngle(opening, i === 0);
    const x = part.tip.x - part.pivot.x;
    const y = part.tip.y - part.pivot.y;
    return { x: part.root.x + x * Math.cos(angle) - y * Math.sin(angle), y: part.root.y + x * Math.sin(angle) + y * Math.cos(angle) };
  });
  const mirror = side === "left" ? 1 : -1;
  const sourceRest = {
    x: ((ARM_ART.inner.root.x + ARM_ART.inner.tip.x - ARM_ART.inner.pivot.x + ARM_ART.outer.root.x + ARM_ART.outer.tip.x - ARM_ART.outer.pivot.x) / 2 - ARM_ART.wrist.pivot.x) * mirror,
    y: (ARM_ART.inner.root.y + ARM_ART.inner.tip.y - ARM_ART.inner.pivot.y + ARM_ART.outer.root.y + ARM_ART.outer.tip.y - ARM_ART.outer.pivot.y) / 2 - ARM_ART.wrist.pivot.y,
  };
  const angle = Math.atan2(restOffset.y, restOffset.x) - Math.atan2(sourceRest.y, sourceRest.x);
  const scale = Math.hypot(restOffset.x, restOffset.y) / Math.hypot(sourceRest.x, sourceRest.y);
  const x = ((tips[0].x + tips[1].x) / 2 - ARM_ART.wrist.pivot.x) * mirror;
  const y = (tips[0].y + tips[1].y) / 2 - ARM_ART.wrist.pivot.y;
  return { angle, scale, offset: { x: (x * Math.cos(angle) - y * Math.sin(angle)) * scale, y: (x * Math.sin(angle) + y * Math.cos(angle)) * scale } };
}

/** Four roof corners measured from the approved image, relative to its front floor foot. */
export function bodyGeometry(depth: number) {
  const scale = lerp(0.92, 1, depth);
  const rear = [[5, -245], [-220, -176], [7, -105], [232, -174]];
  const front = [[-22, -301], [-267, -209], [-4, -125], [241, -217]];
  const roof = rear.map((point, i) => ({ x: 270 + lerp(point[0], front[i][0], depth) / scale, y: 505 + lerp(point[1], front[i][1], depth) / scale }));
  const foot = { x: 270, y: 505 };
  const leftFoot = { x: roof[1].x + foot.x - roof[2].x, y: roof[1].y + foot.y - roof[2].y };
  const rightFoot = { x: roof[3].x + foot.x - roof[2].x, y: roof[3].y + foot.y - roof[2].y };
  return { roof, foot, leftFoot, rightFoot };
}

/** Affine image triangle; adjoining triangles share the same measured vertices. */
export function triangleMatrix(source: Point[], target: Point[]): string {
  const [a, b, c] = source;
  const determinant = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  const solve = (axis: "x" | "y") => {
    const u = target[1][axis] - target[0][axis];
    const v = target[2][axis] - target[0][axis];
    const x = (u * (c.y - a.y) - v * (b.y - a.y)) / determinant;
    const y = (v * (b.x - a.x) - u * (c.x - a.x)) / determinant;
    return [x, y, target[0][axis] - x * a.x - y * a.y];
  };
  const x = solve("x");
  const y = solve("y");
  return `matrix(${x[0]} ${y[0]} ${x[1]} ${y[1]} ${x[2]} ${y[2]})`;
}
const reference = {
  left: { rear: [[599, 450], [668, 379], [783, 437], [815, 520]], front: [[545, 729], [636, 645], [767, 700], [791, 786]] },
  right: { rear: [[1340, 450], [1269, 379], [1144, 437], [1100, 520]], front: [[1394, 729], [1307, 645], [1174, 700], [1138, 786]] },
} as const;

/** Analytic unequal-link IK preserves the compact draft silhouette throughout a harvest cycle. */
export function armPose(side: StationSide, phase: number, working: boolean, rowY = 0, height: number = FLOOR.height, placement?: StationPlacement): ArmPose {
  const station = placement ?? stationLayout(4).stations.filter((s) => s.side === side).sort((a, b) => Math.abs(a.y - rowY) - Math.abs(b.y - rowY))[0];
  const { depth, scale } = station;
  const refScale = lerp(0.92, 1, depth);
  const points = reference[side].rear.map((p, i) => ({ x: lerp(p[0], reference[side].front[i][0], depth), y: lerp(p[1], reference[side].front[i][1], depth) }));
  const footX = side === "left" ? lerp(535, 485, depth) : lerp(1385, 1461, depth);
  const footY = lerp(666, 993, depth);
  const base = { x: 270 + (points[0].x - footX) / refScale, y: 505 + (points[0].y - footY) / refScale };
  const upper = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / refScale;
  const fore = Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y) / refScale;
  const wave = 1 - Math.cos(phase * Math.PI * 2);
  const tipY = station.landingY + (working ? 9 * wave : 0.6 * wave);
  const edge = side === "left" ? -lerp(40.38, 31.44, depth) : lerp(46.06, 34.03, depth);
  const tip = { x: (beltCenter(side, tipY, height) + edge - station.x) / scale, y: (tipY - station.y) / scale };
  const opening = working ? 9 + 9 * wave / 2 : 18;
  const claw = clawGeometry(side, opening, { x: (points[3].x - points[2].x) / refScale, y: (points[3].y - points[2].y) / refScale });
  const wrist = { x: tip.x - claw.offset.x, y: tip.y - claw.offset.y };
  const dx = wrist.x - base.x;
  const dy = wrist.y - base.y;
  const distance = Math.hypot(dx, dy);
  const along = (upper ** 2 - fore ** 2 + distance ** 2) / (2 * distance);
  const rise = Math.sqrt(Math.max(0, upper ** 2 - along ** 2));
  const sign = side === "left" ? 1 : -1;
  const elbow = { x: base.x + dx / distance * along + sign * dy / distance * rise, y: base.y + dy / distance * along - sign * dx / distance * rise };
  return { base, elbow, wrist, tip, opening, clawAngle: claw.angle, clawScale: claw.scale };
}
