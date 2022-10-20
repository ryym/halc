import { FormEvent, useState } from "react";
import { action, query } from "../../dist/esm";
import { useDispatch, useQuery } from "../../dist/esm/react";
import { useActionState } from "../../dist/esm/react/useActionState";

export function Page1() {
  const [users, isLoading] = useQuery(userListQuery);
  const dispatch = useDispatch();
  const [addingUser] = useActionState(addUserAction);

  const [input, setInput] = useState("");
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    dispatch(addUserAction, input);
  };

  return (
    <div>
      <h1>Page 1: User List</h1>
      <form onSubmit={handleSubmit}>
        name: <input type="text" value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={addingUser}>
          add user
        </button>
      </form>
      <hr />
      <div>
        <p>
          <span style={{ fontSize: "1.5rem" }}>All users</span>
          {isLoading && <span style={{ marginLeft: "1em" }}>(refreshing...)</span>}
        </p>
        {users.map((user) => (
          <div key={user.id} style={user.id === 0 ? { color: "#ccc" } : {}}>
            id: {user.id}, name: {user.name}
          </div>
        ))}
      </div>
    </div>
  );
}

const userListQuery = query({
  load: () => {
    return backend.fetchUsers();
  },
  update: (on, t) => [
    on(addUserAction.dispatched, (users, name) => {
      return [...users, { id: 0, name }];
    }),
    on(addUserAction.done, () => {
      t.invlaidate(userListQuery.loader);
    }),
  ],
});

const addUserAction = action.effect({
  run: async (_t, name: string) => {
    await backend.addUser(name);
  },
});

const backend = {
  users: [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ],

  addUser: async (name: string) => {
    await new Promise((r) => setTimeout(r, 400));
    const { users } = backend;
    const lastId = users.length === 0 ? 0 : users[users.length - 1].id;
    users.push({ id: lastId + 1, name });
  },

  fetchUsers: async () => {
    await new Promise((r) => setTimeout(r, 600));
    return [...backend.users];
  },
};
