import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    splitting: false,
    sourcemap: true,
    clean: true,
    platform: "browser",
    target: "es2022",
    format: ["esm", "cjs"],
    dts: true,
    external: ["@cloudflare/workers-types"],
    onSuccess: "tsc --project tsconfig.declarations.json",
});