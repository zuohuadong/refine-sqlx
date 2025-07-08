import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    splitting: false,
    sourcemap: false,
    clean: true,
    platform: "neutral",
    target: "es2022", 
    format: ["esm"],
    dts: true,
    treeshake: { preset: "smallest" },
    external: ["@refinedev/core", "node:sqlite"],
    esbuildOptions(options) {
        options.drop = ["console", "debugger"];
        options.legalComments = "none";
        options.mangleProps = /^[_$]/;
        options.minifyIdentifiers = true;
        options.minifySyntax = true;
        options.minifyWhitespace = true;
        options.treeShaking = true;
        options.keepNames = false;
        options.dropLabels = ["DEV", "DEBUG"];
        options.ignoreAnnotations = true;
        options.pure = ["console.log", "console.error", "console.warn", "console.debug"];
    },
    onSuccess: "tsc --project tsconfig.declarations.json",
});