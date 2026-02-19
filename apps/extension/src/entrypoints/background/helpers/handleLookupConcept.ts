import { getSupabaseToken } from "./supabaseAuth"

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"

type SavedConcept = {
  id: number
  userId: number
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
  state: string
  createdAt: string
  updatedAt: string
}

export default async function lookupConcept(
  concept: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<SavedConcept | null> {
  const token = await getSupabaseToken()
  if (!token) {
    return null
  }

  try {
    const params = new URLSearchParams({ concept, sourceLanguage, targetLanguage })
    const response = await fetch(`${BASE_URL}/saved-concepts/lookup?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (data.found) {
      return data.concept as SavedConcept
    }

    return null
  } catch {
    return null
  }
}
