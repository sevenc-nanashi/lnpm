/** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */
module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "prettier/prettier": "error",
    "@typescript-eslint/explicit-module-boundary-types": "off",
  },
  overrides: [
    {
      files: ["src/lib/**/*.ts"],
      rules: {
        "@typescript-eslint/explicit-module-boundary-types": "error",
      },
    },
  ],
};
