import { action } from "../action";
import { block } from "../block";
import { loader } from "../loader";
import { createStore } from "../store";
import { Pauser } from "./lib/pauser";

describe("Store", () => {
  describe("Store.get", () => {
    it("returns default value on first call", () => {
      const numState = block({
        default: () => 0,
      });
      const store = createStore();
      expect(store.get(numState)).toEqual(0);
    });
  });

  describe("Store.dispatch", () => {
    it("runs given action", () => {
      let num = 3;
      const addNumAction = action.effect({
        run: (_t, n: number) => {
          num += n;
        },
      });
      const store = createStore();
      store.dispatch(addNumAction, 5);
      expect(num).toEqual(8);
    });

    it("can handle async function", async () => {
      let num = 3;
      const pauser = new Pauser();
      const addNumAction = action.effect({
        run: async (_t, n: number) => {
          await pauser.pause();
          num += n;
          return [n];
        },
      });
      const store = createStore();
      const promise = store.dispatch(addNumAction, 5);
      expect(promise).toBeInstanceOf(Promise);
      expect(num).toEqual(3);
      pauser.resume();
      expect(await promise).toEqual([5]);
      expect(num).toEqual(8);
    });
  });

  describe("Store.load", () => {
    it("loads value and returns Loadable", async () => {
      const numLoader = loader({
        load: () => Promise.resolve(5),
      });
      const store = createStore();
      const loadable = store.load(numLoader);
      expect(loadable.state).toEqual("loading");
      expect(await loadable.promise()).toEqual(5);
    });

    it("reuses current loading if exists", async () => {
      const pauser = new Pauser();
      let called = 0;
      const numLoader = loader({
        load: async () => {
          called += 1;
          await pauser.pause();
          return called;
        },
      });
      const store = createStore();

      const loadable1 = store.load(numLoader);
      const loadable2 = store.load(numLoader);
      expect([loadable1.state, loadable2.state]).toEqual(["loading", "loading"]);

      pauser.resume();
      const values = await Promise.all([loadable1.promise(), loadable2.promise()]);
      expect(values).toEqual([1, 1]);
    });

    it("skips loading if cache exists", async () => {
      let called = 0;
      const numLoader = loader({
        load: async () => {
          called += 1;
          return 5;
        },
      });
      const store = createStore();

      expect(await store.load(numLoader).promise()).toEqual(5);
      expect(await store.load(numLoader).promise()).toEqual(5);
      expect(called).toEqual(1);
    });

    describe("when any of dependencies changed", () => {
      it("re-computes value (direct dependency changes)", async () => {
        const numValue = block({ default: () => 2 });
        let nCalled = 0;
        const squareValue = loader({
          load: async (t) => {
            nCalled += 1;
            return t.get(numValue) * t.get(numValue);
          },
        });

        const store = createStore();
        const values: number[] = [];
        values.push(await store.load(squareValue).promise());
        values.push(await store.load(squareValue).promise());
        store.setValue(numValue, 7);
        values.push(await store.load(squareValue).promise());
        values.push(await store.load(squareValue).promise());

        expect({ values, nCalled }).toEqual({ values: [4, 4, 49, 49], nCalled: 2 });
      });

      it("re-computes value (indirect dependency changes)", async () => {
        const numValue = block({ default: () => 2 });
        const squareValue = loader({
          load: async (t) => t.get(numValue) * t.get(numValue),
        });
        let nCalled = 0;
        const minusValue = loader({
          load: async (t) => {
            nCalled += 1;
            const sq = await t.load(squareValue);
            return sq * -1;
          },
        });

        const store = createStore();
        const values: number[] = [];
        values.push(await store.load(minusValue).promise());
        values.push(await store.load(minusValue).promise());
        store.setValue(numValue, 9);
        values.push(await store.load(minusValue).promise());
        values.push(await store.load(minusValue).promise());

        expect({ values, nCalled }).toEqual({ values: [-4, -4, -81, -81], nCalled: 2 });
      });

      it.todo("skip re-computation if possible (selector dependency)");
      it.todo("skip re-computation if possible (selector dependency via loader)");
    });

    describe("when any of dependencies changed during computation", () => {
      it("re-computes value and returns the newer result", async () => {
        const pauser = new Pauser();
        const numValue = block({ default: () => 4 });
        const squareValue = loader({
          load: async (t) => {
            const n = t.get(numValue);
            if (n === 4) {
              await pauser.pause();
            }
            return n * n;
          },
        });
        const store = createStore();

        // It resolves to the value 9*9 even if the block is changed after
        // the loader computation starts.
        const squarePromise1 = store.load(squareValue).promise();
        store.setValue(numValue, 9);
        pauser.resume();
        expect(await squarePromise1).toEqual(81);
      });

      it("discards first computation immediately on revalidation", async () => {
        const pauser = new Pauser();
        const numValue = block({ default: () => 4 });
        const squareValue = loader({
          load: async (t) => {
            const n = t.get(numValue);
            if (n === 4) {
              await pauser.pause();
            }
            return n * n;
          },
        });
        const store = createStore();

        // The first call that depends on numValue:4 never finishes
        // since we does not resume the pauser. But the promise resolves with no problem.
        const squarePromise1 = store.load(squareValue).promise();
        store.setValue(numValue, 9);
        expect(await squarePromise1).toEqual(81);
      });
    });

    describe("when same loader runs during computation", () => {
      describe("when dependencies does not change", () => {
        it("shares the current computation result", async () => {
          const pauser = new Pauser();
          const numValue = block({ default: () => 4 });
          let nCalled = 0;
          const squareValue = loader({
            load: async (t) => {
              nCalled += 1;
              const n = t.get(numValue);
              await pauser.pause();
              return n * n;
            },
          });
          const store = createStore();

          const squarePromises = [
            store.load(squareValue).promise(),
            store.load(squareValue).promise(),
          ];
          pauser.resume();
          const values = await Promise.all(squarePromises);

          expect({ values, nCalled }).toEqual({ values: [16, 16], nCalled: 1 });
        });
      });

      describe("when any of dependencies has changed", () => {
        it("discards first computation and all calls get newer result", async () => {
          const pauser = new Pauser();
          const numValue = block({ default: () => 4 });
          let nCalled = 0;
          const squareValue = loader({
            load: async (t) => {
              nCalled += 1;
              const n = t.get(numValue);
              if (n === 4) {
                await pauser.pause();
              }
              return n * n;
            },
          });
          const store = createStore();

          const promises: Promise<unknown>[] = [];
          promises.push(store.load(squareValue).promise());
          promises.push(store.load(squareValue).promise());
          store.setValue(numValue, 9);
          pauser.resume();
          promises.push(store.load(squareValue).promise());
          promises.push(store.load(squareValue).promise());

          const values = await Promise.all(promises);
          expect({ values, nCalled }).toEqual({
            values: [81, 81, 81, 81],
            nCalled: 2,
          });
        });
      });
    });

    describe("when computation failed", () => {
      it("reruns computation on next call", async () => {
        let shouldThrow = true;
        const numValue = loader({
          load: async () => {
            if (shouldThrow) {
              throw "fake-error";
            }
            return 10;
          },
        });
        const store = createStore();

        const firstResult = store.load(numValue);
        const err = await firstResult.promise().catch((err) => err);
        shouldThrow = false;
        const value = await store.load(numValue).promise();
        expect([err, value]).toEqual(["fake-error", 10]);
      });
    });
  });

  describe("Store.cancelLoad", () => {
    it.todo("cancels loading if loading is currently running");
  });

  describe("Store.invalidateCache", () => {
    it.todo("invalidates loader cache");
  });

  describe("Block and Action", () => {
    test("Block can update its value when Action is dispatched", () => {
      const numState = block({
        default: () => 0,
        update: (on) => [
          on(addNum.dispatched, (v, n) => v + n),
          on(subtractNum.dispatched, (v, n) => v - n),
        ],
      });
      const addNum = action.empty<number>();
      const subtractNum = action.empty<number>();
      const store = createStore();

      expect(store.get(numState)).toEqual(0);
      store.dispatch(addNum, 4);
      expect(store.get(numState)).toEqual(4);
      store.dispatch(addNum, 8);
      expect(store.get(numState)).toEqual(12);
      store.dispatch(subtractNum, 3);
      expect(store.get(numState)).toEqual(9);
      store.dispatch(subtractNum, 5);
      store.dispatch(addNum, 30);
      expect(store.get(numState)).toEqual(34);
    });
  });

  describe("Block and Loader", () => {
    test("Block can update its value when Loader is done", async () => {
      const nameOptions = block<string[]>({
        default: () => [],
        update: (on) => [on(namesLoader.done, (_, names) => names)],
      });
      const namesLoader = loader({
        load: () => Promise.resolve(["Alice", "Bob"]),
      });
      const store = createStore();

      expect(store.get(nameOptions)).toEqual([]);
      await store.load(namesLoader).promise();
      expect(store.get(nameOptions)).toEqual(["Alice", "Bob"]);
    });

    test("Block uses latest loader cache when initialized", async () => {
      const nameOptions = block<string[]>({
        default: () => [],
        update: (on) => [on(namesLoader.done, (_, names) => names)],
      });
      const namesLoader = loader({
        load: () => Promise.resolve(["Alice", "Bob"]),
      });
      const store = createStore();

      await store.load(namesLoader).promise();
      expect(store.get(nameOptions)).toEqual(["Alice", "Bob"]);
    });
  });

  describe("Block and Action and Loader", () => {
    test("Block can invalidate loader cache on update", async () => {
      let users = [{ name: "Alice" }, { name: "Bob" }];
      const usersLoader = loader({
        load: () => Promise.resolve([...users]),
      });
      const nameOptions = block<string[]>({
        default: () => [],
        update: (on, t) => [
          on(usersLoader.done, (_, users) => users.map((u) => u.name)),
          on(addUserAction.done, (names) => {
            t.invlaidate(usersLoader);
            return names;
          }),
        ],
      });
      const addUserAction = action.effect({
        run: async (_t, name: string) => {
          users = [...users, { name }];
        },
      });
      const store = createStore();

      await store.load(usersLoader).promise();
      expect(store.get(nameOptions)).toEqual(["Alice", "Bob"]);
      await store.load(usersLoader).promise();
      expect(store.get(nameOptions)).toEqual(["Alice", "Bob"]);

      await store.dispatch(addUserAction, "Carol");
      await store.load(usersLoader).promise();
      expect(store.get(nameOptions)).toEqual(["Alice", "Bob", "Carol"]);
    });
  });
});
