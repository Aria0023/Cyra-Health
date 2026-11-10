// ESLint (flat config): the app, the e2e harness and the build config. `npm run lint`.
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "dist-*/**", "node_modules/**", "backend/node_modules/**", "backend/data*/**", "ios/**", "android/**", "e2e/test-results/**", "e2e/report/**", "e2e/shots/**", "public/**", "scripts/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser, ...globals.node}, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      // the two classic hook rules (not the React Compiler set, which this code base predates)
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "no-unused-vars": ["warn", { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-prototype-builtins": "off",
    },
  },
  // The PDF text encoder maps WinAnsi code points and emoji on purpose; the POTS report tests pin exact spacing.
  { files: ["src/lib/pdf.js", "src/lib/potsReport.js", "src/lib/potsReport.test.mjs"], rules: { "no-irregular-whitespace": "off", "no-misleading-character-class": "off", "no-regex-spaces": "off" } },
];
