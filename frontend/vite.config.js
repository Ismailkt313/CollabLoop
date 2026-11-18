import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_URL || env.BACKEND_URL || 'http://localhost:5000';
  const port = parseInt(env.VITE_PORT || env.PORT || '2345', 10);

  return {
    plugins: [react()],
    server: {
      port,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/socket.io': { target: backendUrl, ws: true }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-docs': ['mammoth', 'marked'],
            'vendor-realtime': ['socket.io-client', 'paho-mqtt'],
          }
        }
      }
    }
  };
});
