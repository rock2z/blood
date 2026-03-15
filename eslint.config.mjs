// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Base recommended + type-checked rules
  ...tseslint.configs.recommended,
  {
    rules: {
      // Catch unused variables (params prefixed with _ are exempt)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Prefer explicit types for public API; allow inference elsewhere
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Allow `any` only with an explicit cast comment — too strict for engine internals
      "@typescript-eslint/no-explicit-any": "warn",
      // Ban non-null assertion operator (use explicit checks instead)
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    // Relax some rules inside test files — assertions and casts are acceptable
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    // Ignore generated output and deps
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  }
);
