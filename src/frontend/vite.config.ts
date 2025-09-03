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
      },
    },
    server: {
      port: 5173,
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
                method: req.method
              });
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Vite Proxy] Proxy response:', {
                from: req.url,
                status: proxyRes.statusCode,
                headers: proxyRes.headers
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
                method: req.method
              });
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Vite Proxy] Photo proxy response:', {
                from: req.url,
                status: proxyRes.statusCode,
                contentType: proxyRes.headers['content-type']
              });
            });
          },
          // Don't rewrite the path - keep /photos prefix
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'vue-router', 'pinia'],
            ui: ['@headlessui/vue', '@heroicons/vue'],
          },
        },
      },
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
