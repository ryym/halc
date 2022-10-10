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
      const addNumAction = action({
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
      const addNumAction = action({
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
      const addNum = action({
        run: (_t, _n: number) => {},
      });
      const subtractNum = action({
        run: (_t, _n: number) => {},
      });
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
  });
});
