export interface PauserState {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

// Pauser is a test util to create a Promise resolvable imperatively.
export class Pauser {
  private state: PauserState | null = null;

  pause(): Promise<void> {
    if (this.state == null) {
      let resolve: () => void = () => {};
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      this.state = { promise, resolve };
    }
    return this.state.promise;
  }

  resume(): void {
    if (this.state == null) {
      throw new Error("[Pauser] call .pause() first");
    }
    this.state.resolve();
    this.state = null;
  }
}
