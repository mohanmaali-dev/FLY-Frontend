import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Guarantees a single React instance. Two copies make every hook call throw
    // "Cannot read properties of null (reading 'useRef')".
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Pre-bundle these up front. Otherwise Vite discovers them one request at a
    // time and re-optimizes mid-load, handing the page two generations of React.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-router-dom',
      '@supabase/supabase-js',
      'qrcode.react',
      'ua-parser-js',
    ],
  },
  server: {
    // Listen on every interface so a phone on the same Wi-Fi can open the
    // pairing link from the QR code. Vite prints the Network URL on start.
    host: true,
  },
})
