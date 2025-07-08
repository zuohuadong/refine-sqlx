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
    external: ["@refinedev/core", "drizzle-orm", "refine-sql"],
    bundle: true,
    minify: true,
    esbuildOptions(options) {
        options.legalComments = "none";
        options.treeShaking = true;
        options.keepNames = false;
    },
});
