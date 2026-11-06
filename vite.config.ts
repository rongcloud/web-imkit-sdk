import { resolve } from 'path';
import { defineConfig } from 'vite';
import { ModuleFormat } from 'rollup';
import vue from '@vitejs/plugin-vue';
import pack from './scripts/plugins/vite-plugin-pack';
import { compileDefinedValues, mode, isDev } from './scripts/constants';

export default defineConfig({
  plugins: [
    vue(),
    pack(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      fileName(format: ModuleFormat) {
        if (format === 'cjs') return 'index.cjs';
        return format === 'es' || format === 'esm' ? 'index.esm.js' : 'index.umd.js';
      },
      name: 'RongIMKit',
      formats: ['es', 'cjs', 'umd'],
    },
    sourcemap: isDev ? 'inline' : false,
    copyPublicDir: false,
    emptyOutDir: false,
    minify: !isDev,
    outDir: './release/npm/dist',
    rollupOptions: {
      external: ['@rongcloud/engine', '@rongcloud/imlib-next'],
      output: {
        globals: {
          '@rongcloud/engine': 'RCEngine',
          '@rongcloud/imlib-next': 'RongIMLib',
        },
      },
    },
  },
  resolve: {
    alias: {
      vue: resolve('./node_modules/vue/dist/vue.esm-bundler.js'),
      '@lib': resolve('./src'),
    },
  },
  mode,
  define: compileDefinedValues,
});
