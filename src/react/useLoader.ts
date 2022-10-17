import { Loader } from "../storeTypes";
import { useLoadable } from "./useLoadable";

export type UseLoaderValue<V> = [latestValue: V, isLoading: boolean];

export const useLoader = <V>(loader: Loader<V>): UseLoaderValue<V> => {
  const loadable = useLoadable(loader);
  switch (loadable.state) {
    case "hasValue":
      return [loadable.value, false];
    case "hasError":
      throw loadable.error;
    case "loading":
      if (loadable.lastLoaded === undefined) {
        throw loadable.promise();
      }
      return [loadable.lastLoaded.value, true];
  }
};
