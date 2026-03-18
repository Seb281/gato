/**
 * Auth Bridge Content Script
 *
 * Runs only on the dashboard URL. Syncs Supabase auth state between
 * the extension (IndexedDB/localStorage via Supabase JS SDK) and the
 * dashboard (cookies via @supabase/ssr).
 *
 * - Dashboard -> Extension: reads session cookies, sends tokens to background
 * - Extension -> Dashboard: receives full session from background, writes cookies
 */

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL

// Extract project ref from Supabase URL (e.g. "https://abc123.supabase.co" -> "abc123")
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || ""
const PROJECT_REF = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase/)?.[1] || ""
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`

export default defineContentScript({
  matches: [`${import.meta.env.VITE_DASHBOARD_URL}/*`],
  runAt: "document_idle",
  main() {
    if (!PROJECT_REF) {
      console.warn("[auth-bridge] Could not extract Supabase project ref from VITE_SUPABASE_URL")
      return
    }

    let lastCookieHash = ""

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
     * Used for dashboard -> extension sync (setSession only needs these two).
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

    /** Simple hash of cookie state for change detection. */
    function hashCookieState(): string {
      const tokens = readTokensFromCookies()
      return tokens ? tokens.access_token.slice(-16) : "none"
    }

    /**
     * Initial sync on page load:
     * - Read dashboard cookies
     * - Ask background for extension session
     * - Sync whichever side is missing
     */
    async function initialSync(): Promise<void> {
      const dashboardTokens = readTokensFromCookies()

      // Get the full session object from extension (background)
      const extensionResponse = await new Promise<{ session: any } | null>(
        (resolve) => {
          chrome.runtime.sendMessage({ type: "GET_EXTENSION_SESSION" }, (response) => {
            if (chrome.runtime.lastError) {
              resolve(null)
              return
            }
            resolve(response || null)
          })
        }
      )

      const extensionSession = extensionResponse?.session || null

      if (dashboardTokens && !extensionSession) {
        // Dashboard has session, extension doesn't -> sync to extension
        chrome.runtime.sendMessage({
          type: "DASHBOARD_SESSION",
          access_token: dashboardTokens.access_token,
          refresh_token: dashboardTokens.refresh_token,
        })
      } else if (!dashboardTokens && extensionSession) {
        // Extension has session, dashboard doesn't -> write full session to cookies
        writeSessionToCookies(JSON.stringify(extensionSession))
        location.reload()
      }

      lastCookieHash = hashCookieState()
    }

    /**
     * Poll cookies every 2s to detect dashboard sign-in / sign-out changes.
     */
    function startPolling(): void {
      setInterval(() => {
        const currentHash = hashCookieState()
        if (currentHash === lastCookieHash) return
        lastCookieHash = currentHash

        const tokens = readTokensFromCookies()
        if (tokens) {
          chrome.runtime.sendMessage({
            type: "DASHBOARD_SESSION",
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          })
        } else {
          chrome.runtime.sendMessage({ type: "DASHBOARD_SIGNOUT" })
        }
      }, 2000)
    }

    /**
     * Listen for messages from background (extension auth changes).
     * Receives the full session object so cookies match @supabase/ssr format.
     */
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "EXTENSION_SESSION" && message.session) {
        writeSessionToCookies(JSON.stringify(message.session))
        lastCookieHash = hashCookieState()
        location.reload()
      } else if (message.type === "EXTENSION_SIGNOUT") {
        clearSessionCookies()
        lastCookieHash = hashCookieState()
        location.reload()
      }
    })

    // Kick off
    initialSync()
    startPolling()
  },
})
