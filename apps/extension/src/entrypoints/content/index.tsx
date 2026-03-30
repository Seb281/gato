import "./content.css"
import { createRoot } from "react-dom/client"
import { initSentry } from "@/lib/sentry"
import TranslationPopup from "./components/TranslationPopup"
import highlight from "./helpers/setHighlight"
import handleSelection from "./helpers/selectText"
import detectPageLanguage from "./helpers/detectLanguage"
import tooltip from "./components/Tooltip"

export default defineContentScript({
  matches: ["https://context-aware-translator-dashboard.vercel.app/*"],
  registration: 'runtime',
  main() {
    try { initSentry({ context: "content" }) } catch { /* Sentry unavailable — extension continues */ }

    const sourceLanguage: string = detectPageLanguage()
    chrome.storage.sync.set({ sourceLanguage })

    // Store the selection when tooltip is shown, not when clicked
    let storedRange: Range | null = null
    let storedContext: { before: string; after: string } = { before: "", after: "" }

    let activeContainer: HTMLDivElement | null = null
    const mq = window.matchMedia("(prefers-color-scheme: dark)")

    mq.addEventListener("change", (e) => {
      if (activeContainer) activeContainer.classList.toggle("dark", e.matches)
    })

    tooltip.init(showTranslationPopup)

    function captureSelection(): boolean {
      const expandedRange = handleSelection.getExpandedSelection()
      if (!expandedRange) return false

      storedRange = expandedRange
      storedContext = handleSelection.getContextAround(expandedRange)
      return true
    }

    function showTranslationPopup(): void {
      tooltip.hide()
      highlight.clear()

      if (!storedRange) return

      const expandedSelectedText: string = storedRange.toString()

      highlight.selection(storedRange)
      if (storedContext.before) highlight.context(storedContext.before)
      if (storedContext.after) highlight.context(storedContext.after)

      const existingPopup = document.getElementById("context-translator-root")
      if (existingPopup) {
        existingPopup.remove()
      }

      const container = document.createElement("div")
      container.id = "context-translator-root"
      container.classList.toggle("dark", mq.matches)
      activeContainer = container
      document.body.appendChild(container)

      const root = createRoot(container)
      root.render(
        <TranslationPopup
          selection={expandedSelectedText}
          selectionRect={handleSelection.selectionRect as DOMRect}
          contextBefore={storedContext.before}
          contextAfter={storedContext.after}
          onClose={(): void => {
            highlight.clear()
            if (activeContainer === container) activeContainer = null
            container.remove()
          }}
        />
      )
    }

    function showTranslationPopupWithText(text: string): void {
      tooltip.hide()
      highlight.clear()

      const existingPopup = document.getElementById("context-translator-root")
      if (existingPopup) existingPopup.remove()

      const container = document.createElement("div")
      container.id = "context-translator-root"
      container.classList.toggle("dark", mq.matches)
      activeContainer = container
      document.body.appendChild(container)

      const rect = new DOMRect(
        window.innerWidth / 2 - 250,
        window.scrollY + 100,
        0,
        0
      )

      const root = createRoot(container)
      root.render(
        <TranslationPopup
          selection={text}
          selectionRect={rect}
          contextBefore=""
          contextAfter=""
          onClose={(): void => {
            highlight.clear()
            if (activeContainer === container) activeContainer = null
            container.remove()
          }}
        />
      )
    }

    chrome.runtime.onMessage.addListener(
      (message: { action: string; selectionText?: string }, _, sendResponse) => {
        if (message.action === "ping") {
          sendResponse({ alive: true })
          return true
        }
        if (message.action === "showTranslation") {
          const hasSelection = captureSelection()
          if (hasSelection) {
            showTranslationPopup()
          } else if (message.selectionText) {
            showTranslationPopupWithText(message.selectionText)
          }
        }
        return false
      }
    )

document.addEventListener("mouseup", () => {
  setTimeout(() => {
    const selection = window.getSelection()
    if (
      !selection ||
      selection.isCollapsed ||
      selection.toString().trim().length < 2
    ) {
      tooltip.hide()
      return
    }

    // Capture the selection before showing tooltip
    if (!captureSelection()) {
      tooltip.hide()
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const x = rect.left + rect.width / 2 + window.scrollX - 50
    const y = rect.top + window.scrollY

    tooltip.show(x, y)
  }, 10)
})

document.addEventListener("mousedown", (e) => {
  if (tooltip.element && !tooltip.element.contains(e.target as Node)) {
    tooltip.hide()
  }
})

document.addEventListener("scroll", tooltip.hide, true)
  },
})
