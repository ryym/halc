import { useCallback } from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";
import { EffectAction } from "../storeTypes";
import { useHalc } from "./HalcContext";

export type ActionStateValue = [isRunning: boolean];

export const useActionState = (action: EffectAction<any, any>): ActionStateValue => {
  const { store } = useHalc();

  const getSnapshot = useCallback(() => {
    return store.isActionRunning(action);
  }, [store, action]);

  const value = useSyncExternalStore(
    useCallback(
      (callback) => {
        const unsubscribes = [
          store.onActionDispatch(action, callback),
          store.onActionSuccess(action, callback),
        ];
        return () => unsubscribes.forEach((f) => f());
      },
      [store, action],
    ),
    getSnapshot,
    getSnapshot,
  );

  return [value];
};
