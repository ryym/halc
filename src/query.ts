import { block } from "./block";
import { generateId } from "./globalId";
import { loader } from "./loader";
import { BlockUpdateConfigBuilder, Comparer, LoaderToolbox, Query } from "./storeTypes";

export interface QueryConfig<V> {
  readonly load: (toolbox: LoaderToolbox) => Promise<V>;
  readonly default?: () => V;
  readonly name?: string;
  readonly isSame?: Comparer<V>;
  readonly update?: BlockUpdateConfigBuilder<V>;
}

export const query = <V>(config: QueryConfig<V>): Query<V> => {
  const idBase = generateId();
  const queryName = config.name ? `query-${config.name}` : `query[${idBase}]`;
  const queryLoader = loader({
    load: config.load,
    id: `${idBase}-q-loader`,
    name: `${queryName}-loader`,
  });
  const cacheBlock = block({
    default: () => {
      if (config.default == null) {
        throw new QueryNoCacheError(queryName);
      }
      return config.default();
    },
    id: `${idBase}-q-cache`,
    name: `${queryName}-cache`,
    isSame: config.isSame,
    update: (on, t) => {
      const updates = config.update?.(on, t) || [];
      return [on(queryLoader.done, (_, value) => value), ...updates];
    },
  });
  return { loader: queryLoader, cache: cacheBlock };
};

export class QueryNoCacheError extends Error {
  constructor(queryName: string) {
    super(
      `[Halc] cache of Query ${queryName} accessed but not loaded yet and no initial value provided`,
    );
  }
}
