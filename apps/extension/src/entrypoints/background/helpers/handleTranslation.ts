const BASE_URL = import.meta.env.VITE_BASE_URL
import { getSupabaseToken } from "./supabaseAuth"

export default async function handleTranslation(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  personalContext: string,
  selection?: string,
  contextBefore?: string,
  contextAfter?: string,
): Promise<object> {
  const token = await getSupabaseToken()

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const body: Record<string, string> = {
    text: text,
    targetLanguage: targetLanguage || "English",
    sourceLanguage: sourceLanguage,
    personalContext: personalContext || "",
  }

  if (selection) body.selection = selection
  if (contextBefore) body.contextBefore = contextBefore
  if (contextAfter) body.contextAfter = contextAfter

  return fetch(`${BASE_URL}/translation`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Translation failed with status ${response.status}`)
      }
      return response.json()
    })
    .catch((error) => {
      throw new Error(
        error instanceof Error ? error.message : "Failed to translate text"
      )
    })
}