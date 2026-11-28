import { defineConfig } from 'vitest/config';
import path from 'node:path';

const fake = (f) => path.resolve(__dirname, 'test/fakes', f);

// Base44 server functions run on Deno with `npm:` and `base44:` imports.
// In tests those external boundaries are swapped for in-memory fakes.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^npm:@base44\/sdk@.*$/, replacement: fake('base44-sdk.js') },
      { find: /^npm:stripe@.*$/, replacement: fake('stripe.js') },
      { find: 'base44:runtime', replacement: fake('base44-runtime.js') },
      { find: /^npm:qrcode@.*$/, replacement: fake('qrcode.js') },
    ],
  },
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
    setupFiles: ['test/setup.js'],
  },
});
