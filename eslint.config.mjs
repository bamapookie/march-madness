import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disable all ESLint formatting rules that conflict with Prettier.
  // Must come after other configs so it can override them.
  prettier,
  {
    rules: {
      // Enforce CLAUDE.md: no `any` types
      "@typescript-eslint/no-explicit-any": "error",
      // Catch unused variables; allow underscore-prefixed intentional ignores
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Enforce `import type` for type-only imports (cleaner, avoids runtime cost)
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Warn on console.log left in app code (scripts/cron may disable inline)
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
