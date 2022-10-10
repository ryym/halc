const { defineConfig } = require("vite");
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "sample",
  plugins: [react()],
});
