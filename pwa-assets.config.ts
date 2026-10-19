import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#060913' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#060913' } },
  },
  images: ['public/icon.svg'],
})
