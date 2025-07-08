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
    bundle: true,
    minify: "terser",
    terserOptions: {
        compress: {
            drop_console: true,
            drop_debugger: true,
            passes: 3,
            pure_getters: true,
            unsafe: true,
            unsafe_comps: true,
            unsafe_math: true,
            unsafe_methods: true,
            unsafe_proto: true,
            unsafe_regexp: true,
            conditionals: true,
            dead_code: true,
            evaluate: true,
            if_return: true,
            join_vars: true,
            loops: true,
            reduce_vars: true,
            unused: true,
            hoist_funs: true,
            hoist_vars: true,
            inline: 3
        },
        mangle: {
            toplevel: true,
            properties: {
                regex: /^_/
            }
        },
        format: {
            comments: false,
            beautify: false
        }
    },
    esbuildOptions(options) {
        options.legalComments = "none";
        options.mangleProps = /^[_$]/;
        options.minifyIdentifiers = true;
        options.minifySyntax = true;
        options.minifyWhitespace = true;
        options.treeShaking = true;
        options.keepNames = false;
        options.ignoreAnnotations = true;
        options.charset = "utf8";
    },
});