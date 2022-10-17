import { Query } from "../storeTypes";
import { useLoader } from "./useLoader";
import { useValue } from "./useValue";

export const useQuery = <V>(query: Query<V>): [V] => {
  useLoader(query.loader);
  const value = useValue(query.cache);
  return [value];
};
