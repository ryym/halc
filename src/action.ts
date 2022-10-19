import { defineMessage } from "./message";
import { ActionToolbox, EffectAction, ParamAction } from "./storeTypes";

export interface EffectActionConfig<P, R> {
  readonly run: (t: ActionToolbox, payload: P) => R;
  readonly name?: string;
}

export interface ParamActionConfig {
  readonly name?: string;
}

export const action = Object.freeze({
  param: <P>(config: ParamActionConfig = {}): ParamAction<P> => {
    const actionName = config.name || "anonymous-param-action";
    return {
      type: "paramAction",
      name: actionName,
      dispatched: {
        type: "action",
        message: defineMessage<P>({ name: `action-${actionName}-dispatched` }),
      },
    };
  },

  effect: <P, R>(config: EffectActionConfig<P, R>): EffectAction<P, R> => {
    const actionName = config.name || "anonymous-effect-action";
    return {
      type: "effectAction",
      name: actionName,
      run: config.run,
      dispatched: {
        type: "action",
        message: defineMessage<P>({ name: `action-${actionName}-dispatched` }),
      },
      done: {
        type: "action",
        message: defineMessage<Awaited<R>>({ name: `action-${actionName}-done` }),
      },
    };
  },
});
