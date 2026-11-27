import whaleIdle from "./assets/whale-idle.png";
import whaleSweat from "./assets/whale-sweat.png";
import whaleTyping from "./assets/whale-typing.png";

const SOURCES = { idle: whaleIdle, typing: whaleTyping, sweat: whaleSweat } as const;
export type WhaleState = keyof typeof SOURCES;

/** One whale-girl operator in her cockpit. States are stacked and cross-faded. */
export function WhaleOperator({ state }: { state: WhaleState }) {
  const order: WhaleState[] = [state, ...(Object.keys(SOURCES) as WhaleState[]).filter((s) => s !== state)];

  return (
    <div className={`factory-whale is-${state}`} aria-hidden="true">
      {order.map((s) => (
        <img
          key={s}
          className={`factory-whale__state${s === state ? " is-active" : ""}`}
          src={SOURCES[s]}
          alt=""
        />
      ))}
    </div>
  );
}
