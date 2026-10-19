import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#f6f3ee' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#f6f3ee' } },
  },
  images: ['public/icon.svg'],
})
