import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
} from "@sentry/browser"

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

const BLOCKED_INTEGRATIONS = new Set([
  "BrowserApiErrors",
  "BrowserSession",
  "Breadcrumbs",
  "ConversationId",
  "GlobalHandlers",
  "FunctionToString",
])

// Shared scope for this isolated extension context.
// No-op until initSentry() attaches a client.
export const scope = new Scope()

/**
 * Initialize Sentry. Call once per entry point (each runs in an isolated context).
 * Pass isServiceWorker: true for the background to skip DOM-dependent integrations.
 * No-op when VITE_SENTRY_DSN is not set (local dev, CI).
 */
export function initSentry(options: { context: string; isServiceWorker?: boolean }): void {
  if (!SENTRY_DSN) return

  // Skip during WXT vite-node pre-rendering (Node.js has neither window nor importScripts)
  if (typeof window === 'undefined' && typeof importScripts === 'undefined') return

  let version: string | undefined
  try {
    version = chrome.runtime.getManifest().version
  } catch {
    // Not in a Chrome extension context
  }

  const integrations = getDefaultIntegrations({}).filter(
    (i) => !BLOCKED_INTEGRATIONS.has(i.name)
  )

  const client = new BrowserClient({
    dsn: SENTRY_DSN,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations,
    release: version,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  })

  scope.setClient(client)
  scope.setTag("context", options.context)
  client.init()

  if (options.isServiceWorker && typeof self.addEventListener === 'function') {
    // GlobalHandlers is filtered out above (it wires to window.onerror).
    // Manually wire the equivalent on self for unhandled errors in the SW.
    self.addEventListener('error', (event) => {
      scope.captureException(event.error ?? new Error(event.message))
    })
    self.addEventListener('unhandledrejection', (event) => {
      scope.captureException(event.reason)
    })
  }
}
