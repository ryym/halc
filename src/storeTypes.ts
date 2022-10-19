import { Loadable } from "./loadable";
import { Message } from "./message";

export interface Store {
  readonly get: <V>(state: Block<V>) => V;
  readonly load: <V>(loader: Loader<V>) => Loadable<V>;
  readonly dispatch: <P, R>(action: AnyAction<P, R>, payload: P) => R;
  readonly onInvalidate: <V>(key: Block<V> | Loader<V>, listener: () => void) => Unsubscribe;
  readonly onLoadStart: <V>(loader: Loader<V>, listener: () => void) => Unsubscribe;
  readonly onLoadEnd: <V>(loader: Loader<V>, listener: () => void) => Unsubscribe;
  readonly cancelLoad: <V>(loader: Loader<V>, params?: CancelLoadParams) => boolean;
  readonly invalidateCache: (loader: Loader<unknown>) => void;
  readonly getLoaderCache: <V>(loader: Loader<V>) => Loadable<V> | null;
  readonly setInitialLoaderCache: <V>(
    loader: Loader<V>,
    params: SetInitialLoaderCacheParams<V>,
  ) => Loadable<V>;
}

export type Dispatch = Store["dispatch"];

export interface CancelLoadParams {
  readonly markAsStale?: boolean;
}

export interface SetInitialLoaderCacheParams<V> {
  readonly value: V;
  readonly skipLoad?: boolean;
}

export interface Block<V> {
  readonly type: "Block";
  readonly id: string;
  readonly default: () => V;
  readonly name: string;
  readonly isSame: Comparer<V>;
  readonly changed: Message<never>;
  readonly buildUpdateConfigs: BlockUpdateConfigBuilder<V>;
}

export type BlockUpdateConfigBuilder<V> = (
  on: BlockUpdateMapper<V>,
  toolbox: BlockUpdateToolbox,
) => readonly BlockUpdateConfig<V, any>[];

export type BlockUpdateMapper<V> = <P>(
  trigger: BlockUpdateTrigger<P>,
  updater: BlockUpdater<V, P>,
) => BlockUpdateConfig<V, P>;

export type BlockUpdateTrigger<P> =
  | {
      readonly type: "loaderDone";
      readonly loader: () => Loader<P>;
      readonly message: Message<P>;
    }
  | {
      readonly type: "action";
      readonly message: Message<P>;
    };

export interface BlockUpdateConfig<V, P> {
  trigger: BlockUpdateTrigger<P>;
  update: BlockUpdater<V, P>;
}

export interface BlockUpdateToolbox {
  readonly invlaidate: (loader: Loader<any>) => void;
}

export type BlockUpdater<V, P> = (value: V, payload: P) => V | void;

export interface Loader<V> {
  readonly type: "Loader";
  readonly id: string;
  readonly name: string;
  readonly load: (toolbox: LoaderToolbox) => Promise<V>;
  readonly invalidated: Message<never>;
  readonly started: Message<never>;
  readonly done: BlockUpdateTrigger<V>;
}

export interface LoaderToolbox {
  readonly get: <V>(state: Block<V>) => V;
  readonly load: <V>(loader: Loader<V>) => Promise<V>;
}

export interface Query<V> {
  readonly loader: Loader<V>;
  readonly cache: Block<V>;
}

export interface ParamAction<P> {
  readonly type: "paramAction";
  readonly name: string;
  readonly dispatched: BlockUpdateTrigger<P>;
}

export interface EffectAction<P, R> {
  readonly type: "effectAction";
  readonly name: string;
  readonly run: (toolbox: ActionToolbox, payload: P) => R;
  readonly dispatched: BlockUpdateTrigger<P>;
  readonly done: BlockUpdateTrigger<Awaited<R>>;
}

export type AnyAction<P, R> = ParamAction<P> | EffectAction<P, R>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ActionToolbox {
  // We add some fields soon.
}

export type Comparer<V> = (a: V, b: V) => boolean;

export type Unsubscribe = () => void;
