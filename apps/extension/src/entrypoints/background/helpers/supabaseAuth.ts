import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Missing Supabase configuration (VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY)")
}

/**
 * Storage adapter using chrome.storage.local so the Supabase session is
 * accessible from both the popup and the MV3 background service worker
 * (which does NOT have access to localStorage).
 */
const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key)
    return (result[key] as string) ?? null
  },
  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },
  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: chromeStorageAdapter,
  }
})

export async function getSupabaseToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  } catch (error) {
    console.error("Failed to get Supabase token:", error)
    return null
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session
  } catch (error) {
    console.error("Failed to check auth status:", error)
    return false
  }
}
