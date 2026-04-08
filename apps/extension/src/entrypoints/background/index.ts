import { initSentry } from "@/lib/sentry"
import saveConcept from "./helpers/handleSaveConcept"
import handleTranslation from "./helpers/handleTranslation"
import handleEnrichment from "./helpers/handleEnrichment"
import lookupConcept from "./helpers/handleLookupConcept"
import updateConcept from "./helpers/handleUpdateConcept"
import { getSupabaseToken, isAuthenticated, supabase } from "./helpers/supabaseAuth"
import { fetchUserSettings, saveUserSettings, type UserSettings } from "./helpers/handleUserSettings"

const BASE_URL = import.meta.env.VITE_BASE_URL
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL

initSentry({ context: "background", isServiceWorker: true })

export default defineBackground(() => {

  // Flag to prevent infinite sync loops when setting session from dashboard
  let _isSyncingFromDashboard = false

  // --- Review Badge ---

  async function updateBadge() {
    const token = await getSupabaseToken()
    if (!token) {
      chrome.action.setBadgeText({ text: '' })
      return
    }

    try {
      const response = await fetch(`${BASE_URL}/review/due?countOnly=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        chrome.action.setBadgeText({ text: '' })
        return
      }
      const { dueCount } = await response.json() as { dueCount: number }
      chrome.action.setBadgeText({ text: dueCount > 0 ? String(dueCount) : '' })
      chrome.action.setBadgeBackgroundColor({ color: '#334155' })
    } catch {
      chrome.action.setBadgeText({ text: '' })
    }
  }

  // --- Review Reminders (Browser Notifications) ---

  async function checkReviewReminder() {
    const { reminderEnabled, reminderHour } = await chrome.storage.sync.get(['reminderEnabled', 'reminderHour']) as {
      reminderEnabled?: boolean
      reminderHour?: number
    }

    if (!reminderEnabled) return

    const currentHour = new Date().getHours()
    if (currentHour !== reminderHour) return

    const token = await getSupabaseToken()
    if (!token) return

    try {
      const response = await fetch(`${BASE_URL}/review/due?countOnly=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) return
      const { dueCount } = await response.json() as { dueCount: number }

      if (dueCount > 0) {
        chrome.notifications.create('review-reminder', {
          type: 'basic',
          iconUrl: 'icon/icon-128.png',
          title: 'Time to review!',
          message: `You have ${dueCount} words waiting.`,
        })
      }
    } catch { /* silently ignore */ }
  }

  // Open dashboard review page when notification is clicked
  chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'review-reminder') {
      chrome.tabs.create({ url: `${DASHBOARD_URL}/dashboard/review` })
      chrome.notifications.clear(notificationId)
    }
  })

  // --- Alarms ---

  chrome.alarms.create('update-badge', { periodInMinutes: 30 })
  chrome.alarms.create('review-reminder', { periodInMinutes: 60 })

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'update-badge') {
      updateBadge()
    } else if (alarm.name === 'review-reminder') {
      checkReviewReminder()
    }
  })

  // --- Context Menu Setup ---

  function setupContextMenu() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'translate-selection',
        title: 'Translate "%s"',
        contexts: ['selection'],
      })
    })
  }

  // --- Side Panel Setup ---

  function setupSidePanel() {
    chrome.sidePanel.setOptions({ path: 'sidepanel.html' })
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
  }

  // Track side panel open/closed state via port lifecycle
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sidepanel') {
      chrome.storage.session.set({ sidepanelOpen: true })
      port.onDisconnect.addListener(() => {
        chrome.storage.session.set({ sidepanelOpen: false })
      })
    }
  })

  chrome.runtime.onInstalled.addListener(() => {
    setupContextMenu()
    setupSidePanel()
    updateBadge()
  })
  chrome.runtime.onStartup.addListener(() => {
    setupContextMenu()
    updateBadge()
  })

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'translate-selection' || !tab?.id || !info.selectionText) return

    // Inject content script if not already present (activeTab granted by context menu click)
    let justInjected = false
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' })
    } catch {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content-scripts/content.css'],
      })
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/content.js'],
      })
      justInjected = true
    }

    // Brief delay after fresh injection to let the content script initialize its listeners
    if (justInjected) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    chrome.tabs.sendMessage(tab.id, {
      action: 'showTranslation',
      selectionText: info.selectionText,
    }).catch(() => {})
  })

  // --- Per-Site Content Script Registration ---

  const CONTENT_SCRIPT_ID = 'translator-content-script'

  async function syncRegisteredContentScripts() {
    const { allowedSites = [] } = await chrome.storage.sync.get('allowedSites') as { allowedSites?: string[] }

    try {
      await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] })
    } catch { /* not registered yet */ }

    if (allowedSites.length > 0) {
      await chrome.scripting.registerContentScripts([{
        id: CONTENT_SCRIPT_ID,
        matches: allowedSites,
        js: ['content-scripts/content.js'],
        css: ['content-scripts/content.css'],
        runAt: 'document_idle',
        persistAcrossSessions: true,
      }])
    }
  }

  chrome.runtime.onInstalled.addListener(syncRegisteredContentScripts)
  chrome.runtime.onStartup.addListener(syncRegisteredContentScripts)

  // --- Unified Message Handler ---
  // Single listener eliminates MV3 multi-listener race conditions

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): boolean => {
    const action = message.action || message.type

    switch (action) {

      // --- Allowed Sites ---

      case 'getAllowedSites':
        chrome.storage.sync.get('allowedSites').then(({ allowedSites = [] }) => {
          sendResponse({ success: true, sites: allowedSites })
        }).catch(() => {
          sendResponse({ success: false, sites: [] })
        })
        return true

      case 'addAllowedSite': {
        const pattern = message.pattern!
        chrome.storage.sync.get('allowedSites').then(async ({ allowedSites = [] }) => {
          const sites = allowedSites as string[]
          if (sites.includes(pattern)) {
            sendResponse({ success: true, sites, alreadyExists: true })
            return
          }
          const updated = [...sites, pattern]
          await chrome.storage.sync.set({ allowedSites: updated })
          await syncRegisteredContentScripts()

          // One-shot inject into the current active tab so the user
          // doesn't need to refresh the page after enabling the site
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (activeTab?.id) {
            try {
              await chrome.tabs.sendMessage(activeTab.id, { action: 'ping' })
            } catch {
              await chrome.scripting.insertCSS({
                target: { tabId: activeTab.id },
                files: ['content-scripts/content.css'],
              })
              await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ['content-scripts/content.js'],
              })
            }
          }

          sendResponse({ success: true, sites: updated })
        }).catch(() => {
          sendResponse({ success: false, sites: [] })
        })
        return true
      }

      case 'removeAllowedSite': {
        const pattern = message.pattern!
        chrome.storage.sync.get('allowedSites').then(async ({ allowedSites = [] }) => {
          const updated = (allowedSites as string[]).filter((s: string) => s !== pattern)
          await chrome.storage.sync.set({ allowedSites: updated })
          try { await chrome.permissions.remove({ origins: [pattern] }) } catch { /* ok */ }
          await syncRegisteredContentScripts()
          sendResponse({ success: true, sites: updated })
        }).catch(() => {
          sendResponse({ success: false, sites: [] })
        })
        return true
      }

      // --- Translation ---

      case 'translate':
        chrome.storage.sync
          .get(["targetLanguage", "sourceLanguage", "personalContext"])
          .then(async (result) => {
            const targetLanguage = (result.targetLanguage as string) || "English"
            const sourceLanguage = (result.sourceLanguage as string) || ""
            const personalContext = (result.personalContext as string) || ""

            if (message.concept && !message.forceRefresh) {
              const cached = await lookupConcept(message.concept, sourceLanguage, targetLanguage)
              if (cached) {
                return {
                  translateObject: {
                    contextualTranslation: cached.translation,
                    language: cached.sourceLanguage,
                    phoneticApproximation: "",
                  },
                  fromCache: true,
                  cachedConceptId: cached.id,
                  targetLanguage,
                  sourceLanguage,
                }
              }
            }

            const translateObject = await handleTranslation(
              message.text,
              targetLanguage,
              sourceLanguage,
              personalContext,
              message.selection,
              message.contextBefore,
              message.contextAfter,
            )
            return { translateObject, fromCache: false, targetLanguage, sourceLanguage }
          })
          .then(({ translateObject, fromCache, cachedConceptId, targetLanguage, sourceLanguage }: any) => {
            sendResponse({ success: true, translateObject, fromCache, cachedConceptId })

            // Push to translation history in session storage
            const translationObj = translateObject as {
              contextualTranslation?: string
              language?: string
            }
            const historyItem = {
              concept: message.concept || message.text,
              translation: translationObj.contextualTranslation || '',
              sourceLanguage: translationObj.language || sourceLanguage || '',
              targetLanguage: targetLanguage || '',
              url: sender.tab?.url ?? '',
              timestamp: Date.now(),
            }
            chrome.storage.session.get('translationHistory', (result) => {
              const history = (result.translationHistory || []) as typeof historyItem[]
              history.unshift(historyItem)
              if (history.length > 50) history.length = 50
              chrome.storage.session.set({ translationHistory: history })
            })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true

      // --- Enrichment ---

      case 'enrich':
        handleEnrichment(
          message.text,
          message.translation,
          message.targetLanguage,
          message.sourceLanguage,
          message.personalContext,
          message.contextBefore,
          message.contextAfter,
        )
          .then((enrichment) => {
            sendResponse({ success: true, enrichment })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true

      // --- Concepts ---

      case 'saveConcept':
        saveConcept(message.concept)
          .then((result) => {
            if (result.alreadySaved) {
              sendResponse({ success: true, alreadySaved: true, concept: result.concept })
            } else {
              sendResponse({ success: true, concept: result.concept })
              updateBadge()
            }
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true

      case 'updateConcept':
        updateConcept(message.conceptId, message.translation)
          .then((result) => {
            sendResponse({ success: true, concept: result.concept })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true

      // --- Auth ---

      case 'CHECK_LOGIN_STATUS':
        isAuthenticated().then((isLoggedIn) => {
          sendResponse({ isLoggedIn })
        }).catch(() => {
          sendResponse({ isLoggedIn: false })
        })
        return true

      // --- User Settings ---

      case 'fetchUserSettings':
        fetchUserSettings()
          .then((settings) => {
            sendResponse({ success: true, settings })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true

      case 'saveUserSettings':
        saveUserSettings(message.settings)
          .then((settings) => {
            sendResponse({ success: true, settings })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true

      // --- i18n ---

      case 'fetchTranslations': {
        const { language, version } = message
        if (!language || !version) {
          sendResponse({ success: false, error: "Missing language or version" })
          return true
        }
        fetch(
          `${BASE_URL}/i18n/translations?language=${encodeURIComponent(language)}&version=${encodeURIComponent(version)}`
        )
          .then(async (res) => {
            if (!res.ok) {
              sendResponse({ success: false, error: res.statusText })
              return
            }
            const data = await res.json()
            sendResponse({ success: true, translations: data.translations })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true
      }

      // --- Review / Quiz ---

      case 'getDueCount':
        getSupabaseToken()
          .then(async (token) => {
            if (!token) {
              sendResponse({ dueCount: 0 })
              return
            }
            const response = await fetch(
              `${BASE_URL}/review/due?countOnly=true`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            if (!response.ok) {
              sendResponse({ dueCount: 0 })
              return
            }
            const data = await response.json()
            sendResponse({ dueCount: data.dueCount ?? 0 })
          })
          .catch(() => {
            sendResponse({ dueCount: 0 })
          })
        return true

      case 'getQuizItems': {
        const count = message.count ?? 5
        getSupabaseToken()
          .then(async (token) => {
            if (!token) {
              sendResponse({ items: [] })
              return
            }
            const response = await fetch(
              `${BASE_URL}/quiz/generate?type=flashcard&count=${count}`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            if (!response.ok) {
              sendResponse({ items: [] })
              return
            }
            const data = await response.json()
            sendResponse({ items: data.questions ?? [] })
          })
          .catch(() => {
            sendResponse({ items: [] })
          })
        return true
      }

      case 'submitReview':
        getSupabaseToken()
          .then(async (token) => {
            if (!token) {
              sendResponse({ success: false, error: "Not authenticated" })
              return
            }
            const response = await fetch(
              `${BASE_URL}/review/${message.conceptId}/result`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ quality: message.quality }),
              }
            )
            if (!response.ok) {
              sendResponse({ success: false, error: response.statusText })
              return
            }
            const data = await response.json()
            sendResponse({ success: true, ...data })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true

      case 'fetchSavedConcepts': {
        const limit = message.limit || 10
        getSupabaseToken()
          .then(async (token) => {
            if (!token) {
              sendResponse({ success: false, error: "Not authenticated" })
              return
            }
            const response = await fetch(
              `${BASE_URL}/saved-concepts?limit=${limit}&sortBy=date&sortOrder=desc`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            if (!response.ok) {
              throw new Error(`Failed to fetch saved concepts: ${response.statusText}`)
            }
            const data = await response.json()
            sendResponse({ success: true, concepts: data.concepts || data })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
        return true
      }

      // --- Auth Bridge Sync ---

      case 'GET_EXTENSION_SESSION':
        supabase.auth.getSession().then(({ data: { session } }) => {
          sendResponse({ session: session || null })
        }).catch(() => {
          sendResponse({ session: null })
        })
        return true

      case 'DASHBOARD_SESSION':
        _isSyncingFromDashboard = true
        supabase.auth
          .setSession({
            access_token: message.access_token,
            refresh_token: message.refresh_token,
          })
          .then(({ data: { session }, error }) => {
            if (error) {
              sendResponse({ success: false, error: error.message })
            } else {
              sendResponse({ success: true })
            }
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
          .finally(() => {
            setTimeout(() => { _isSyncingFromDashboard = false }, 500)
          })
        return true

      case 'DASHBOARD_SIGNOUT':
        _isSyncingFromDashboard = true
        supabase.auth
          .signOut()
          .then(() => {
            sendResponse({ success: true })
          })
          .catch((error: Error) => {
            sendResponse({ success: false, error: error.message })
          })
          .finally(() => {
            setTimeout(() => { _isSyncingFromDashboard = false }, 500)
          })
        return true

      default:
        return false
    }
  })

// Push extension auth changes to dashboard tabs via auth-bridge content script
supabase.auth.onAuthStateChange((event, session) => {
  if (_isSyncingFromDashboard) return

  chrome.tabs.query({ url: `${DASHBOARD_URL}/*` }, (tabs) => {
    if (chrome.runtime.lastError || !tabs?.length) return

    for (const tab of tabs) {
      if (!tab.id) continue

      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        chrome.tabs.sendMessage(tab.id, {
          type: "EXTENSION_SESSION",
          session,
        }).catch(() => { /* tab may not have content script ready */ })
      } else if (event === "SIGNED_OUT") {
        chrome.tabs.sendMessage(tab.id, {
          type: "EXTENSION_SIGNOUT",
        }).catch(() => { /* tab may not have content script ready */ })
      }
    }
  })
})
})