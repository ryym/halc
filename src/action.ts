import { defineMessage } from "./message";
import { Action, ActionToolbox } from "./storeTypes";

export interface ActionConfig<R, P> {
  readonly run: (t: ActionToolbox, payload: P) => R;
  readonly name?: string;
}

export const action = Object.freeze({
  empty: <P>(): Action<void, P> => {
    return action.effect({ run: (_t, _p: P) => {} });
  },

  effect: <R, P>(config: ActionConfig<R, P>): Action<R, P> => {
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
  },
});
