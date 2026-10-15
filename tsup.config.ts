import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  minify: true,
  splitting: false,
  sourcemap: false,
  noExternal: ['hono', '@hono/node-server'],
});
