import { DependencyMap, ValueDependency } from "./depMap";
import { unreachable } from "./lib/unreachable";
import {
  LastLoaded,
  Loadable,
  loadableError,
  LoadableError,
  LoadableLoading,
  loadableLoading,
  loadableValue,
  LoadableValue,
} from "./loadable";
import { Message } from "./message";
import { MessageHub } from "./messageHub";
import { makeRestartablePromise } from "./restartablePromise";
import {
  AnyAction,
  Block,
  BlockUpdateConfig,
  BlockUpdateToolbox,
  CancelLoadParams,
  EffectAction,
  Loader,
  LoaderToolbox,
  SetInitialLoaderCacheParams,
  Store,
  Unsubscribe,
} from "./storeTypes";

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
  depMap: DependencyMap;
}

type LoaderCache<V> =
  | {
      readonly state: "Stale";
      readonly loadable: null | LoadableValue<V>;
    }
  | {
      readonly state: "MaybeStale";
      readonly loadable: LoadableValue<V>;
    }
  | {
      readonly state: "Fresh";
      readonly loadable: LoadableValue<V>;
    }
  | {
      readonly state: "Loading";
      readonly loadable: LoadableLoading<V>;
      readonly revalidate: () => void;
      cancelled: boolean;
    }
  | {
      readonly state: "Error";
      readonly loadable: LoadableError<V>;
    };

interface SetLoaderValueParams<V> {
  readonly value: V;
  readonly nextDepMap: DependencyMap | null;
  readonly isTentative?: boolean;
}

export interface EffectActionState {
  runningCount: number;
}

class StoreEntity implements Store {
  private readonly messageHub = new MessageHub();
  private readonly blockStates = new Map<string, BlockState<any>>();
  private readonly loaderStates = new Map<string, LoaderState<any>>();
  private readonly effectActionStates = new Map<string, EffectActionState>();
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

    this.precomputeLoaderCacheValidity(state);
    if (state.cache.state === "Fresh") {
      return state.cache.loadable;
    }

    state.depMap.unsubscribeAll();

    const invalidateCacheViaDependency = () => {
      switch (state.cache.state) {
        case "Loading": {
          if (!state.cache.cancelled) {
            state.cache.revalidate();
          }
          break;
        }
        case "Fresh": {
          state.cache = { state: "MaybeStale", loadable: state.cache.loadable };
          this.messageHub.notify(loader.invalidated, null);
          break;
        }
        case "Error":
        case "Stale":
        case "MaybeStale": {
          break;
        }
      }
    };

    const [revalidate, promise] = makeRestartablePromise(async () => {
      const nextDepMap = new DependencyMap();
      const toolbox: LoaderToolbox = {
        get: (key) => {
          const unsubscribe = this.onInvalidate(key, invalidateCacheViaDependency);
          const value = this.get(key);
          nextDepMap.addValueDep({ key, lastValue: value, unsubscribe });
          return value;
        },
        load: (key) => {
          const unsubscribe = this.onInvalidate(key, invalidateCacheViaDependency);
          nextDepMap.addAsyncDep({ key, unsubscribe });
          return this.load(key).promise();
        },
      };
      const value = await loader.load(toolbox);
      return [value, nextDepMap] as const;
    });

    const lastLoaded = state.cache.loadable?.lastLoaded;

    const finalPromise = promise
      .then(([value, nextDepMap]) => {
        if (!loadingCache.cancelled) {
          this.setLoaderValue(loader, { value, nextDepMap });
        }
        return value;
      })
      .catch((err) => {
        if (!loadingCache.cancelled) {
          state.cache = {
            state: "Error",
            loadable: loadableError(err, lastLoaded),
          };
        }
        throw err;
      });

    const loadable = loadableLoading(finalPromise, lastLoaded);
    const loadingCache = {
      state: "Loading",
      loadable,
      revalidate,
      cancelled: false,
    } as const;
    state.cache = loadingCache;

    this.messageHub.notify(loader.started, null);
    return loadable;
  };

  private precomputeLoaderCacheValidity<V>(state: LoaderState<V>): LoaderCache<unknown>["state"] {
    if (state.cache.state !== "MaybeStale") {
      return state.cache.state;
    }
    const allFresh = [...state.depMap.dependencies()].every((d) => {
      switch (d.key.type) {
        case "Loader": {
          // If the dependency is a Loader, check its dependencies recursively.
          const st = this.getLoaderState(d.key);
          return this.precomputeLoaderCacheValidity(st) === "Fresh";
        }
        case "Block": {
          return this.get(d.key) === (d as ValueDependency<unknown>).lastValue;
        }
        default:
          unreachable(d.key);
      }
    });
    state.cache = { state: allFresh ? "Fresh" : "Stale", loadable: state.cache.loadable };
    return state.cache.state;
  }

  dispatch = <P, R>(action: AnyAction<P, R>, payload: P): R => {
    switch (action.type) {
      case "paramAction": {
        this.messageHub.notify(action.dispatched.message, payload);
        return undefined as R;
      }
      case "effectAction": {
        return this.dispatchEffectAction(action, payload);
      }
      default:
        return unreachable(action);
    }
  };

  private dispatchEffectAction<P, R>(action: EffectAction<P, R>, payload: P): R {
    this.getEffectActionState(action).runningCount += 1;
    this.messageHub.notify(action.dispatched.message, payload);

    const handleResult = (result: Awaited<R>): R => {
      this.messageHub.notify(action.done.message, result);
      return result;
    };
    const onSettled = () => {
      const state = this.getEffectActionState(action);
      state.runningCount = Math.max(0, state.runningCount - 1);
    };

    const result = action.run({}, payload);
    if (result instanceof Promise) {
      return result.then((r) => {
        onSettled();
        return handleResult(r);
      }) as R;
    } else {
      try {
        return handleResult(result as Awaited<R>);
      } finally {
        onSettled();
      }
    }
  }

  onInvalidate = <V>(key: Block<V> | Loader<V>, listener: () => void): Unsubscribe => {
    switch (key.type) {
      case "Block": {
        return this.onBlockChange(key, listener);
      }
      case "Loader": {
        return this.messageHub.subscribe(key.invalidated, listener);
      }
      default:
        return unreachable(key);
    }
  };

  onLoadStart = (loader: Loader<any>, listener: () => void): Unsubscribe => {
    return this.messageHub.subscribe(loader.started, listener);
  };

  onLoadSuccess = (loader: Loader<any>, listener: () => void): Unsubscribe => {
    return this.messageHub.subscribe(loader.done.message, listener);
  };

  onActionDispatch = (action: AnyAction<any, any>, listener: () => void): Unsubscribe => {
    return this.messageHub.subscribe(action.dispatched.message, listener);
  };

  onActionSuccess = (action: EffectAction<any, any>, listener: () => void): Unsubscribe => {
    return this.messageHub.subscribe(action.done.message, listener);
  };

  cancelLoad = <V>(loader: Loader<V>, params: CancelLoadParams = {}): boolean => {
    const state = this.getLoaderState(loader);
    if (state.cache.state !== "Loading") {
      return false;
    }
    state.cache.cancelled = true;

    const { lastLoaded } = state.cache.loadable;
    if (lastLoaded == null) {
      state.cache = { state: "Stale", loadable: null };
    } else {
      state.cache = {
        state: params.markAsStale ? "Stale" : "Fresh",
        loadable: loadableValue(lastLoaded.value, lastLoaded.loadedAt),
      };
    }
    return true;
  };

  invalidateCache = (loader: Loader<unknown>): void => {
    const state = this.getLoaderState(loader);
    switch (state.cache.state) {
      case "Loading": {
        this.cancelLoad(loader, { markAsStale: true });
        this.messageHub.notify(loader.invalidated, null);
        return;
      }
      case "Fresh":
      case "MaybeStale": {
        state.cache = { state: "Stale", loadable: state.cache.loadable };
        this.messageHub.notify(loader.invalidated, null);
        return;
      }
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

  setInitialLoaderCache = <V>(
    loader: Loader<V>,
    params: SetInitialLoaderCacheParams<V>,
  ): Loadable<V> => {
    const loadable = this.getLoaderCache(loader);
    if (loadable != null) {
      return loadable;
    }
    return this.setLoaderValue(loader, {
      value: params.value,
      isTentative: !params.skipLoad,
      nextDepMap: null,
    });
  };

  private getBlockState<V>(block: Block<V>): BlockState<V> {
    let state = this.blockStates.get(block.id);
    if (state == null) {
      const updateConfigs = this.buildBlockUpdateConfigs(block);
      state = this.initializeBlockState(block, updateConfigs);
      this.blockStates.set(block.id, state);
      this.setLatestLoaderCachesToBlock(updateConfigs);
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

  private initializeBlockState<V>(
    block: Block<V>,
    updateConfigs: readonly BlockUpdateConfig<V, any>[],
  ): BlockState<V> {
    const unsubscribes: Unsubscribe[] = [];
    updateConfigs.forEach((c) => {
      const unsubscribe = this.messageHub.subscribe(c.trigger.message, (payload) => {
        const current = this.get(block);
        const value = c.update(current, payload);
        if (value !== undefined && !block.isSame(current, value)) {
          this.setBlockValue(block, value);
        }
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

  private buildBlockUpdateConfigs<V>(block: Block<V>): readonly BlockUpdateConfig<V, any>[] {
    return block.buildUpdateConfigs((trigger, update) => {
      return { trigger, update };
    }, this.blockUpdateToolbox);
  }

  private setLatestLoaderCachesToBlock<V>(
    updateConfigs: readonly BlockUpdateConfig<V, any>[],
  ): void {
    const loadedValues = updateConfigs.reduce((ls, c) => {
      if (c.trigger.type === "loaderDone") {
        const loadable = this.getLoaderCache(c.trigger.loader());
        if (loadable?.lastLoaded != null) {
          ls.push([c.trigger.message, loadable.lastLoaded]);
        }
      }
      return ls;
    }, [] as [Message<any>, LastLoaded<any>][]);

    loadedValues.sort((a, b) => a[1].loadedAt - b[1].loadedAt);
    loadedValues.forEach(([msg, lastLoaded]) => {
      this.messageHub.notify(msg, lastLoaded.value);
    });
  }

  private getLoaderState<V>(loader: Loader<V>): LoaderState<V> {
    let state = this.loaderStates.get(loader.id);
    if (state == null) {
      state = {
        cache: { state: "Stale", loadable: null },
        depMap: new DependencyMap(),
      };
      this.loaderStates.set(loader.id, state);
    }
    return state;
  }

  private setLoaderValue<V>(loader: Loader<V>, params: SetLoaderValueParams<V>): Loadable<V> {
    const state = this.getLoaderState(loader);
    const loadable = loadableValue(params.value);
    state.cache = {
      state: params.isTentative ? "Stale" : "Fresh",
      loadable,
    };
    if (params.nextDepMap != null) {
      state.depMap = params.nextDepMap;
    }
    this.messageHub.notify(loader.done.message, params.value);
    return loadable;
  }

  isActionRunning = (action: EffectAction<unknown, unknown>): boolean => {
    return this.getEffectActionState(action).runningCount > 0;
  };

  private getEffectActionState(action: EffectAction<any, any>): EffectActionState {
    let state = this.effectActionStates.get(action.id);
    if (state == null) {
      state = { runningCount: 0 };
      this.effectActionStates.set(action.id, state);
    }
    return state;
  }
}
