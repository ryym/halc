import { useCallback, useEffect } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { useHalc } from "./HalcContext";
import { Loadable } from "../loadable";
import { Loader } from "../storeTypes";

export const useLoader = <V>(loader: Loader<V>): Loadable<V> => {
  const { store } = useHalc();

  const getSnapshot = useCallback(() => {
    return store.getLoaderCache(loader) || store.load(loader);
  }, [store, loader]);

  const loadable = useSyncExternalStore(
    useCallback((callback) => store.onLoad(loader, callback), [store, loader]),
    getSnapshot,
    getSnapshot,
  );

  useEffect(() => {
    const unsubscribe = store.onInvalidate(loader, () => {
      store.load(loader);
    });
    return unsubscribe;
  }, [store, loader]);

  return loadable;
};
