import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // Raise the warning threshold — our single-file app is large by design
    chunkSizeWarningLimit: 1200,

    rollupOptions: {
      output: {
        // Split vendor libs into their own cached chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('supabase') || id.includes('@supabase')) return 'supabase';
            if (id.includes('react') || id.includes('react-dom')) return 'react';
            return 'vendor';
          }
        },
        // Content-hash filenames so CDN/browser cache busts on deploy
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },

    // Minify with esbuild (default, fastest)
    minify: 'esbuild',

    // Inline assets ≤ 4 KB as base64 data URIs
    assetsInlineLimit: 4096,

    // Generate source maps for prod (useful for error tracking, tiny overhead)
    sourcemap: false,

    // Target modern browsers only — smaller output
    target: 'es2020',
  },

  // Deduplicate React across any sub-packages
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
