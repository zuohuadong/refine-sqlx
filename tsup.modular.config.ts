import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        "d1-only": "src/d1-only.ts", 
        "sqlite-only": "src/sqlite-only.ts"
    },
    splitting: false,
    sourcemap: true,
    clean: true,
    platform: "neutral",
    target: "es2020",
    format: ["esm", "cjs"],
    dts: true,
    treeshake: true,
    external: ["@refinedev/core", "node:sqlite"],
    esbuildOptions(options) {
        options.drop = ["console", "debugger"];
        options.legalComments = "none";
    },
    onSuccess: "tsc --project tsconfig.declarations.json",
});
