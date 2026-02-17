import saveConcept from "./helpers/handleSaveConcept"
import handleTranslation from "./helpers/handleTranslation"
import { isAuthenticated, supabase } from "./helpers/supabaseAuth"
import { fetchUserSettings, saveUserSettings, type UserSettings } from "./helpers/handleUserSettings"

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || "http://localhost:3000"

export default defineBackground(() => {
  // Flag to prevent infinite sync loops when setting session from dashboard
  let _isSyncingFromDashboard = false

  chrome.runtime.onStartup.addListener((): void => {
  console.log("Context Translator service worker started")
})

chrome.runtime.onInstalled.addListener(
  (details: chrome.runtime.InstalledDetails): void => {
    if (details.reason === "install") {
      console.log("Context Translator installed")
    } else if (details.reason === "update") {
      console.log("Context Translator updated")
    }
  }
)

chrome.commands.onCommand.addListener((command: string): void => {
  if (command === "show-translation") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "showTranslation",
        })
      }
    })
  }
})

type TranslateMessage = {
  action: "translate"
  text: string
}

type TranslateResponse = {
  success: boolean
  translateObject?: object // improve typing by adding keys
  error?: string
}

chrome.runtime.onMessage.addListener(
  (
    message: TranslateMessage,
    _: chrome.runtime.MessageSender,
    sendResponse: (response: TranslateResponse) => void
  ): boolean => {

    if (message.action === "translate") {
      chrome.storage.sync
        .get(["targetLanguage", "sourceLanguage", "personalContext"])
        .then((result) => {
          return handleTranslation(
            message.text,
            (result.targetLanguage as string) || "English",
            (result.sourceLanguage as string) || "",
            (result.personalContext as string) || ""
          )
        })
        .then((translateObject) => {
          sendResponse({ success: true, translateObject })
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message })
        })

      return true
    }
    return false
  }
)

type NewConcept = {
  targetLanguage: string
  sourceLanguage: string
  userId: number
  concept: string
  translation: string
  id?: number | undefined
  createdAt?: Date | undefined
  state?: "new" | "learned" | undefined
  updatedAt?: Date | undefined
}

chrome.runtime.onMessage.addListener(
  (message: { action: string; concept: NewConcept }, _, sendResponse) => {
    if (message.action === "saveConcept") {
      saveConcept(message.concept)
        .then((concept) => {
          sendResponse({ success: true, concept })
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message })
        })
      return true
    }
    return false
  }
)

// Listener to handle login status checks using Supabase
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "CHECK_LOGIN_STATUS") {
    isAuthenticated().then((isLoggedIn) => {
      sendResponse({ isLoggedIn })
    })
    return true // Keep channel open for async response
  }
})

// Listener to fetch user settings from API
chrome.runtime.onMessage.addListener(
  (message: { action: string }, _, sendResponse) => {
    if (message.action === "fetchUserSettings") {
      fetchUserSettings()
        .then((settings) => {
          sendResponse({ success: true, settings })
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message })
        })
      return true
    }
    return false
  }
)

// Listener to save user settings to API
chrome.runtime.onMessage.addListener(
  (message: { action: string; settings: UserSettings }, _, sendResponse) => {
    if (message.action === "saveUserSettings") {
      saveUserSettings(message.settings)
        .then((settings) => {
          sendResponse({ success: true, settings })
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message })
        })
      return true
    }
    return false
  }
)

// --- Auth Bridge Sync Handlers ---

// Return the extension's current session to the auth-bridge content script
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.type === "GET_EXTENSION_SESSION") {
    supabase.auth.getSession().then(({ data: { session } }) => {
      sendResponse({ session: session || null })
    })
    return true
  }
  return false
})

// Dashboard signed in -> set session in extension
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.type === "DASHBOARD_SESSION") {
    _isSyncingFromDashboard = true
    supabase.auth
      .setSession({
        access_token: message.access_token,
        refresh_token: message.refresh_token,
      })
      .then(() => {
        sendResponse({ success: true })
      })
      .catch((error: Error) => {
        sendResponse({ success: false, error: error.message })
      })
      .finally(() => {
        // Small delay to let onAuthStateChange fire before clearing flag
        setTimeout(() => { _isSyncingFromDashboard = false }, 500)
      })
    return true
  }
  return false
})

// Dashboard signed out -> sign out extension
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.type === "DASHBOARD_SIGNOUT") {
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
  }
  return false
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