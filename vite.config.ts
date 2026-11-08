/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** `npm run balance` : n'exécute que le rapport d'équilibrage (scripts/balance.test.ts). */
const balance = process.env.BALANCE === '1'

export default defineConfig({
  plugins: [react()],
  build: {
    // Monaco et three.js pèsent lourd : on les isole pour un meilleur cache navigateur.
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'monaco', test: /node_modules[\\/]monaco-editor/ },
            { name: 'three', test: /node_modules[\\/](three|@react-three|postprocessing|three-stdlib)/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: balance ? ['scripts/balance.test.ts'] : ['src/**/*.test.{ts,tsx}'],
    testTimeout: balance ? 600000 : 30000,
  },
})
