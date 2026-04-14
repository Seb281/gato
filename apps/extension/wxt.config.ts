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
    name: 'Gato — Translate & Learn in Context',
    description:
      'Learn languages while you browse — select text for translations, pronunciation, grammar notes, and spaced repetition.',
    version: '2.0.0',
    icons: {
      16: 'icon/icon-16.png',
      48: 'icon/icon-48.png',
      128: 'icon/icon-128.png',
    },
    permissions: ['storage', 'tabs', 'activeTab', 'scripting', 'contextMenus', 'alarms', 'notifications', 'sidePanel'],
    host_permissions: ['https://gato.giupana.com/*'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    web_accessible_resources: [
      {
        resources: ['cat-icon.png'],
        matches: ['<all_urls>'],
      },
    ],
    commands: {
      '_execute_side_panel': {
        suggested_key: {
          default: 'Alt+T',
          mac: 'Alt+T',
        },
        description: 'Open the translation side panel',
      },
    },
  },
})
