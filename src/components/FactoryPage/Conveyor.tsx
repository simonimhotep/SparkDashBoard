import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import collectorArt from "./assets/collector-reference.webp";
import { advanceBelt, advanceTokens, createBeltFeed, feedTokens, type BeltFeed, type Token } from "./conveyorModel";
import { armPose, beltCenter, beltWidth, FLOOR, type StationPlacement, type StationSide } from "./stationGeometry";
import type { StageFrame } from "./useFactoryStage";

const cubeFaces = [
  { color: "#ffe47a", points: [[-14, -6], [-8, -14], [14, -14], [8, -6]] },
  { color: "#ca790e", points: [[8, -6], [14, -14], [14, 8], [8, 16]] },
  { color: "#ffb51f", points: [[-14, -6], [8, -6], [8, 16], [-14, 16]] },
];

/** Both treads continue into the collector mouth, hidden by its original front casting. */
const COLLECTOR = { left: 675.7, top: 896, width: 585.6, height: 143.5 } as const;
const CLEATS = 52;
/** Width of the metal frame that surrounds each belt's recessed surface. */
const FRAME = 13;

interface ConveyorProps {
  subscribe: (draw: StageFrame) => () => void;
  stations: Array<StationPlacement & { id: string; online: boolean }>;
  height: number;
}

/** Shared longitudinal tracks; each claw releases only its own measured, earned output. */
export function Conveyor({ subscribe, stations, height }: ConveyorProps) {
  const { t } = useTranslation("factory");
  const uid = useId().replaceAll(":", "");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const artRef = useRef<SVGSVGElement>(null);
  const tokens = useRef<Token[]>([]);
  const released = useRef(new Map<string, number>());
  // One queue per claw. A rail fed by two units through a single queue alternates them, and
  // their landing points are far apart, so the line would read as cubes and holes.
  const feeds = useRef(new Map<string, { side: StationSide; feed: BeltFeed }>());
  const current = useRef(stations);
  const nearBottom = height - 20;
  useEffect(() => {
    current.current = stations;
    const ids = new Set(stations.map((s) => s.id));
    for (const id of released.current.keys()) if (!ids.has(id)) released.current.delete(id);
    for (const id of feeds.current.keys()) if (!ids.has(id)) feeds.current.delete(id);
  }, [stations]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const treads = artRef.current?.querySelectorAll<SVGPathElement>("[data-tread]");
    const draw: StageFrame = (dt, phase) => {
      for (const tread of treads ?? []) {
        const progress = (Number(tread.dataset.tread) + phase.beltOffset / (32 * CLEATS)) % 1;
        const y = FLOOR.farY + (nearBottom - FLOOR.farY) * progress ** 1.3;
        const side = tread.dataset.side as StationSide;
        const x = beltCenter(side, y, height);
        const width = beltWidth(y, height) - FRAME * 2 - 6;
        tread.setAttribute("d", `M ${x - width / 2} ${y} H ${x + width / 2}`);
      }
      for (const station of current.current) {
        const motion = phase.stations.get(station.id);
        if (!motion) continue;
        let queue = feeds.current.get(station.id);
        if (!queue) { queue = { side: station.side, feed: createBeltFeed() }; feeds.current.set(station.id, queue); }
        const previous = released.current.get(station.id) ?? motion.released;
        released.current.set(station.id, motion.released);
        if (!station.online || !motion.working) continue;
        const tip = armPose(station.side, motion.phase, motion.working, station.y, height, station).tip;
        // Queue at the claw's landing point, not its instantaneous tip: the tip rides a wave, and a
        // bobbing release point would space consecutive cubes by whatever the wave had moved.
        feedTokens(queue.feed, { x: station.x + tip.x * station.scale, y: station.landingY }, motion.released - previous);
      }
      for (const { side, feed } of feeds.current.values()) {
        advanceBelt(feed, tokens.current, side, dt / 1000, phase.intensity, height);
      }
      advanceTokens(tokens.current, dt / 1000, phase.intensity, height);
      ctx.clearRect(0, 0, 1920, height + 30);
      for (const token of tokens.current) {
        ctx.save();
        ctx.translate(token.x, token.y);
        ctx.shadowColor = "#ff9f1a";
        ctx.shadowBlur = 18;
        ctx.strokeStyle = "#ffe8a0";
        ctx.lineWidth = 1.2;
        // The draft's cubes each cover about half the belt's inner width.
        ctx.scale(1.3, 1.3);
        for (const face of cubeFaces) {
          ctx.beginPath();
          face.points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
          ctx.closePath();
          ctx.fillStyle = face.color;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.stroke();
        }
        ctx.strokeStyle = "#fff8db";
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-10, -2, 14, 14);
        ctx.strokeRect(-6, 2, 6, 6);
        ctx.restore();
      }
    };
    return subscribe(draw);
  }, [subscribe, height]);

  /** The approved belt is a metal frame around a recessed dark surface, not a painted stripe. */
  const rail = (side: StationSide, inset = 0) => {
    const farHalf = Math.max(4, FLOOR.farWidth / 2 - inset);
    const nearHalf = Math.max(4, FLOOR.nearWidth / 2 - inset);
    const top = beltCenter(side, FLOOR.farY, height);
    const bottom = beltCenter(side, nearBottom, height);
    const topY = FLOOR.farY + inset * 0.4;
    const bottomY = nearBottom - inset * 0.7;
    return `M ${top - farHalf} ${topY} L ${top + farHalf} ${topY} L ${bottom + nearHalf} ${bottomY} L ${bottom - nearHalf} ${bottomY} Z`;
  };
  return (
    <div className="factory-belts" aria-hidden="true">
      <svg ref={artRef} className="factory-belts__art" width="1920" height={height + 30} viewBox={`0 0 1920 ${height + 30}`}>
        <defs>
          {(["left", "right"] as const).map((side) => <clipPath key={side} id={`${uid}-${side}`}><path d={rail(side, FRAME)} /></clipPath>)}
          <linearGradient id={`${uid}-frame`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#eceae5" /><stop offset=".45" stopColor="#cfcec9" /><stop offset="1" stopColor="#a6a5a0" /></linearGradient>
          {/* The approved belt is a mid-grey ribbed mat, not a black stripe; the ribs read as grooves. */}
          <linearGradient id={`${uid}-surface`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#4b4640" /><stop offset=".45" stopColor="#565049" /><stop offset="1" stopColor="#665e54" /></linearGradient>
          <filter id={`${uid}-drop`}><feGaussianBlur stdDeviation="9" /></filter>
        </defs>
        {(["left", "right"] as const).map((side) => <g key={side} className={`factory-belt factory-belt--${side}`}>
          {/* The trough is cast metal: a soft drop shadow, a solid frame, and the belt sunk inside it. */}
          <path d={rail(side)} transform="translate(0 24)" fill="#08090a" opacity=".85" filter={`url(#${uid}-drop)`} />
          <path d={rail(side)} fill={`url(#${uid}-frame)`} stroke={`url(#${uid}-frame)`} strokeWidth="7" strokeLinejoin="round" />
          <path d={rail(side, FRAME)} fill={`url(#${uid}-surface)`} stroke="#0b0a09" strokeWidth="2.5" strokeLinejoin="round" />
          <g clipPath={`url(#${uid}-${side})`}>
            {Array.from({ length: CLEATS }, (_, i) => {
              const progress = i / CLEATS;
              const y = FLOOR.farY + (nearBottom - FLOOR.farY) * progress ** 1.3;
              const x = beltCenter(side, y, height);
              const width = beltWidth(y, height) - FRAME * 2 - 6;
              return <path key={i} data-tread={progress} data-side={side} d={`M ${x - width / 2} ${y} H ${x + width / 2}`} stroke="#35312c" strokeWidth="3" />;
            })}
          </g>
          {/* A single specular line along the frame's outer edge, as on the approved belt. */}
          <path d={rail(side)} fill="none" stroke="#fbfaf6" strokeWidth="1.8" strokeLinejoin="round" opacity=".7" />
        </g>)}
      </svg>
      <canvas ref={canvasRef} className="factory-tokens" width={1920} height={height + 30} />
      {/* Front casting and its nameplate come from the approved image; the mouth stays open.
          It sits above the cubes so they slide into the mouth instead of vanishing in front of it. */}
      <svg className="factory-belts__art factory-collector-layer" width="1920" height={height + 30} viewBox={`0 0 1920 ${height + 30}`}>
        <ellipse cx="968" cy="1038" rx="300" ry="22" fill="#000" opacity=".45" filter={`url(#${uid}-drop)`} />
        <g className="factory-collector">
          <image href={collectorArt} x={COLLECTOR.left} y={COLLECTOR.top} width={COLLECTOR.width} height={COLLECTOR.height} />
        </g>
      </svg>
      <span className="factory-collector__label">{`{ } ${t("collector")}`}</span>
    </div>
  );
}
