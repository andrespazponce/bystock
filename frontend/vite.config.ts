import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Polling necesario en Windows con bind mounts — los eventos inotify
    // no se propagan correctamente a través del filesystem de Windows.
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  // Pre-bundlea estas dependencias al iniciar Vite en lugar de descubrirlas
  // durante la carga. Evita el ciclo "optimized dependencies changed → reloading"
  // que deja la pantalla en blanco al refrescar con un contenedor recién creado.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'leaflet',
      'react-leaflet',
      '@googlemaps/js-api-loader',
    ],
  },
})
