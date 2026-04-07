# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
pnpm dev          # Start development mode with hot reload
pnpm build        # Build for production
pnpm compile      # Type-check without emitting (has 3 pre-existing TS errors — not blocking)
```

After running `pnpm build`, load the `.output/chrome-mv3` folder as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

## Architecture

Chrome Manifest V3 extension for context-aware text translation, built with WXT, React, TypeScript, and Tailwind CSS v4.

### Entry Points (WXT Convention)

| Entry point | File | Role |
|---|---|---|
| **Background** | `src/entrypoints/background/index.ts` | Unified message handler (single `onMessage` listener), translation API calls, auth, content script registration |
| **Content script** | `src/entrypoints/content/index.tsx` | Text selection → tooltip → translation popup OR sidepanel routing. Injected dynamically (not in manifest) |
| **Auth bridge** | `src/entrypoints/content/auth-bridge.ts` | Syncs auth from dashboard → extension. Only content script in manifest, only matches dashboard URL |
| **Popup** | `src/entrypoints/popup/App.tsx` | Settings hub (380px). Per-site enable/disable, due count, "Open Side Panel" button, auth. NOT a translation UI |
| **Sidepanel** | `src/entrypoints/sidepanel/App.tsx` | Full workspace with 4 tabs: Translate, History, Saved, Settings |

### Content Script Lifecycle

The main content script uses `registration: 'runtime'` — WXT compiles it but does NOT add it to `manifest.json`. Injection happens two ways:

1. **Per-site registration** (`syncRegisteredContentScripts()`): `chrome.scripting.registerContentScripts()` with `persistAcrossSessions: true`. Only activates on page load/refresh.
2. **One-shot injection**: Used by context menu handler AND after `addAllowedSite` to inject into already-open tabs without requiring refresh.

### Translation Flows

**Flow A — In-page popup (tooltip click):**
```
mouseup → captureSelection() → tooltip.show()
  → tooltip click → showTranslationPopup()
    → TranslationPopup rendered in page DOM (draggable, 500px card)
    → sends 'translate' to background → API call → renders result
```

Note: `chrome.sidePanel.open()` requires a direct user gesture — message passing from content script to background loses gesture context. Auto-fill from content script to sidepanel is not possible with this Chrome API limitation.

**Flow B — Context menu (any page, no pre-activation):**
```
right-click → background contextMenu handler
  → pings content script; if absent, one-shot injects CSS+JS
  → sends 'showTranslation' message → content script shows popup
```

### Key Components

| Component | File | Used in |
|---|---|---|
| `TranslationPopup` | `src/entrypoints/content/components/TranslationPopup.tsx` | Content script (in-page overlay) |
| `Tooltip` | `src/entrypoints/content/components/Tooltip.tsx` | Content script (small "Translate" button on selection) |
| `TranslateTab` | `src/components/TranslateTab.tsx` | Sidepanel Translate tab |

`TranslationPopup` and `TranslateTab` are separate implementations with overlapping features (translate, speak, enrich, save). They are NOT shared components.

### Settings Auto-Save

SettingsTab saves to `chrome.storage.sync` immediately on change (no Save button). API sync is debounced (800ms). An `initialLoadDone` ref prevents the auto-save effect from firing during initial hydration from storage/API.

### i18n Reactivity

`useTranslation` listens for `displayLanguage` changes via `chrome.storage.onChanged`. Changing the display language in settings triggers all mounted components to re-render with new strings (fetched from API or local cache).

### Background Message Handler

Single `chrome.runtime.onMessage.addListener` with a switch on `action`. Key actions:

| Action | Purpose |
|---|---|
| `translate` | Translate text via API (checks cache first) |
| `enrich` | Load enrichment data (pronunciation, grammar, etc.) |
| `saveConcept` / `updateConcept` | Save/update to backend |
| `addAllowedSite` / `removeAllowedSite` | Manage per-site whitelist + re-register content scripts + one-shot inject into active tab |
| `getAllowedSites` | Return allowed sites list |
| `getDueCount` | Spaced repetition due count |
| `CHECK_LOGIN_STATUS` | Auth status check |

### Storage Keys

| Key | Area | Purpose |
|---|---|---|
| `allowedSites` | sync | Array of match patterns for enabled sites |
| `targetLanguage` | sync | User's target language preference |
| `sourceLanguage` | sync | Detected source language |
| `personalContext` | sync | User's personal context for translations |
| `displayLanguage` | sync | UI language for i18n (falls back to targetLanguage) |
| `theme` | sync | Theme preference (light/dark/system) |
| `sidepanelTab` | session | Which tab to show when sidepanel opens |
| Auth tokens | local | Supabase auth |

### Key Directories

- `src/entrypoints/background/helpers/`: Translation API, login, token management
- `src/entrypoints/content/helpers/`: Text selection expansion (`selectText.ts`), language detection (`detectLanguage.ts`), highlighting (`setHighlight.ts`)
- `src/entrypoints/content/components/`: TranslationPopup, Tooltip (rendered in page DOM)
- `src/components/`: Shared components used by sidepanel (TranslateTab, SavedConceptCard, etc.)
- `src/components/ui/`: shadcn/ui primitives (Button, Card, Badge, etc.)
- `src/lib/i18n/`: Internationalization (useTranslation hook, locale files)
- `src/types/`: TypeScript types (translation.ts)
- `src/utils/`: Utility functions (languageCodes.ts)

### Configuration

- **WXT Config**: `wxt.config.ts` — build config, manifest overrides, Tailwind vite plugin
- **Path alias**: `@/` → `./src/`
- **Environment variable**: `VITE_BASE_URL` for translation API endpoint
- **Manifest permissions**: storage, tabs, activeTab, scripting, contextMenus, alarms, notifications, sidePanel
- **Optional host permissions**: `https://*/*`, `http://*/*` (requested per-site at runtime)

### CSS / Theming

Content script CSS (`content.css`) uses scoped custom properties under `#context-translator-root` and `#context-translator-tooltip` selectors to avoid polluting host page styles. Dark mode toggled via `.dark` class on the root container, driven by `theme` storage key + `prefers-color-scheme` media query.

### Turborepo Integration

Part of a monorepo managed by Turborepo:
- Run from root: `pnpm --filter context-aware-translator-extension dev`
- Or from this directory: `pnpm dev`
