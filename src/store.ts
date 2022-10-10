import { Loadable, loadableLoading } from "./loadable";
import { MessageHub } from "./messageHub";
import { Action, Block, Loader, Store, Unsubscribe } from "./storeTypes";

export const createStore = (): Store => {
  return new StoreEntity();
};

interface BlockState<V> {
  current: V;
  readonly clearSubscriptions: () => void;
}

export type BlockChangeListener = () => void;

class StoreEntity implements Store {
  private readonly messageHub = new MessageHub();
  private readonly blockStates = new Map<string, BlockState<any>>();

  get = <V>(block: Block<V>): V => {
    return this.getBlockState(block).current;
  };

  onBlockChange = <V>(block: Block<V>, fn: BlockChangeListener): Unsubscribe => {
    return this.messageHub.subscribe(block.changed, fn);
  };

  load = <V>(loader: Loader<V>): Loadable<V> => {
    const promise = loader.load({});
    const finalPromise = promise.then((value) => {
      this.messageHub.notify(loader.done, value);
      return value;
    });
    return loadableLoading(finalPromise, undefined);
  };

  dispatch = <R, Args extends any[]>(action: Action<R, Args>, ...args: Args): R => {
    this.messageHub.notify(action.dispatched, ...args);
    const handleResult = (result: Awaited<R>): R => {
      this.messageHub.notify(action.done, result);
      return result;
    };
    const result = action.run({}, ...args);
    if (result instanceof Promise) {
      return result.then(handleResult) as R;
    } else {
      return handleResult(result as Awaited<R>);
    }
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
      this.messageHub.notify(block.changed);
    }
  }

  private initializeBlockState<V>(block: Block<V>): BlockState<V> {
    const updateConfigs = block.buildUpdateConfigs((message, update) => {
      return { message, update };
    });

    const unsubscribes: Unsubscribe[] = [];
    updateConfigs.forEach((c) => {
      const unsubscribe = this.messageHub.subscribe(c.message, (...payload) => {
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
}
