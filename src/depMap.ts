import { Block, Loader } from "./storeTypes";

export class DependencyMap {
  private readonly map = new Map<string, AnyDependency<any>>();

  addValueDep<V>(dep: ValueDependency<V>): void {
    this.map.set(dep.key.id, dep);
  }

  addAsyncDep<V>(dep: AsyncDependency<V>): void {
    this.map.set(dep.key.id, dep);
  }

  mustGetValueDep<V>(key: ValueDependencyKey<V>): ValueDependency<V> {
    return this.map.get(key.id) as ValueDependency<V>;
  }

  mustGetAsyncDep<V>(key: AsyncDependencyKey<V>): AsyncDependency<V> {
    return this.map.get(key.id) as AsyncDependency<V>;
  }

  dependencies(): IterableIterator<AnyDependency<any>> {
    return this.map.values();
  }

  unsubscribeAll(): void {
    for (const d of this.dependencies()) {
      d.unsubscribe();
    }
  }
}

export type ValueDependencyKey<V> = Block<V>;

export type AsyncDependencyKey<V> = Loader<V>;

export type AnyDependencyKey<V> = ValueDependencyKey<V> | AsyncDependencyKey<V>;

export type AnyDependency<V> = ValueDependency<V> | AsyncDependency<V>;

export interface ValueDependency<V> {
  readonly key: ValueDependencyKey<V>;
  readonly lastValue: V;
  readonly unsubscribe: () => void;
}

export interface AsyncDependency<V> {
  readonly key: Loader<V>;
  readonly unsubscribe: () => void;
}
