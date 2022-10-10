import { Loadable } from "./loadable";
import { Message } from "./message";

export interface Store {
  readonly get: <V>(state: Block<V>) => V;
  readonly load: <V>(loader: Loader<V>) => Loadable<V>;
  readonly dispatch: <R, P>(action: Action<R, P>, payload: P) => R;
}

export interface Block<V> {
  readonly type: "Block";
  readonly id: string;
  readonly default: () => V;
  readonly isSame: Comparer<V>;
  readonly changed: Message<never>;
  readonly buildUpdateConfigs: BlockUpdateConfigBuilder<V>;
}

export type BlockUpdateConfigBuilder<V> = (
  on: BlockUpdateMapper<V>,
  toolbox: BlockUpdateToolbox,
) => readonly BlockUpdateConfig<V, any>[];

export type BlockUpdateMapper<V> = <P>(
  message: Message<P>,
  updater: BlockUpdater<V, P>,
) => BlockUpdateConfig<V, P>;

export interface BlockUpdateConfig<V, P> {
  message: Message<P>;
  update: BlockUpdater<V, P>;
}

export interface BlockUpdateToolbox {
  readonly invlaidate: (loader: Loader<any>) => void;
}

export type BlockUpdater<V, P> = (value: V, payload: P) => V;

export interface Loader<V> {
  readonly id: string;
  readonly load: (toolbox: LoaderToolbox) => Promise<V>;
  readonly done: Message<V>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoaderToolbox {
  // We add some fields soon.
}

export interface Action<R, P> {
  readonly run: (toolbox: ActionToolbox, payload: P) => R;
  readonly dispatched: Message<P>;
  readonly done: Message<Awaited<R>>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ActionToolbox {
  // We add some fields soon.
}

export type Comparer<V> = (a: V, b: V) => boolean;

export type Unsubscribe = () => void;