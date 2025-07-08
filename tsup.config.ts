import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    splitting: false,
    sourcemap: true,
    clean: true,
    platform: "neutral",
    target: "es2020",
    format: ["esm", "cjs"],
    dts: true,
    treeshake: true,
    external: ["better-sqlite3", "@refinedev/core"],
    esbuildOptions(options) {
        options.drop = ["console", "debugger"];
        options.legalComments = "none";
    },
    onSuccess: "tsc --project tsconfig.declarations.json",
});