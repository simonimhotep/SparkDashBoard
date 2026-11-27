import bossAsleep from "./assets/boss-asleep.png";
import bossBusy from "./assets/boss-busy.png";
import bossTea from "./assets/boss-tea.png";

const SOURCES = { tea: bossTea, busy: bossBusy, asleep: bossAsleep } as const;
type BossState = keyof typeof SOURCES;

interface BossOfficeProps {
  /** Fleet intensity: the office breathes a little faster while the line runs. */
  intensity: number;
  /** The line is doing real work. */
  busy: boolean;
  /** Late, idle, and 辉哥 has dozed off. */
  asleep: boolean;
}

/**
 * 辉哥 in the glass office. The three states are stacked and cross-faded by opacity,
 * and the active one is rendered first so it is the office's visible image.
 */
export function BossOffice({ busy, asleep }: BossOfficeProps) {
  const state: BossState = asleep ? "asleep" : busy ? "busy" : "tea";
  const order: BossState[] = [state, ...(Object.keys(SOURCES) as BossState[]).filter((s) => s !== state)];

  return (
    <div className="factory-boss" aria-hidden="true">
      {order.map((s) => (
        <img
          key={s}
          className={`factory-boss__state${s === state ? " is-active" : ""}`}
          src={SOURCES[s]}
          alt=""
        />
      ))}
    </div>
  );
}
