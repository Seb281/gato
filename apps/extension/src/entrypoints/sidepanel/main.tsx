import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import ErrorBoundary from "@/components/ErrorBoundary"
import "./sidepanel.css"
import { initSentry } from "@/lib/sentry"

initSentry({ context: "sidepanel" })

const mq = window.matchMedia("(prefers-color-scheme: dark)")

function applyTheme(themePref: string) {
  if (themePref === "dark") {
    document.documentElement.classList.add("dark")
  } else if (themePref === "light") {
    document.documentElement.classList.remove("dark")
  } else {
    // system
    document.documentElement.classList.toggle("dark", mq.matches)
  }
}

// Read persisted theme from storage, fallback to system preference
chrome.storage.sync.get(["theme"], (result) => {
  applyTheme((result.theme as string) || "system")
})

mq.addEventListener("change", () => {
  // Re-apply only if theme is "system"
  chrome.storage.sync.get(["theme"], (result) => {
    if (!result.theme || result.theme === "system") {
      applyTheme("system")
    }
  })
})

const root = createRoot(document.getElementById("root")!)
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
