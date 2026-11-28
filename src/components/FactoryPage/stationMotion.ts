import { armPeriodMs, smoothIntensity, unitActivity, type FactoryUnit } from "./factoryModel";

export interface StationMotion {
  phase: number;
  intensity: number;
  working: boolean;
  earned: number;
  released: number;
}

export function initialStationMotion(): StationMotion {
  return { phase: 0, intensity: 0, working: false, earned: 0, released: 0 };
}

/** The arm and conveyor consume this same phase, so output appears only at the claw release. */
export function advanceStation(previous: StationMotion, unit: FactoryUnit, dtMs: number, preview: boolean, stale: boolean): StationMotion {
  if (!unit.online || stale) return { ...previous, working: false, intensity: 0, earned: 0 };
  const activity = unitActivity(unit);
  const working = preview || activity.working || previous.earned >= 1;
  const intensity = smoothIntensity(previous.intensity, preview ? 0.45 : activity.intensity, dtMs);
  const advance = dtMs / (working ? armPeriodMs(intensity) : 8000);
  const next = previous.phase + advance;
  const release = working && Math.floor(next + 0.5) > Math.floor(previous.phase + 0.5);
  const earned = previous.earned + activity.tokenRate * dtMs / 1000;
  return {
    phase: next % 1,
    intensity,
    working,
    earned: release ? earned % 1 : earned,
    released: previous.released + (release ? Math.floor(earned) : 0),
  };
}
