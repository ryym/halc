import React from "react";
import ReactDOM from "react-dom/client";
import { createStore } from "../../dist/esm";
import { HalcProvider } from "../../dist/esm/react";
import { Routes } from "./Routes";

export const store = createStore();

function App() {
  return (
    <HalcProvider store={store}>
      <Routes />
    </HalcProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
