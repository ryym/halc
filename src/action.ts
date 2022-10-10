import { defineMessage } from "./message";
import { Action, ActionToolbox } from "./storeTypes";

export interface ActionConfig<R, P> {
  readonly run: (t: ActionToolbox, payload: P) => R;
  readonly name?: string;
}

export const action = <R, P>(config: ActionConfig<R, P>): Action<R, P> => {
  const msgNameBase = config.name ? `action-${config.name}` : "anonymous-action";
  return {
    run: config.run,
    dispatched: {
      type: "action",
      message: defineMessage<P>({ name: `${msgNameBase}-dispatched` }),
    },
    done: {
      type: "action",
      message: defineMessage<Awaited<R>>({ name: `${msgNameBase}-done` }),
    },
  };
};
