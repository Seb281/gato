import saveConcept from "./helpers/handleSaveConcept"
import handleTranslation from "./helpers/handleTranslation"
import { isAuthenticated } from "./helpers/clerkAuth"
import { fetchUserSettings, saveUserSettings, type UserSettings } from "./helpers/handleUserSettings"

export default defineBackground(() => {
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
    console.log("Background received message:", message)

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

// Auth is now handled by Clerk via ClerkProvider in popup

chrome.runtime.onMessage.addListener(
  (message: { action: string; concept: NewConcept }, _, sendResponse) => {
    if (message.action === "saveConcept") {
      console.log("hey")
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

// Listener to handle login status checks using Clerk
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
})
