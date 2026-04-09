"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTutorChat, type ChatMessage } from "@/hooks/useTutorChat"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Send,
  Square,
  Trash2,
  MessageSquare,
  PanelRightOpen,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"

const API_URL = process.env.NEXT_PUBLIC_API_URL

type Conversation = {
  id: number
  title: string | null
  messageCount: number
  updatedAt: string
}

/**
 * Tutor chat page. Main area (left) shows the active conversation.
 * Right panel shows conversation list. Mobile uses a sheet drawer.
 */
export default function TutorPage() {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [inputValue, setInputValue] = useState("")
  const [userSettings, setUserSettings] = useState<{
    targetLanguage: string | null
  }>({ targetLanguage: null })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingMessageRef = useRef<string | null>(null)

  const { messages, isStreaming, error, send, stop } = useTutorChat(activeId)

  // Send pending message after conversation is created and hook re-initializes
  useEffect(() => {
    if (activeId && pendingMessageRef.current && !isStreaming) {
      const msg = pendingMessageRef.current
      pendingMessageRef.current = null
      send(msg)
    }
  }, [activeId, send, isStreaming])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Show errors as toasts
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  /** Fetches the conversation list from the API. */
  const fetchConversations = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    try {
      const res = await fetch(`${API_URL}/tutor/conversations?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setConversations(json.conversations)
    } catch {
      toast.error("Failed to load conversations")
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  /** Fetches user settings to get targetLanguage for starters. */
  const fetchUserSettings = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    try {
      const res = await fetch(`${API_URL}/user/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setUserSettings({ targetLanguage: json.targetLanguage ?? null })
      }
    } catch {
      // Non-critical — starters will use fallback text
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    fetchUserSettings()
  }, [fetchConversations, fetchUserSettings])

  /** Creates a new conversation and selects it. */
  async function handleNewConversation() {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    try {
      const res = await fetch(`${API_URL}/tutor/conversations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setActiveId(json.conversation.id)
      setConversations((prev) => [json.conversation, ...prev])
    } catch {
      toast.error("Failed to create conversation")
    }
  }

  /** Deletes a conversation. */
  async function handleDelete(conversationId: number) {
    if (!confirm(t("tutor.deleteConfirm"))) return

    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    try {
      const res = await fetch(
        `${API_URL}/tutor/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) throw new Error()
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      if (activeId === conversationId) setActiveId(null)
    } catch {
      toast.error("Failed to delete conversation")
    }
  }

  /** Sends the current input as a message. */
  async function handleSend() {
    const trimmed = inputValue.trim()
    if (!trimmed || isStreaming) return

    if (!activeId) {
      // Auto-create a conversation if none selected
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return

      try {
        const res = await fetch(`${API_URL}/tutor/conversations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        if (!res.ok) throw new Error()
        const json = await res.json()
        const newConv = json.conversation
        setConversations((prev) => [newConv, ...prev])
        setInputValue("")
        pendingMessageRef.current = trimmed
        setActiveId(newConv.id)
        return
      } catch {
        toast.error("Failed to create conversation")
        return
      }
    }

    setInputValue("")
    await send(trimmed)

    // Refresh conversation list to update title/timestamp
    fetchConversations()
  }

  /** Handles keyboard shortcuts in the textarea. */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const activeConversation = conversations.find((c) => c.id === activeId)
  const lang = userSettings.targetLanguage || "your target language"
  const showStarters = activeId && messages.length === 0

  /** Conversation starters — static strings with interpolated target language. */
  const starters = [
    {
      labelKey: "tutor.starters.vocabulary" as const,
      message: `Let's practice some vocabulary in ${lang}.`,
    },
    {
      labelKey: "tutor.starters.grammar" as const,
      message: `Can you explain a grammar concept in ${lang}?`,
    },
    {
      labelKey: "tutor.starters.write" as const,
      message: `Help me write something in ${lang}.`,
    },
    {
      labelKey: "tutor.starters.converse" as const,
      message: `Let's have a conversation in ${lang}. Start with something simple.`,
    },
  ]

  /** Renders the conversation list. Shared between sidebar and mobile sheet. */
  function ConversationList() {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3">
          <Button
            onClick={handleNewConversation}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <Plus className="size-4 mr-2" />
            {t("tutor.newConversation")}
          </Button>
        </div>
        <Separator />
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingList ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {t("tutor.empty")}
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                  conv.id === activeId
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                }`}
                onClick={() => setActiveId(conv.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">
                    {conv.title || t("tutor.newChat")}
                  </p>
                  <p
                    className={`text-xs ${
                      conv.id === activeId
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(conv.id)
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)]">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-12 border-b shrink-0">
          {/* Mobile sheet trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-8 w-8 p-0"
              >
                <PanelRightOpen className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="px-3 pt-3">
                <SheetTitle>{t("tutor.conversations")}</SheetTitle>
              </SheetHeader>
              <ConversationList />
            </SheetContent>
          </Sheet>

          <MessageSquare className="size-4 text-muted-foreground" />
          <h1 className="text-sm font-medium truncate">
            {activeConversation?.title || t("nav.teacher")}
          </h1>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!activeId && conversations.length === 0 && !isLoadingList && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="size-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">{t("tutor.empty")}</p>
              <Button onClick={handleNewConversation}>
                <Plus className="size-4 mr-2" />
                {t("tutor.newConversation")}
              </Button>
            </div>
          )}

          {showStarters && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <MessageSquare className="size-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm mb-2">
                {t("tutor.empty")}
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {starters.map((s) => (
                  <Button
                    key={s.labelKey}
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-3 text-xs whitespace-normal text-left"
                    onClick={() => {
                      setInputValue("")
                      send(s.message)
                      fetchConversations()
                    }}
                  >
                    {t(s.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {isStreaming && msg.id < 0 && (
                      <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t p-3 shrink-0">
          <div className="flex gap-2 items-end max-w-3xl mx-auto">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("tutor.placeholder")}
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button
                onClick={stop}
                variant="outline"
                size="sm"
                className="shrink-0 h-10"
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                size="sm"
                className="shrink-0 h-10"
                disabled={!inputValue.trim()}
              >
                <Send className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Right sidebar — conversation list (desktop only) */}
      <div className="hidden lg:flex flex-col w-64 border-l bg-sidebar">
        <ConversationList />
      </div>
    </div>
  )
}
