"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

/** Matches the TutorMessage shape from the API. */
export type ChatMessage = {
  id: number
  conversationId: number
  role: "user" | "assistant"
  content: string
  createdAt: string
}

type SSETokenEvent = { type: "token"; content: string }
type SSEDoneEvent = { type: "done"; messageId: number }
type SSEErrorEvent = { type: "error"; message: string }
type SSEEvent = SSETokenEvent | SSEDoneEvent | SSEErrorEvent

/**
 * Custom hook for managing a streaming tutor chat conversation.
 * Handles SSE consumption, optimistic updates, and abort.
 */
export function useTutorChat(conversationId: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL

  /** Fetches the auth token from the current Supabase session. */
  const getToken = useCallback(async (): Promise<string | null> => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  /** Loads messages from the API for the current conversation. */
  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      return
    }

    const token = await getToken()
    if (!token) return

    const res = await fetch(
      `${API_URL}/tutor/conversations/${conversationId}/messages`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) {
      setError("Failed to load messages")
      return
    }

    const data = await res.json()
    setMessages(data.messages)
    setError(null)
  }, [conversationId, API_URL, getToken])

  // Load messages when conversationId changes
  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  /** Sends a message and streams the assistant's response. */
  const send = useCallback(
    async (content: string) => {
      if (!conversationId || isStreaming) return

      setError(null)
      setIsStreaming(true)

      // Optimistic user message with temporary negative ID
      const tempUserMsg: ChatMessage = {
        id: -Date.now(),
        conversationId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempUserMsg])

      // Placeholder for assistant response
      const tempAssistantId = -(Date.now() + 1)
      const tempAssistantMsg: ChatMessage = {
        id: tempAssistantId,
        conversationId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempAssistantMsg])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const token = await getToken()
        if (!token) throw new Error("Not authenticated")

        const res = await fetch(
          `${API_URL}/tutor/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content }),
            signal: controller.signal,
          }
        )

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const msg =
            res.status === 429
              ? body.message || "Rate limit reached"
              : "Failed to send message"
          throw new Error(msg)
        }

        if (!res.body) throw new Error("No response stream")

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            const event: SSEEvent = JSON.parse(jsonStr)

            if (event.type === "token") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              )
            } else if (event.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId ? { ...m, id: event.messageId } : m
                )
              )
            } else if (event.type === "error") {
              throw new Error(event.message)
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // User stopped the stream — keep partial content
        } else {
          setError(err.message || "Something went wrong")
          // Remove the empty/failed assistant message
          setMessages((prev) =>
            prev.filter((m) => m.id !== tempAssistantId || m.content.length > 0)
          )
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [conversationId, isStreaming, API_URL, getToken]
  )

  /** Aborts the current streaming response. */
  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, isStreaming, error, send, stop, loadMessages }
}
