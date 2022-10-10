import { Loadable, loadableLoading } from "./loadable";

interface Block<V> {
  readonly id: string;
  readonly default: () => V;
  readonly changed: Message<[]>;
  readonly updateConfigs: readonly BlockUpdateConfig<V, any[]>[];
}

interface BlockUpdateConfig<V, P extends any[]> {
  message: Message<P>;
  update: (value: V, ...payload: P) => V;
}

interface Loader<V> {
  readonly load: () => Promise<V>;
  readonly done: Message<[V]>;
}

interface Action<R, Args extends any[]> {
  readonly run: (...args: Args) => R;
  readonly dispatched: Message<Args>;
  readonly done: Message<[Awaited<R>]>;
  // failed
}

class MessageHub {
  private readonly messageStates = new Map<Message<any[]>, MessageState<any[]>>();

  subscribe = <P extends any[]>(msg: Message<P>, fn: MessageSubscriber<P>): Unsubscribe => {
    this.getMessageState(msg).subscribers.push(fn);
    return () => {
      const state = this.getMessageState(msg);
      state.subscribers = state.subscribers.filter((s) => s !== fn);
    };
  };

  notify = <P extends any[]>(msg: Message<P>, ...payload: P): void => {
    const state = this.getMessageState(msg);
    state.subscribers.forEach((s) => s(...payload));
  };

  private getMessageState<P extends any[]>(msg: Message<P>): MessageState<P> {
    let state = this.messageStates.get(msg);
    if (state == null) {
      state = { subscribers: [] };
      this.messageStates.set(msg, state);
    }
    return state;
  }
}

interface Message<P extends any[]> {
  readonly payload: P;
}

type MessageSubscriber<P extends any[]> = (...payload: P) => unknown;

interface MessageState<P extends any[]> {
  subscribers: MessageSubscriber<P>[];
}

interface Store {
  readonly get: <V>(state: Block<V>) => V;
  readonly load: <V>(loader: Loader<V>, params?: LoadParams<V>) => Loadable<V>;
  readonly dispatch: <R, Args extends any[]>(action: Action<R, Args>, ...args: Args) => R;
}

interface LoadParams<V> {
  readonly initialValue?: V;
}

export class StoreEntity implements Store {
  private readonly messageHub = new MessageHub();
  private readonly blockStates = new Map<string, BlockState<any>>();

  get = <V>(block: Block<V>): V => {
    return this.getBlockState(block).current;
  };

  onBlockChange = <V>(block: Block<V>, fn: BlockChangeListener): Unsubscribe => {
    return this.messageHub.subscribe(block.changed, fn);
  };

  load = <V>(loader: Loader<V>, _params?: LoadParams<V> | undefined): Loadable<V> => {
    const promise = loader.load();
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
    const result = action.run(...args);
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
    const unsubscribes: Unsubscribe[] = [];
    block.updateConfigs.forEach((c) => {
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

type BlockChangeListener = () => void;

type Unsubscribe = () => void;

interface BlockState<V> {
  current: V;
  clearSubscriptions: () => void;
}
