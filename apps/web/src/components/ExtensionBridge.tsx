'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session } from '@supabase/supabase-js'

/**
 * Pushes Supabase auth state to the Context-Aware Translator extension
 * via window.postMessage. The extension's auth-bridge content script
 * listens for these messages and relays them to the background service worker.
 * Renders nothing — side-effects only.
 */
export default function ExtensionBridge() {
  const currentSessionRef = useRef<Session | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Re-send current session when extension bridge announces itself
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'EXTENSION_BRIDGE_READY' && currentSessionRef.current) {
        window.postMessage(
          {
            type: 'SUPABASE_SESSION',
            access_token: currentSessionRef.current.access_token,
            refresh_token: currentSessionRef.current.refresh_token,
          },
          window.location.origin
        )
      }
    }
    window.addEventListener('message', handleMessage)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      currentSessionRef.current = session

      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        window.postMessage(
          {
            type: 'SUPABASE_SESSION',
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          },
          window.location.origin
        )
      } else if (event === 'SIGNED_OUT') {
        window.postMessage({ type: 'SUPABASE_SIGNOUT' }, window.location.origin)
      }
    })

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  return null
}
