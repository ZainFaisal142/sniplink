import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite will now default to using its built-in 'esbuild' minifier 
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'esbuild' // Explicitly use esbuild to avoid the Terser dependency trap!
  }
})
