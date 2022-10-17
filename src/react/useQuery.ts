import { Query } from "../storeTypes";
import { useLoader } from "./useLoader";
import { useValue } from "./useValue";

export type UseQueryValue<V> = [latestValue: V, isLoading: boolean];

export const useQuery = <V>(query: Query<V>): UseQueryValue<V> => {
  const [, isLoading] = useLoader(query.loader);
  const value = useValue(query.cache);
  return [value, isLoading];
};
