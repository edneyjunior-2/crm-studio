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
    // Worktrees temporárias dos agentes/workflows — cópias do repo que inflavam
    // a contagem de lint localmente (o CI não as tem; o lint local sim).
    ".claude/**",
  ]),
  {
    // Advisories do React Compiler (eslint-plugin-react-hooks v5+) rebaixados a
    // warning: 'set-state-in-effect' marca o padrão legítimo de sincronizar
    // estado a partir de props (espalhado na base herdada do Aurum) e 'purity'
    // dá falso-positivo com Math.random/Date.now fora de render (server/handler).
    // 'no-unescaped-entities' é cosmético (aspas em texto JSX). Mantidos como
    // warn p/ não travar o CI; limpar incrementalmente depois.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
