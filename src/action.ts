import { defineMessage } from "./message";
import { Action, ActionToolbox } from "./storeTypes";

export interface ActionConfig<R, Args extends any[]> {
  readonly run: (t: ActionToolbox, ...args: Args) => R;
  readonly name?: string;
}

export const action = <R, Args extends any[]>(config: ActionConfig<R, Args>): Action<R, Args> => {
  const msgNameBase = config.name ? `action-${config.name}` : "anonymous-action";
  return {
    run: config.run,
    dispatched: defineMessage<Args>({ name: `${msgNameBase}-dispatched` }),
    done: defineMessage<[Awaited<R>]>({ name: `${msgNameBase}-done` }),
  };
};
