import { generateId } from "./globalId";
import { defineMessage } from "./message";
import { Loader, LoaderToolbox } from "./storeTypes";

export interface LoaderConfig<V> {
  readonly load: (toolbox: LoaderToolbox) => Promise<V>;
  readonly name?: string;
}

export const loader = <V>(config: LoaderConfig<V>): Loader<V> => {
  const msgNameBase = config.name ? `loader-${config.name}` : "anonymous-loader";
  return {
    id: generateId(),
    load: config.load,
    done: defineMessage<V>({ name: `${msgNameBase}-done` }),
  };
};
