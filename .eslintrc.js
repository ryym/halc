// ESLint configuration for JS files on the root directory.
module.exports = {
  root: true,
  env: {
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  ignorePatterns: ["_work/", "dist/", "node_modules/", "sample/"],
  extends: ["eslint:recommended", "prettier"],
};
