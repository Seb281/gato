import { getSupabaseToken } from "./supabaseAuth"

const BASE_URL = import.meta.env.VITE_BASE_URL

export default async function updateConcept(conceptId: number, translation: string) {
  const token = await getSupabaseToken()

  if (!token) {
    throw new Error("User not authenticated")
  }

  const response = await fetch(`${BASE_URL}/saved-concepts/${conceptId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ translation }),
  })

  if (!response.ok) {
    throw new Error(`Failed to update concept: ${response.statusText}`)
  }

  const data = await response.json()
  return { success: true, concept: data.concept }
}
