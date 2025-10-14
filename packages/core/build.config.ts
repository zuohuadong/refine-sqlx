import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index'],
  declaration: true,
  clean: true,
  failOnWarn: false,
  rollup: {
    emitCJS: true,
    esbuild: {
      minify: true,
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      target: 'es2022',
      format: 'esm',
      // 启用新标准装饰器支持
      supported: { decorators: true },
      // More aggressive compression settings
      mangleProps: /^_/,
      legalComments: 'none',
    },
  },
});
