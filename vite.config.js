import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.BUILD_TARGET === 'android' ? './' : '/poker-ledger/',
  plugins: [react(), tailwindcss()],
})