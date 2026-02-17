import { getSupabaseToken } from "./supabaseAuth"

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"

type NewConcept = {
  targetLanguage: string
  sourceLanguage: string
  concept: string
  translation: string
  id?: number | undefined
  createdAt?: Date | undefined
  state?: "new" | "learned" | undefined
  updatedAt?: Date | undefined
}

export default async function saveConcept(concept: NewConcept) {
  const token = await getSupabaseToken()

  if (!token) {
    throw new Error("User not authenticated")
  }

  const response = await fetch(`${BASE_URL}/saved-concepts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(concept),
  })

  if (!response.ok) {
    throw new Error(`Failed to save concept: ${response.statusText}`)
  }

  return response.json()
}