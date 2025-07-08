import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    splitting: false,
    sourcemap: false,
    clean: true,
    platform: "neutral",
    target: "es2020",
    format: ["esm"], // ESM only for minimal bundle size
    dts: true,
    treeshake: true,
    minify: true,
    external: ["@refinedev/core"], // External dependencies to reduce bundle size
    esbuildOptions(options) {
        options.drop = ["console", "debugger"];
        options.legalComments = "none";
        options.treeShaking = true;
    },
});
