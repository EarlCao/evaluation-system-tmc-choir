import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-restricted-syntax": [
        "error",
        {
          // AGENT.md §4.6: user content is rendered as text only.
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Never render user content as HTML (XSS). Render text instead.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // AGENT.md §2.3.8: features are used through their public index only.
              group: ["@/features/*/*"],
              message: "Import from the feature's index (e.g. '@/features/auth').",
            },
            {
              group: ["axios"],
              importNames: ["default"],
              message: "Use the shared client from '@/lib/apiClient' (ADR-006).",
            },
          ],
        },
      ],
    },
  },
  {
    // The API client is the one place allowed to use axios directly.
    files: ["src/lib/apiClient.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // Route modules export route objects (not components) by design.
    files: ["src/**/routes.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
);
