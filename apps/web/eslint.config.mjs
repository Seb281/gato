import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // eslint-plugin-react-hooks v7.1+ flags the standard
      // "setIsLoading(true) before async dispatch" pattern. The code works
      // fine at runtime — keep the signal visible as a warning without
      // gating CI. Mirrors apps/extension/eslint.config.js.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
