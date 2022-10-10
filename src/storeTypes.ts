import { Loadable } from "./loadable";
import { Message } from "./message";

export interface Store {
  readonly get: <V>(state: Block<V>) => V;
  readonly load: <V>(loader: Loader<V>) => Loadable<V>;
  readonly dispatch: <R, Args extends any[]>(action: Action<R, Args>, ...args: Args) => R;
}

export interface Block<V> {
  readonly type: "Block";
  readonly id: string;
  readonly default: () => V;
  readonly isSame: Comparer<V>;
  readonly changed: Message<[]>;
  readonly buildUpdateConfigs: BlockUpdateConfigBuilder<V>;
}

export type BlockUpdateConfigBuilder<V> = (
  on: BlockUpdateMapper<V>,
) => readonly BlockUpdateConfig<V, any[]>[];

export type BlockUpdateMapper<V> = <P extends any[]>(
  message: Message<P>,
  updater: BlockUpdater<V, P>,
) => BlockUpdateConfig<V, P>;

export interface BlockUpdateConfig<V, P extends any[]> {
  message: Message<P>;
  update: BlockUpdater<V, P>;
}

export type BlockUpdater<V, P extends any[]> = (value: V, ...payload: P) => V;

export interface Loader<V> {
  readonly id: string;
  readonly load: (toolbox: LoaderToolbox) => Promise<V>;
  readonly done: Message<[V]>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoaderToolbox {
  // We add some fields soon.
}

export interface Action<R, Args extends any[]> {
  readonly run: (toolbox: ActionToolbox, ...args: Args) => R;
  readonly dispatched: Message<Args>;
  readonly done: Message<[Awaited<R>]>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ActionToolbox {
  // We add some fields soon.
}

export type Comparer<V> = (a: V, b: V) => boolean;

export type Unsubscribe = () => void;
