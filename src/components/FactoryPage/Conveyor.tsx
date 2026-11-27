import { useEffect, useRef } from "react";
import { advanceTokens, CONVEYOR_H, CONVEYOR_W, spawnTokens, type Token } from "./conveyorModel";
import type { StageFrame } from "./useFactoryStage";

interface ConveyorProps {
  subscribe: (draw: StageFrame) => () => void;
  /** Tokens per second to emit toward the hopper. */
  rate: number;
}

/**
 * The token conveyor: two belts run toward the central hopper, and a capped pool of
 * token cubes rides them. Only a Canvas, so 120 cubes stay cheap at any rate.
 */
export function Conveyor({ subscribe, rate }: ConveyorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tokens = useRef<Token[]>([]);
  const accumulator = useRef(0);
  const rateRef = useRef(rate);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, CONVEYOR_W, CONVEYOR_H);
      for (const token of tokens.current) {
        ctx.save();
        ctx.translate(token.x, token.y);
        ctx.rotate(token.tilt);
        ctx.fillStyle = "#f0b24a";
        ctx.shadowColor = "rgba(240, 178, 74, 0.85)";
        ctx.shadowBlur = 10;
        ctx.fillRect(-6, -6, 12, 12);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255, 226, 168, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.restore();
      }
    };

    const step: StageFrame = (dtMs, phase) => {
      const dt = dtMs / 1000;
      accumulator.current = spawnTokens(tokens.current, accumulator.current, rateRef.current, dt);
      advanceTokens(tokens.current, dt, phase.intensity);
      draw();
    };

    draw();
    return subscribe(step);
  }, [subscribe]);

  return (
    <div className="factory-belts" aria-hidden="true">
      <div className="factory-belt factory-belt--left" />
      <div className="factory-belt factory-belt--right" />
      <canvas ref={canvasRef} className="factory-tokens" width={CONVEYOR_W} height={CONVEYOR_H} />
    </div>
  );
}
