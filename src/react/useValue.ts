import { useCallback } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { useHalc } from "./HalcContext";
import { Block } from "../storeTypes";

export const useValue = <V>(key: Block<V>): V => {
  const { store } = useHalc();
  const getSnapshot = useCallback(() => store.get(key), [store, key]);
  return useSyncExternalStore(
    useCallback((callback) => store.onInvalidate(key, callback), [store, key]),
    getSnapshot,
    getSnapshot,
  );
};
