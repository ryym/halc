import React from "react";
import ReactDOM from "react-dom/client";
import * as halc from "../../dist/esm";

function App() {
  return <h1>Hello: {JSON.stringify(halc)}</h1>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
