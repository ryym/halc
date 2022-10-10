import { unreachable } from "./lib/unreachable";
import {
  Loadable,
  loadableError,
  LoadableError,
  LoadableLoading,
  loadableLoading,
  loadableValue,
  LoadableValue,
} from "./loadable";
import { MessageHub } from "./messageHub";
import { Action, Block, BlockUpdateToolbox, Loader, Store, Unsubscribe } from "./storeTypes";

export const createStore = (): Store => {
  return new StoreEntity();
};

interface BlockState<V> {
  current: V;
  readonly clearSubscriptions: () => void;
}

type BlockChangeListener = () => void;

interface LoaderState<V> {
  cache: LoaderCache<V>;
}

type LoaderCache<V> =
  | {
      readonly state: "Stale";
      readonly loadable: null | LoadableValue<V>;
    }
  | {
      readonly state: "Fresh";
      readonly loadable: LoadableValue<V>;
    }
  | {
      readonly state: "Loading";
      readonly loadable: LoadableLoading<V>;
      cancelled: boolean;
    }
  | {
      readonly state: "Error";
      readonly loadable: LoadableError<V>;
    };

export interface CancelLoadParams {
  readonly markAsStale?: boolean;
}

class StoreEntity implements Store {
  private readonly messageHub = new MessageHub();
  private readonly blockStates = new Map<string, BlockState<any>>();
  private readonly loaderStates = new Map<string, LoaderState<any>>();
  private readonly blockUpdateToolbox: BlockUpdateToolbox;

  constructor() {
    this.blockUpdateToolbox = Object.freeze({
      invlaidate: this.invalidateCache,
    });
  }

  get = <V>(block: Block<V>): V => {
    return this.getBlockState(block).current;
  };

  onBlockChange = <V>(block: Block<V>, fn: BlockChangeListener): Unsubscribe => {
    return this.messageHub.subscribe(block.changed, fn);
  };

  load = <V>(loader: Loader<V>): Loadable<V> => {
    const state = this.getLoaderState(loader);
    if (state.cache.state === "Loading") {
      return state.cache.loadable;
    }
    if (state.cache.state === "Fresh") {
      return state.cache.loadable;
    }

    const latestValue = state.cache.loadable?.latestValue;

    const promise = loader.load({});
    const finalPromise = promise
      .then((value) => {
        if (!loadingCache.cancelled) {
          this.messageHub.notify(loader.done.message, value);
          state.cache = {
            state: "Fresh",
            loadable: loadableValue(value),
          };
        }
        return value;
      })
      .catch((err) => {
        if (!loadingCache.cancelled) {
          state.cache = {
            state: "Error",
            loadable: loadableError(err, latestValue),
          };
        }
        throw err;
      });

    const loadable = loadableLoading(finalPromise, latestValue);
    const loadingCache = {
      state: "Loading",
      loadable,
      cancelled: false,
    } as const;
    state.cache = loadingCache;

    return loadable;
  };

  dispatch = <R, P>(action: Action<R, P>, payload: P): R => {
    this.messageHub.notify(action.dispatched.message, payload);
    const handleResult = (result: Awaited<R>): R => {
      this.messageHub.notify(action.done.message, result);
      return result;
    };
    const result = action.run({}, payload);
    if (result instanceof Promise) {
      return result.then(handleResult) as R;
    } else {
      return handleResult(result as Awaited<R>);
    }
  };

  cancelLoad = <V>(loader: Loader<V>, params: CancelLoadParams = {}): boolean => {
    const state = this.getLoaderState(loader);
    if (state.cache.state !== "Loading") {
      return false;
    }
    state.cache.cancelled = true;

    const { latestValue } = state.cache.loadable;
    if (latestValue == null) {
      state.cache = { state: "Stale", loadable: null };
    } else {
      state.cache = {
        state: params.markAsStale ? "Stale" : "Fresh",
        loadable: loadableValue(latestValue),
      };
    }
    return true;
  };

  invalidateCache = (loader: Loader<any>): void => {
    const state = this.getLoaderState(loader);
    switch (state.cache.state) {
      case "Loading": {
        this.cancelLoad(loader, { markAsStale: true });
        return;
      }
      case "Fresh":
        state.cache = { state: "Stale", loadable: state.cache.loadable };
        return;
      case "Stale":
      case "Error": {
        return;
      }
      default:
        unreachable(state.cache);
    }
  };

  getLoaderCache = <V>(loader: Loader<V>): Loadable<V> | null => {
    return this.getLoaderState(loader).cache.loadable;
  };

  private getBlockState<V>(block: Block<V>): BlockState<V> {
    let state = this.blockStates.get(block.id);
    if (state == null) {
      state = this.initializeBlockState(block);
      this.blockStates.set(block.id, state);
    }
    return state;
  }

  private setBlockValue<V>(block: Block<V>, value: V): void {
    const state = this.getBlockState(block);
    if (state.current !== value) {
      state.current = value;
      this.messageHub.notify(block.changed, null);
    }
  }

  private initializeBlockState<V>(block: Block<V>): BlockState<V> {
    const updateConfigs = block.buildUpdateConfigs((trigger, update) => {
      return { trigger, update };
    }, this.blockUpdateToolbox);

    const unsubscribes: Unsubscribe[] = [];
    updateConfigs.forEach((c) => {
      const unsubscribe = this.messageHub.subscribe(c.trigger.message, (...payload) => {
        const value = c.update(this.get(block), ...payload);
        this.setBlockValue(block, value);
      });
      unsubscribes.push(unsubscribe);
    });

    return {
      current: block.default(),
      clearSubscriptions: () => {
        unsubscribes.forEach((f) => f());
      },
    };
  }

  private getLoaderState<V>(loader: Loader<V>): LoaderState<V> {
    let state = this.loaderStates.get(loader.id);
    if (state == null) {
      state = { cache: { state: "Stale", loadable: null } };
      this.loaderStates.set(loader.id, state);
    }
    return state;
  }
}
