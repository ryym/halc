import { createContext, useContext, createElement, useMemo } from "react";
import type { ReactNode, FunctionComponentElement, ProviderProps } from "react";
import { Store } from "../storeTypes";

export interface HalcContextValue {
  readonly store: Store;
}

const HalcContext = createContext<HalcContextValue | null>(null);

export interface HalcProviderProps {
  readonly store: Store;
  readonly children?: ReactNode;
}

type HalcProviderType = FunctionComponentElement<ProviderProps<HalcContextValue | null>>;

export const HalcProvider = (props: HalcProviderProps): HalcProviderType => {
  // Keep the referential equality of context value to avoid unnecessary re-rendering.
  // Without this, all components using this context are re-rendered when HalcProvider is re-rendered.
  const contextValue: HalcContextValue = useMemo(() => {
    return { store: props.store };
  }, [props.store]);
  return createElement(HalcContext.Provider, { value: contextValue }, props.children);
};

export const useHalc = (): HalcContextValue => {
  const ctx = useContext(HalcContext);
  if (ctx == null) {
    throw new Error("[Halc] wrap your component tree by HalcProvider to use Halc");
  }
  return ctx;
};
