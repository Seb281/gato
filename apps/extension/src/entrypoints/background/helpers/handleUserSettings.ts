import { getSupabaseToken } from "./supabaseAuth"

const BASE_URL = import.meta.env.VITE_BASE_URL

export type UserSettings = {
  targetLanguage: string | null
  personalContext: string | null
  theme?: string | null
  displayLanguage?: string | null
}

export async function fetchUserSettings(): Promise<UserSettings> {
  const token = await getSupabaseToken()

  if (!token) {
    throw new Error("User not authenticated")
  }

  const response = await fetch(`${BASE_URL}/user/settings`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch settings: ${response.statusText}`)
  }

  return response.json()
}

export async function saveUserSettings(settings: UserSettings): Promise<UserSettings> {
  const token = await getSupabaseToken()

  if (!token) {
    throw new Error("User not authenticated")
  }

  const response = await fetch(`${BASE_URL}/user/settings`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  })

  if (!response.ok) {
    throw new Error(`Failed to save settings: ${response.statusText}`)
  }

  return response.json()
}