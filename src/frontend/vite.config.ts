import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Enable debug mode in development unless explicitly disabled
  const debugMode = mode !== 'production';

  console.log(`[Vite Config] Mode: ${mode}, Debug Mode: ${debugMode}`);

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@shared': resolve(__dirname, '../shared'),
          // Provide a browser-safe shim for Node-only modules that some
          // upstream libraries attempt to import (e.g. child_process).
          // This lets the client bundle avoid Node-specific exports at
          // build time while still allowing server builds to use the
          // real module when available.
          'child_process': resolve(__dirname, './src/shims/child_process.ts'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      open: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options): void => {
            proxy.on('error', (err, _req, _res) => {
              console.log('[Vite Proxy] Error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[Vite Proxy] Proxying request:', {
                from: req.url,
                to: proxyReq.getHeader('host') + proxyReq.path,
                method: req.method,
              });
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Vite Proxy] Proxy response:', {
                from: req.url,
                status: proxyRes.statusCode,
                headers: proxyRes.headers,
              });
            });
          },
          // Don't rewrite the path - keep /api prefix
        },
        '/photos': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options): void => {
            proxy.on('error', (err, _req, _res) => {
              console.log('[Vite Proxy] Photos Error:', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[Vite Proxy] Proxying photo request:', {
                from: req.url,
                to: proxyReq.getHeader('host') + proxyReq.path,
                method: req.method,
              });
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Vite Proxy] Photo proxy response:', {
                from: req.url,
                status: proxyRes.statusCode,
                contentType: proxyRes.headers['content-type'],
              });
            });
          },
          // Don't rewrite the path - keep /photos prefix
        },
        // Proxy sitemap requests to the backend worker during local development
        // so that /sitemap.xml and /sitemap-*.xml are served by the API worker.
        '/sitemap.xml': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
          secure: false,
        },
        '/sitemap-': {
          // this will match requests like /sitemap-artworks.xml when used with exact prefix
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
          secure: false,
          rewrite: (path): string => path, // keep path intact
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'esnext',
      // Do not customize manualChunks here — let Vite choose sensible
      // chunking for both client and SSR builds. Explicit manualChunks
      // caused Rollup errors during SSR build where some dependencies are
      // externalized.
      rollupOptions: {},
    },
    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      'import.meta.env.VITE_DEBUG_MODE': JSON.stringify(debugMode.toString()),
    },
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
    },
  };
});
