import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index.ts'],
  outDir: 'dist',
  declaration: 'node16',
  rollup: { esbuild: { minify: true }, emitCJS: true },
});
