const BASE_URL = import.meta.env.VITE_BASE_URL
import { getSupabaseToken } from "./supabaseAuth"

export default async function handleEnrichment(
  text: string,
  translation: string,
  targetLanguage: string,
  sourceLanguage: string,
): Promise<object> {
  const token = await getSupabaseToken()

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  return fetch(`${BASE_URL}/translation/enrich`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      text,
      translation,
      targetLanguage: targetLanguage || "English",
      sourceLanguage: sourceLanguage || "",
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Enrichment failed with status ${response.status}`)
      }
      return response.json()
    })
    .catch((error) => {
      throw new Error(
        error instanceof Error ? error.message : "Failed to enrich translation"
      )
    })
}
