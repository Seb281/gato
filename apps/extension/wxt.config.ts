import { defineConfig } from 'wxt'
import tailwindcss from '@tailwindcss/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  dev: {
    server: {
      port: 3003,
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Context-Aware Translator',
    description:
      'Smart, context-aware text translation for any webpage. Select text, get a translation that understands the surrounding context.',
    version: '1.0.0',
    icons: {
      16: 'icon/icon-16.png',
      48: 'icon/icon-48.png',
      128: 'icon/icon-128.png',
    },
    permissions: ['storage', 'activeTab', 'scripting', 'contextMenus', 'tabs'],
    host_permissions: ['<all_urls>'],
    commands: {
      'show-translation': {
        suggested_key: {
          default: 'Ctrl+Shift+T',
          mac: 'Command+Shift+T',
        },
        description: 'Show translation for selected text',
      },
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content-scripts/content.js'],
        css: ['content-scripts/content.css'],
      },
    ],
  },
})
