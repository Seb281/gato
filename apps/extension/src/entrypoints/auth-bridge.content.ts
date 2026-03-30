/**
 * Auth Bridge Content Script
 *
 * Runs only on the dashboard URL. Syncs Supabase auth state between
 * the extension (IndexedDB/localStorage via Supabase JS SDK) and the
 * dashboard (cookies via @supabase/ssr).
 *
 * - Dashboard -> Extension: receives postMessage from ExtensionBridge component,
 *   relays tokens to background via chrome.runtime.sendMessage
 * - Extension -> Dashboard: receives full session from background, writes cookies
 */

import type { Session } from '@supabase/supabase-js'
import { initSentry, scope } from "@/lib/sentry"

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL

// Extract project ref from Supabase URL (e.g. "https://abc123.supabase.co" -> "abc123")
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || ""
const PROJECT_REF = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase/)?.[1] || ""
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`

export default defineContentScript({
  matches: [`${import.meta.env.VITE_DASHBOARD_URL}/*`],
  runAt: "document_idle",
  main() {
    try { initSentry({ context: "auth-bridge" }) } catch { /* Sentry unavailable — auth bridge continues */ }

    if (!PROJECT_REF) {
      scope.captureException(
        new Error("[auth-bridge] Missing VITE_SUPABASE_URL — PROJECT_REF could not be extracted")
      )
      return
    }

    const DASHBOARD_ORIGIN = new URL(DASHBOARD_URL).origin

    /** Parse all cookies into a key-value map. */
    function parseCookies(): Record<string, string> {
      return document.cookie.split("; ").reduce<Record<string, string>>((acc, c) => {
        const eqIdx = c.indexOf("=")
        if (eqIdx > 0) {
          acc[c.substring(0, eqIdx)] = c.substring(eqIdx + 1)
        }
        return acc
      }, {})
    }

    /**
     * Read the raw session JSON string from Supabase auth cookies.
     * Handles both single and chunked cookie formats (.0, .1, .2 suffixes).
     */
    function readRawSessionFromCookies(): string | null {
      const cookies = parseCookies()

      // Try the base cookie first (small sessions)
      if (cookies[COOKIE_NAME]) {
        try {
          return decodeURIComponent(cookies[COOKIE_NAME])
        } catch { /* fall through to chunked */ }
      }

      // Try chunked cookies: sb-<ref>-auth-token.0, .1, .2, ...
      let combined = ""
      for (let i = 0; ; i++) {
        const chunk = cookies[`${COOKIE_NAME}.${i}`]
        if (!chunk) break
        combined += chunk
      }

      if (!combined) return null

      try {
        return decodeURIComponent(combined)
      } catch {
        return null
      }
    }

    /**
     * Read access_token and refresh_token from dashboard cookies.
     * Only JS-visible cookies (not HttpOnly) — used solely for Extension->Dashboard check.
     */
    function readTokensFromCookies(): { access_token: string; refresh_token: string } | null {
      const raw = readRawSessionFromCookies()
      if (!raw) return null

      try {
        const parsed = JSON.parse(raw)
        if (parsed.access_token && parsed.refresh_token) {
          return { access_token: parsed.access_token, refresh_token: parsed.refresh_token }
        }
      } catch {
        // Invalid JSON
      }
      return null
    }

    /**
     * Write a full Supabase session object as cookies so the dashboard's
     * @supabase/ssr createBrowserClient picks it up correctly.
     * Matches the cookie format used by @supabase/ssr (URL-encoded JSON, chunked at ~3180 chars).
     */
    function writeSessionToCookies(sessionJson: string): void {
      const encoded = encodeURIComponent(sessionJson)

      // @supabase/ssr chunks cookies at ~3180 chars
      const CHUNK_SIZE = 3180

      // Clear all existing cookies first (base + chunks)
      clearSessionCookies()

      if (encoded.length <= CHUNK_SIZE) {
        document.cookie = `${COOKIE_NAME}=${encoded}; path=/; samesite=lax`
      } else {
        for (let i = 0; i * CHUNK_SIZE < encoded.length; i++) {
          const chunk = encoded.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          document.cookie = `${COOKIE_NAME}.${i}=${chunk}; path=/; samesite=lax`
        }
      }
    }

    /** Delete all Supabase session cookies. */
    function clearSessionCookies(): void {
      document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
      for (let i = 0; i < 10; i++) {
        document.cookie = `${COOKIE_NAME}.${i}=; path=/; max-age=0`
      }
    }

    // Listen for messages from the dashboard's ExtensionBridge component
    window.addEventListener('message', (event) => {
      if (event.origin !== DASHBOARD_ORIGIN) return

      if (event.data?.type === 'SUPABASE_SESSION') {
        chrome.runtime.sendMessage({
          type: 'DASHBOARD_SESSION',
          access_token: event.data.access_token,
          refresh_token: event.data.refresh_token,
        })
      } else if (event.data?.type === 'SUPABASE_SIGNOUT') {
        chrome.runtime.sendMessage({ type: 'DASHBOARD_SIGNOUT' })
      }

      // Allowed sites management — relay to background and respond to dashboard
      if (event.data?.type === 'GET_ALLOWED_SITES') {
        chrome.runtime.sendMessage({ action: 'getAllowedSites' }, (response) => {
          window.postMessage({ type: 'ALLOWED_SITES_RESPONSE', sites: response?.sites || [] }, DASHBOARD_ORIGIN)
        })
      } else if (event.data?.type === 'ADD_ALLOWED_SITE') {
        chrome.runtime.sendMessage({ action: 'addAllowedSite', pattern: event.data.pattern }, (response) => {
          window.postMessage({ type: 'ALLOWED_SITES_RESPONSE', sites: response?.sites || [] }, DASHBOARD_ORIGIN)
        })
      } else if (event.data?.type === 'REMOVE_ALLOWED_SITE') {
        chrome.runtime.sendMessage({ action: 'removeAllowedSite', pattern: event.data.pattern }, (response) => {
          window.postMessage({ type: 'ALLOWED_SITES_RESPONSE', sites: response?.sites || [] }, DASHBOARD_ORIGIN)
        })
      }
    })

    /**
     * Initial sync on page load:
     * - If extension has a session and dashboard cookies are absent, write them and reload
     * - Send EXTENSION_BRIDGE_READY ping so ExtensionBridge re-sends session if it already fired
     */
    async function initialSync(): Promise<void> {
      const extensionResponse = await new Promise<{ session: Session | null } | null>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_EXTENSION_SESSION' }, (response) => {
          if (chrome.runtime.lastError) { resolve(null); return }
          resolve(response || null)
        })
      })

      const extensionSession = extensionResponse?.session || null
      const dashboardCookies = readTokensFromCookies() // JS-visible cookies only

      if (extensionSession && !dashboardCookies) {
        writeSessionToCookies(JSON.stringify(extensionSession))
        location.reload()
        return
      }

      // Ping dashboard to send current session (handles case where onAuthStateChange
      // already fired before this content script initialized)
      window.postMessage({ type: 'EXTENSION_BRIDGE_READY' }, DASHBOARD_ORIGIN)
    }

    /**
     * Listen for messages from background (extension auth changes).
     * Receives the full session object so cookies match @supabase/ssr format.
     */
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "EXTENSION_SESSION" && message.session) {
        writeSessionToCookies(JSON.stringify(message.session))
        location.reload()
      } else if (message.type === "EXTENSION_SIGNOUT") {
        clearSessionCookies()
        location.reload()
      }
    })

    // Kick off
    initialSync()
  },
})
