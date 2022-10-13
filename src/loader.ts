import { generateId } from "./globalId";
import { defineMessage } from "./message";
import { Loader, LoaderToolbox } from "./storeTypes";

export interface LoaderConfig<V> {
  readonly load: (toolbox: LoaderToolbox) => Promise<V>;
  readonly name?: string;
}

export const loader = <V>(config: LoaderConfig<V>): Loader<V> => {
  const id = generateId();
  const loaderName = config.name ? `loader-${config.name}` : `loader[${id}]`;
  const loader: Loader<V> = {
    type: "Loader",
    id,
    load: config.load,
    done: {
      type: "loaderDone",
      loader: () => loader,
      message: defineMessage<V>({ name: `${loaderName}-done` }),
    },
    invalidated: defineMessage<never>({ name: `${loaderName}-invalidated` }),
  };
  return loader;
};
