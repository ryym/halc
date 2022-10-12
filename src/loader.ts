import { generateId } from "./globalId";
import { defineMessage } from "./message";
import { Loader, LoaderToolbox } from "./storeTypes";

export interface LoaderConfig<V> {
  readonly load: (toolbox: LoaderToolbox) => Promise<V>;
  readonly name?: string;
}

export const loader = <V>(config: LoaderConfig<V>): Loader<V> => {
  const msgNameBase = config.name ? `loader-${config.name}` : "anonymous-loader";
  const loader: Loader<V> = {
    type: "Loader",
    id: generateId(),
    load: config.load,
    done: {
      type: "loaderDone",
      loader: () => loader,
      message: defineMessage<V>({ name: `${msgNameBase}-done` }),
    },
    invalidated: defineMessage<never>({ name: `${msgNameBase}-invalidated` }),
  };
  return loader;
};
