import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx,vue}'],
    // CI shells export NODE_ENV=production, which makes Vue resolve to its
    // production build and breaks @vue/test-utils emit recording.
    env: {
      NODE_ENV: 'test',
    },
    // Running files sequentially avoids forks-pool worker-start timeouts in
    // resource-constrained environments (jsdom setup is memory-heavy).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
