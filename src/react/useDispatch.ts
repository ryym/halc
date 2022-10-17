import { Dispatch } from "../storeTypes";
import { useHalc } from "./HalcContext";

export const useDispatch = (): Dispatch => {
  const { store } = useHalc();
  return store.dispatch;
};
