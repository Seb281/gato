import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./popup.css"
import { initSentry } from "@/lib/sentry"

initSentry({ context: "popup" })

const mq = window.matchMedia("(prefers-color-scheme: dark)")

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark)
}

applyTheme(mq.matches)
mq.addEventListener("change", (e) => applyTheme(e.matches))

const root = createRoot(document.getElementById("root")!)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)