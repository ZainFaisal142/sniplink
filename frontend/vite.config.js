import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite will automatically use its built-in lightning-fast 'esbuild' compiler instead of looking for Terser!
export default defineConfig({
  plugins: [react()],
})
