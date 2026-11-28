import { useId } from "react";
import { useTranslation } from "react-i18next";
import { formatTemperature } from "../../shared/fleetExceptions";
import cabEmpty from "./assets/cab-empty.webp";
import cabLeft from "./assets/cab-reference-left.webp";
import joystick from "./assets/joystick.webp";
import unitBody from "./assets/body-isometric.webp";
import { unitActivity, type FactoryUnit } from "./factoryModel";
import { StationArm } from "./StationArm";
import { bodyGeometry, triangleMatrix, type Point, type StationPlacement, type StationSide } from "./stationGeometry";
import type { StageFrame } from "./useFactoryStage";

interface SparkUnitProps {
  unit: FactoryUnit;
  index: number;
  side: StationSide;
  rowY?: number;
  placement?: StationPlacement;
  height?: number;
  tempUnit: "celsius" | "fahrenheit";
  subscribe: (frame: StageFrame) => () => void;
  stale?: boolean;
  onSelect: (id: string) => void;
}

/** One shared station, instantiated for the actual device. Only cab/arm placement changes sides. */
export function SparkUnit({ unit, index, side, placement, rowY = 0, height = 1030, tempUnit, subscribe, stale = false, onSelect }: SparkUnitProps) {
  const { t } = useTranslation("factory");
  const uid = useId().replaceAll(":", "");
  const body = bodyGeometry(placement?.depth ?? 1);
  const [apex, left, front, right] = body.roof;
  const source = { apex: { x: 800, y: 80 }, left: { x: 113, y: 400 }, front: { x: 690, y: 672 }, right: { x: 1408, y: 400 }, foot: { x: 690, y: 979 } };
  const facets = [
    { source: [source.left, source.apex, source.front], target: [left, apex, front] },
    { source: [source.apex, source.right, source.front], target: [apex, right, front] },
    { source: [source.left, source.front, source.foot], target: [left, front, body.foot], extra: body.leftFoot },
    { source: [source.front, source.right, source.foot], target: [front, right, body.foot], extra: body.rightFoot },
  ];
  // Each roof half is its own affine map; overlap them by a hair so the shared edge never shows a seam.
  const seam = (points: Point[], [ai, bi]: [number, number], other: number): Point[] => {
    const a = points[ai], b = points[bi], o = points[other];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    let nx = -dy / length, ny = dx / length;
    if ((o.x - a.x) * nx + (o.y - a.y) * ny > 0) { nx = -nx; ny = -ny; }
    return points.map((p, i) => (i === ai || i === bi ? { x: p.x + nx * 2, y: p.y + ny * 2 } : p));
  };
  facets[0].target = seam(facets[0].target, [1, 2], 0);
  facets[1].target = seam(facets[1].target, [0, 2], 1);
  const polygon = (points: Point[]) => points.map((p) => `${p.x},${p.y}`).join(" ");
  const roleLabel = unit.station === "worker" ? t("workerOf", { name: unit.modelText ?? "—" }) : unit.station === "head" ? t("roleHead") : t("roleStandalone");
  const pct = unit.gpuPct === null ? "—" : `${Math.round(unit.gpuPct)}%`;
  const temp = unit.gpuTempC === null ? "—" : formatTemperature(unit.gpuTempC, tempUnit);
  const modelLabel = unit.modelText ?? (unit.note === "headOffline" ? t("headOffline") : unit.note === "headApiNotReady" ? t("headApiNotReady") : unit.note === "noHeadPort" ? t("noHeadPort") : unit.note === "noLocalInference" ? t("noLocalInference") : t("noLlm"));
  const nameplate = unit.hostname || unit.name;
  const working = !stale && unitActivity(unit).working;
  const classes = ["factory-unit", `factory-unit--${side}`, unit.station === "head" ? "is-head" : "", unit.online ? "" : "is-offline", unit.hotspot ? "is-hot" : "", working ? "is-working" : ""].filter(Boolean).join(" ");

  return (
    <div className={classes} role="button" tabIndex={0} aria-label={`${roleLabel} · ${unit.name}`} onClick={() => onSelect(unit.id)} onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(unit.id); }
    }}>
      <svg className="factory-unit__body" viewBox="0 0 600 550" role="presentation" focusable="false">
        <defs>
          {facets.map((facet, i) => <clipPath key={i} id={`${uid}-face-${i}`}><polygon points={polygon(facet.extra ? i === 2 ? [...facet.target, facet.extra] : [facet.target[0], facet.target[1], facet.extra, facet.target[2]] : facet.target)} /></clipPath>)}
          <filter id={`${uid}-contact`}><feGaussianBlur stdDeviation="6" /></filter>
          <filter id={`${uid}-tight`}><feGaussianBlur stdDeviation="2" /></filter>
          {/* The extracted art renders whiter than the approved draft; this grades it back to the draft's warm cream and gold. */}
          <filter id={`${uid}-grade`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="1.08 0 0 0 0  0 .92 0 0 0  0 0 .82 0 0  0 0 0 1 0" />
            <feColorMatrix type="saturate" values="1.15" />
          </filter>
        </defs>
        <path className="factory-unit__contact" d={`M ${body.leftFoot.x} ${body.leftFoot.y + 3} L 270 508 L ${body.rightFoot.x} ${body.rightFoot.y + 3}`} fill="none" stroke="#0b0908" strokeWidth="34" strokeLinecap="round" opacity=".5" filter={`url(#${uid}-contact)`} />
        <path className="factory-unit__contact" d={`M ${body.leftFoot.x} ${body.leftFoot.y + 3} L 270 508 L ${body.rightFoot.x} ${body.rightFoot.y + 3}`} fill="none" stroke="#100d0b" strokeWidth="17" strokeLinecap="round" filter={`url(#${uid}-contact)`} />
        {/* A tight core where the cast body meets the floor, so it sits on it instead of floating over it. */}
        <path className="factory-unit__contact" d={`M ${body.leftFoot.x} ${body.leftFoot.y + 3} L 270 508 L ${body.rightFoot.x} ${body.rightFoot.y + 3}`} fill="none" stroke="#0a0806" strokeWidth="9" strokeLinecap="round" opacity=".85" filter={`url(#${uid}-tight)`} />
        <g filter={`url(#${uid}-grade)`}>
          {facets.map((facet, i) => <g key={i} clipPath={`url(#${uid}-face-${i})`}><image href={unitBody} width="1536" height="1024" transform={triangleMatrix(facet.source, facet.target)} /></g>)}
        </g>
        <g transform={triangleMatrix(facets[2].source, facets[2].target)}>
          <foreignObject x="139" y="436" width="531" height="221" transform="matrix(1 .48776 0 1 0 -67.798)">
      <div className="factory-unit__lcd">
        <span className="factory-unit__ident">
          <span className="factory-unit__tag">▸ #{String(index).padStart(2, "0")}</span>
          <span className="factory-unit__nameplate" title={nameplate}>{nameplate}</span>
        </span>
        <span className="factory-unit__model" title={modelLabel}>{modelLabel}</span>
        <span className="factory-unit__rate">{unit.decodeTps === null ? "—" : unit.decodeTps.toFixed(1)} <small>{t("tokPerSec")}</small></span>
        <span className="factory-unit__metrics"><span>GPU {pct}</span><span>{temp}</span><span>{unit.gpuW === null ? "—" : `${Math.round(unit.gpuW)} W`}</span></span>
      </div>
          </foreignObject>
        </g>
      </svg>
      <span className="factory-unit__number" aria-hidden="true">#{String(index).padStart(2, "0")}</span>
      <div className={`factory-unit__cab${unit.online ? " factory-unit__whale" : ""}`} aria-hidden="true">
        {/* One cab art mirrored for the right-hand units: same canopy, railing and whale crest on both sides. */}
        <img className="factory-unit__canopy" src={unit.online ? cabLeft : cabEmpty} alt="" />
        {unit.hotspot && <span className="factory-unit__heat">♨</span>}
      </div>
      <StationArm id={unit.id} side={side} placement={placement} rowY={rowY} height={height} online={unit.online} stale={stale} subscribe={subscribe} />
      <div className="factory-unit__joystick" aria-hidden="true">
        <img src={joystick} alt="" />
        <span className={`factory-unit__led${unit.online ? " is-on" : ""}`} />
        <span className={`factory-unit__led${working ? " is-on" : ""}`} />
        <span className={`factory-unit__led${unit.hotspot ? " is-hot" : ""}`} />
      </div>
      {/* The roof and LCD already carry the name and role; this caption only appears when it adds state. */}
      {(unit.station !== "standalone" || !unit.online) && <div className="factory-unit__plate">
        <span className="factory-unit__role" title={roleLabel}>{roleLabel}</span>
        <span className="factory-unit__name" title={unit.name}>{unit.name}</span>
        {!unit.online && <span className="factory-unit__offline" title={unit.offlineReason ?? undefined}>{t("offline")}{unit.offlineReason ? ` · ${unit.offlineReason}` : ""}</span>}
      </div>}
    </div>
  );
}
