import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/entrypoints/background/helpers/supabaseAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LANGUAGE_NAMES } from '@/entrypoints/content/helpers/detectLanguage'
import { History, Bookmark, Settings, Check, ExternalLink, BookOpen, Bell, X, MessageSquare, Languages } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import QuickReview from '@/components/QuickReview'
import TranslateTab from '@/components/TranslateTab'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from '@/lib/i18n/useTranslation'

type TranslationHistoryItem = {
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
  url: string
  timestamp: number
}

type SavedConcept = {
  id: number
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
  createdAt: string
}

type Tab = 'translate' | 'history' | 'saved' | 'review' | 'settings'

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL

export default function App() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('translate')
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dueCount, setDueCount] = useState(0)
  const [isSiteEnabled, setIsSiteEnabled] = useState(true) // default true to avoid flash
  const [currentSitePattern, setCurrentSitePattern] = useState<string | null>(null)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.url) return
      try {
        const url = new URL(tab.url)
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          const pattern = `${url.origin}/*`
          setCurrentSitePattern(pattern)
          chrome.runtime.sendMessage({ action: 'getAllowedSites' }, (response) => {
            if (response?.success) {
              setIsSiteEnabled(response.sites.includes(pattern))
            }
          })
        }
      } catch { /* invalid URL */ }
    })
  }, [])

  async function handleEnableSite() {
    if (!currentSitePattern) return
    const granted = await chrome.permissions.request({ origins: [currentSitePattern] })
    if (!granted) return
    chrome.runtime.sendMessage(
      { action: 'addAllowedSite', pattern: currentSitePattern },
      (response) => {
        if (response?.success) setIsSiteEnabled(true)
      },
    )
  }

  const fetchDueCount = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'getDueCount' }, (response) => {
      setDueCount(response?.dueCount ?? 0)
    })
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
      if (session) fetchDueCount()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // Read one-shot tab navigation signal from popup
    chrome.storage.session.get('sidepanelTab', (result) => {
      if (result.sidepanelTab) {
        setActiveTab(result.sidepanelTab as Tab)
        chrome.storage.session.remove('sidepanelTab')
      }
    })

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      const hasAuthChange = Object.keys(changes).some((k) => k.includes('auth'))
      if (!hasAuthChange) return
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
      })
    }
    chrome.storage.local.onChanged.addListener(handleStorageChange)

    // Listen for tab navigation signals while sidepanel is already open
    const handleSessionChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'session' && changes.sidepanelTab?.newValue) {
        setActiveTab(changes.sidepanelTab.newValue as Tab)
        chrome.storage.session.remove('sidepanelTab')
      }
    }
    chrome.storage.onChanged.addListener(handleSessionChange)

    return () => {
      subscription.unsubscribe()
      chrome.storage.local.onChanged.removeListener(handleStorageChange)
      chrome.storage.onChanged.removeListener(handleSessionChange)
    }
  }, [])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'translate', label: t('ext.side.translate'), icon: <Languages className="h-3.5 w-3.5" /> },
    { id: 'history', label: t('ext.side.history'), icon: <History className="h-3.5 w-3.5" /> },
    { id: 'saved', label: t('ext.side.saved'), icon: <Bookmark className="h-3.5 w-3.5" /> },
    { id: 'review', label: t('ext.side.review'), icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: 'settings', label: t('ext.side.settings'), icon: <Settings className="h-3.5 w-3.5" /> },
  ]

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="h-screen flex flex-col">
        {/* Enable site prompt */}
        {!isSiteEnabled && currentSitePattern && (
          <div className="px-3 py-2 bg-primary/5 border-b border-primary/20 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              {t('ext.side.enableSitePrompt')}
            </p>
            <Button size="sm" variant="default" onClick={handleEnableSite} className="shrink-0 text-xs">
              {t('ext.side.enableHere')}
            </Button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'translate' && (
            <TranslateTab
              session={session}
              onSwitchToSettings={() => setActiveTab('settings')}
            />
          )}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'saved' && <SavedTab session={session} />}
          {activeTab === 'review' && (
            <ReviewTab
              session={session}
              onComplete={() => {
                setActiveTab('history')
                fetchDueCount()
              }}
            />
          )}
          {activeTab === 'settings' && <SettingsTab session={session} />}
        </div>

        {/* Bottom icon bar */}
        <div className="shrink-0 border-t border-border bg-background">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center p-3 transition-colors ${
                      activeTab === tab.id
                        ? 'text-foreground bg-secondary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.icon}
                    {tab.id === 'review' && dueCount > 0 && (
                      <span className="ml-0.5 text-[8px] font-bold text-primary">
                        {dueCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {tab.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// --- History Tab ---

function HistoryTab() {
  const { t } = useTranslation()
  const [history, setHistory] = useState<TranslationHistoryItem[]>([])

  const loadHistory = useCallback(() => {
    chrome.storage.session.get('translationHistory', (result) => {
      setHistory((result.translationHistory as TranslationHistoryItem[]) || [])
    })
  }, [])

  useEffect(() => {
    loadHistory()

    const handleChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'session' && changes.translationHistory) {
        setHistory(
          (changes.translationHistory.newValue as TranslationHistoryItem[]) || [],
        )
      }
    }

    chrome.storage.onChanged.addListener(handleChange)
    return () => chrome.storage.onChanged.removeListener(handleChange)
  }, [loadHistory])

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <History className="h-8 w-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{t('ext.side.noTranslations')}</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('ext.side.noTranslationsDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {history.map((item, index) => (
        <TranslationCard key={`${item.timestamp}-${index}`} item={item} />
      ))}
    </div>
  )
}

function TranslationCard({ item }: { item: TranslationHistoryItem }) {
  const timeAgo = getTimeAgo(item.timestamp)
  const hostname = getHostname(item.url)

  return (
    <div className="px-3 py-2.5 hover:bg-secondary/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-snug break-words">
          {item.concept}
        </p>
        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
          {item.sourceLanguage}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mt-0.5 break-words">
        {item.translation}
      </p>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/70">
        <span>{timeAgo}</span>
        {hostname && (
          <>
            <span>·</span>
            <span className="truncate max-w-[150px]">{hostname}</span>
          </>
        )}
      </div>
    </div>
  )
}

// --- Saved Tab ---

function SavedTab({ session }: { session: Session | null }) {
  const { t } = useTranslation()
  const [savedConcepts, setSavedConcepts] = useState<SavedConcept[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    setIsLoading(true)
    setError(null)

    chrome.runtime.sendMessage(
      { action: 'fetchSavedConcepts', limit: 10 },
      (response) => {
        if (chrome.runtime.lastError) {
          setIsLoading(false)
          setError(chrome.runtime.lastError.message || 'Connection error')
          return
        }
        setIsLoading(false)
        if (response?.success) {
          setSavedConcepts(response.concepts || [])
        } else {
          setError(response?.error || 'Failed to load saved concepts')
        }
      },
    )
  }, [session])

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <Bookmark className="h-8 w-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{t('ext.side.signInRequired')}</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('ext.side.openPopupSignIn')}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">{t('ext.side.loadingSaved')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => {
            setIsLoading(true)
            setError(null)
            chrome.runtime.sendMessage(
              { action: 'fetchSavedConcepts', limit: 10 },
              (response) => {
                if (chrome.runtime.lastError) {
                  setIsLoading(false)
                  setError(chrome.runtime.lastError.message || 'Connection error')
                  return
                }
                setIsLoading(false)
                if (response?.success) {
                  setSavedConcepts(response.concepts || [])
                } else {
                  setError(response?.error || 'Failed to load saved concepts')
                }
              },
            )
          }}
        >
          {t('ext.side.retry')}
        </Button>
      </div>
    )
  }

  if (savedConcepts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <Bookmark className="h-8 w-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{t('ext.side.noSavedConcepts')}</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('ext.side.noSavedConceptsDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {savedConcepts.map((concept) => (
        <SavedConceptCard key={concept.id} concept={concept} />
      ))}
    </div>
  )
}

function SavedConceptCard({ concept }: { concept: SavedConcept }) {
  return (
    <div className="px-3 py-2.5 hover:bg-secondary/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground leading-snug break-words">
          {concept.concept}
        </p>
        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
          {concept.sourceLanguage}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mt-0.5 break-words">
        {concept.translation}
      </p>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground/70">
          {new Date(concept.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={() => {
            chrome.tabs.create({ url: `${DASHBOARD_URL}/vocabulary` })
          }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {t('ext.side.view')}
        </button>
      </div>
    </div>
  )
}

// --- Review Tab ---

function ReviewTab({ session, onComplete }: { session: Session | null; onComplete: () => void }) {
  const { t } = useTranslation()

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{t('ext.side.signInToReview')}</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('ext.side.openPopupSignIn')}
        </p>
      </div>
    )
  }

  return <QuickReview onBack={onComplete} />
}

// --- Settings Tab ---

function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${display}:00 ${period}`
}

function SettingsTab({ session }: { session: Session | null }) {
  const { t } = useTranslation()
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [personalContext, setPersonalContext] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderHour, setReminderHour] = useState(9)
  const [allowedSites, setAllowedSites] = useState<string[]>([])

  const languages: Array<{ code: string; name: string }> = []
  for (const lang in LANGUAGE_NAMES) {
    languages.push({ code: lang, name: LANGUAGE_NAMES[lang] })
  }

  useEffect(() => {
    chrome.storage.sync.get(
      ['targetLanguage', 'personalContext', 'reminderEnabled', 'reminderHour'],
      (result) => {
        if (result.targetLanguage)
          setTargetLanguage(result.targetLanguage as string)
        if (result.personalContext)
          setPersonalContext(result.personalContext as string)
        if (result.reminderEnabled !== undefined)
          setReminderEnabled(result.reminderEnabled as boolean)
        if (result.reminderHour !== undefined)
          setReminderHour(result.reminderHour as number)
      },
    )

    chrome.runtime.sendMessage({ action: 'getAllowedSites' }, (response) => {
      if (response?.success) setAllowedSites(response.sites)
    })
  }, [])

  useEffect(() => {
    if (!session) return
    chrome.runtime.sendMessage(
      { action: 'fetchUserSettings' },
      (response: {
        success: boolean
        settings?: {
          targetLanguage: string | null
          personalContext: string | null
          theme?: string | null
          displayLanguage?: string | null
        }
        error?: string
      }) => {
        if (response?.success && response.settings) {
          const { targetLanguage: apiTargetLang, personalContext: apiContext, theme: apiTheme, displayLanguage: apiDisplayLang } =
            response.settings
          if (apiTargetLang) {
            setTargetLanguage(apiTargetLang)
            chrome.storage.sync.set({ targetLanguage: apiTargetLang })
          }
          if (apiContext) {
            setPersonalContext(apiContext)
            chrome.storage.sync.set({ personalContext: apiContext })
          }
          if (apiTheme) {
            chrome.storage.sync.set({ theme: apiTheme })
          }
          if (apiDisplayLang) {
            chrome.storage.sync.set({ displayLanguage: apiDisplayLang })
          }
        }
      },
    )
  }, [session])

  function handleSave() {
    chrome.storage.sync.set(
      { targetLanguage, personalContext },
      () => {
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
      },
    )

    if (session) {
      chrome.runtime.sendMessage({
        action: 'saveUserSettings',
        settings: { targetLanguage, personalContext },
      })
    }
  }

  function handleReminderToggle(enabled: boolean) {
    setReminderEnabled(enabled)
    chrome.storage.sync.set({ reminderEnabled: enabled })
  }

  function handleReminderHourChange(hour: number) {
    setReminderHour(hour)
    chrome.storage.sync.set({ reminderHour: hour })
  }

  function handleRemoveSite(pattern: string) {
    chrome.runtime.sendMessage(
      { action: 'removeAllowedSite', pattern },
      (response) => {
        if (response?.success) setAllowedSites(response.sites)
      },
    )
  }

  const maxChars = 150
  const remainingChars = maxChars - personalContext.length

  return (
    <div className="p-4 space-y-4">
      {/* Target Language */}
      <div className="space-y-2">
        <Label
          htmlFor="language"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t('ext.targetLanguage')}
        </Label>
        <select
          id="language"
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          className="w-full h-9 rounded-lg bg-secondary px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.name}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Personal Context */}
      <div className="space-y-2">
        <Label
          htmlFor="context"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t('ext.personalContext')}
          <span className="text-muted-foreground font-normal text-xs ml-1 normal-case">
            {t('ext.personalContextOptional')}
          </span>
        </Label>
        <Textarea
          id="context"
          value={personalContext}
          onChange={(e) => {
            if (e.target.value.length <= maxChars) {
              setPersonalContext(e.target.value)
            }
          }}
          placeholder="e.g., I'm a software engineer learning Spanish..."
          className="resize-none"
          rows={3}
          maxLength={maxChars}
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            {t('ext.personalContextHint')}
          </p>
          <Badge
            variant={remainingChars < 20 ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {t('ext.side.charsLeft', { count: remainingChars })}
          </Badge>
        </div>
      </div>

      <Button onClick={handleSave} variant="outline" className="w-full" size="sm">
        {isSaved ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            {t('ext.saved')}
          </>
        ) : (
          t('ext.savePreferences')
        )}
      </Button>

      <Separator />

      {/* Daily Reminder */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('ext.dailyReminder')}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{t('ext.reviewReminder')}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reminderEnabled}
            onClick={() => handleReminderToggle(!reminderEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              reminderEnabled ? 'bg-primary' : 'bg-input'
            }`}
          >
            <span
              className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                reminderEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {reminderEnabled && (
          <div className="flex items-center gap-2 pl-5.5">
            <Label
              htmlFor="reminder-hour"
              className="text-xs text-muted-foreground"
            >
              {t('ext.notifyAt')}
            </Label>
            <select
              id="reminder-hour"
              value={reminderHour}
              onChange={(e) => handleReminderHourChange(Number(e.target.value))}
              className="h-7 rounded-md bg-secondary px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Separator />

      {/* Enabled Sites */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('ext.side.manageSites')}
        </p>
        {allowedSites.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground">{t('ext.side.noSites')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('ext.side.noSitesDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            {allowedSites.map((site) => (
              <div
                key={site}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate max-w-[220px] text-muted-foreground">
                  {site.replace('/*', '')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSite(site)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Links */}
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            chrome.tabs.create({ url: DASHBOARD_URL })
          }
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          {t('ext.openDashboard')}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            chrome.tabs.create({ url: `${DASHBOARD_URL}/dashboard/feedback` })
          }
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          {t('ext.sendFeedback')}
        </Button>
      </div>

      <Separator />

      {/* How to Use */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('ext.howToUse')}
        </p>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-foreground mb-1">
              {t('ext.anyPage')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('ext.anyPageDesc')}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-1">
              {t('ext.enabledSites')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('ext.enabledSitesDesc')}
            </p>
          </div>
        </div>
      </div>

      {!session && (
        <>
          <Separator />
          <p className="text-xs text-center text-muted-foreground">
            {t('ext.side.signInToSync')}
          </p>
        </>
      )}
    </div>
  )
}

// --- Helpers ---

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getHostname(url: string): string {
  if (!url) return ''
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
