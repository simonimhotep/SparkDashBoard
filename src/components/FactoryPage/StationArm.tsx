import { useEffect, useRef } from "react";
import baseArt from "./assets/arm-reference-base.webp";
import upperArt from "./assets/arm-reference-upper.webp";
import foreArt from "./assets/arm-reference-fore.webp";
import wristArt from "./assets/arm-reference-wrist.webp";
import innerArt from "./assets/arm-reference-finger-inner.webp";
import outerArt from "./assets/arm-reference-finger-outer.webp";
import { ARM_ART, ARM_THICKNESS, armPose, armSpriteTransform, fingerArtAngle, type ArmPose, type StationPlacement, type StationSide } from "./stationGeometry";
import type { StageFrame } from "./useFactoryStage";

interface StationArmProps {
  id: string;
  side: StationSide;
  rowY: number;
  height: number;
  placement?: StationPlacement;
  online: boolean;
  stale: boolean;
  subscribe: (frame: StageFrame) => () => void;
}

const degrees = (radians: number) => radians * 180 / Math.PI;
/** The shoulder drum is drawn at the same scale the links get, so the whole arm reads as one casting. */
const BASE_SCALE = 0.84 * ARM_THICKNESS;
const fingerTransform = (inner: boolean, opening: number) => {
  const part = inner ? ARM_ART.inner : ARM_ART.outer;
  return `translate(${part.root.x} ${part.root.y}) rotate(${degrees(fingerArtAngle(opening, inner))}) translate(${-part.pivot.x} ${-part.pivot.y})`;
};
const clawTransform = (pose: ArmPose, side: StationSide) => `translate(${pose.wrist.x} ${pose.wrist.y}) rotate(${degrees(pose.clawAngle)}) scale(${side === "left" ? pose.clawScale : -pose.clawScale} ${pose.clawScale}) translate(${-ARM_ART.wrist.pivot.x} ${-ARM_ART.wrist.pivot.y})`;

/** Original approved-image castings, rotated rigidly around their measured hinge pixels. */
export function StationArm({ id, side, rowY, height, placement, online, stale, subscribe }: StationArmProps) {
  const ref = useRef<SVGSVGElement>(null);
  const pose = armPose(side, 0, false, rowY, height, placement);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const upper = svg.querySelector<SVGImageElement>("[data-upper]")!;
    const fore = svg.querySelector<SVGImageElement>("[data-fore]")!;
    const claw = svg.querySelector<SVGGElement>("[data-claw]")!;
    const inner = svg.querySelector<SVGImageElement>("[data-inner]")!;
    const outer = svg.querySelector<SVGImageElement>("[data-outer]")!;
    return subscribe((_dt, phase) => {
      if (!online || stale) return;
      const state = phase.stations.get(id);
      const p = armPose(side, state?.phase ?? 0, state?.working ?? false, rowY, height, placement);
      upper.setAttribute("transform", armSpriteTransform(ARM_ART.upper, p.base, p.elbow, side));
      fore.setAttribute("transform", armSpriteTransform(ARM_ART.fore, p.elbow, p.wrist, side));
      claw.setAttribute("transform", clawTransform(p, side));
      inner.setAttribute("transform", fingerTransform(true, p.opening));
      outer.setAttribute("transform", fingerTransform(false, p.opening));
      svg.setAttribute("data-phase", (state?.phase ?? 0).toFixed(3));
      svg.setAttribute("data-working", String(state?.working ?? false));
      svg.setAttribute("data-opening", p.opening.toFixed(3));
    });
  }, [subscribe, id, side, rowY, height, placement, online, stale]);

  return (
    <svg ref={ref} className="factory-unit__arm" viewBox="0 0 600 550" aria-hidden="true">
      <image href={baseArt} width={ARM_ART.base.width} height={ARM_ART.base.height} transform={`translate(${pose.base.x} ${pose.base.y}) scale(${side === "left" ? BASE_SCALE : -BASE_SCALE} ${BASE_SCALE}) translate(${-ARM_ART.base.pivot.x} ${-ARM_ART.base.pivot.y})`} />
      <image data-upper href={upperArt} width={ARM_ART.upper.width} height={ARM_ART.upper.height} transform={armSpriteTransform(ARM_ART.upper, pose.base, pose.elbow, side)} />
      <image data-fore href={foreArt} width={ARM_ART.fore.width} height={ARM_ART.fore.height} transform={armSpriteTransform(ARM_ART.fore, pose.elbow, pose.wrist, side)} />
      <g data-claw transform={clawTransform(pose, side)}>
        <image data-inner href={innerArt} width={ARM_ART.inner.width} height={ARM_ART.inner.height} transform={fingerTransform(true, pose.opening)} />
        <image data-outer href={outerArt} width={ARM_ART.outer.width} height={ARM_ART.outer.height} transform={fingerTransform(false, pose.opening)} />
        <image href={wristArt} width={ARM_ART.wrist.width} height={ARM_ART.wrist.height} />
      </g>
    </svg>
  );
}
