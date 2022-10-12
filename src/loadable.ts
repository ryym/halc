export type Loadable<T> = LoadableLoading<T> | LoadableResult<T>;

export type LoadableResult<T> = LoadableValue<T> | LoadableError<T>;

interface LoadableBase<T> {
  readonly state: "loading" | "hasValue" | "hasError";
  readonly promise: () => Promise<T>;
}

export interface LastLoaded<T> {
  readonly value: T;
  readonly loadedAt: number;
}

export interface LoadableLoading<T> extends LoadableBase<T> {
  readonly state: "loading";
  readonly lastLoaded: LastLoaded<T> | undefined;
}

export interface LoadableValue<T> extends LoadableBase<T> {
  readonly state: "hasValue";
  readonly value: T;
  readonly lastLoaded: LastLoaded<T>;
}

export interface LoadableError<T> extends LoadableBase<T> {
  readonly state: "hasError";
  readonly error: unknown;
  readonly lastLoaded: LastLoaded<T> | undefined;
}

export const loadableLoading = <T>(
  promise: Promise<T>,
  lastLoaded: LastLoaded<T> | undefined,
): LoadableLoading<T> => {
  return {
    state: "loading",
    promise: () => promise,
    lastLoaded,
  };
};

export const loadableValue = <T>(value: T, loadedAt = Date.now()): LoadableValue<T> => {
  return {
    state: "hasValue",
    promise: () => Promise.resolve(value),
    value,
    lastLoaded: { value, loadedAt },
  };
};

export const loadableError = <T>(
  error: unknown,
  lastLoaded: LastLoaded<T> | undefined,
): LoadableError<T> => {
  return {
    state: "hasError",
    promise: () => Promise.reject(error),
    error,
    lastLoaded,
  };
};
