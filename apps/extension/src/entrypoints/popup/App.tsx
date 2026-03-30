import { useState, useEffect } from 'react'
import { supabase } from '@/entrypoints/background/helpers/supabaseAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge.tsx'
import { Languages, Check, LogOut, User, X } from 'lucide-react'
import { LANGUAGE_NAMES } from '@/entrypoints/content/helpers/detectLanguage'
import { Separator } from '@/components/ui/separator'
import type { Session } from '@supabase/supabase-js'
import AuthForm from './AuthForm'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [personalContext, setPersonalContext] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [allowedSites, setAllowedSites] = useState<string[]>([])
  const [currentSitePattern, setCurrentSitePattern] = useState<string | null>(null)

  // Initialize Supabase session and listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
      if (session) {
        fetchSettingsFromApi()
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchSettingsFromApi()
      } else {
        setPersonalContext('')
      }
    })

    // React to session written by background (e.g. auth-bridge dashboard sync)
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      const hasAuthChange = Object.keys(changes).some((k) => k.includes('auth'))
      if (!hasAuthChange) return
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        if (session) fetchSettingsFromApi()
        else setPersonalContext('')
      })
    }
    chrome.storage.local.onChanged.addListener(handleStorageChange)

    return () => {
      subscription.unsubscribe()
      chrome.storage.local.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  // Fetch user settings from API
  const fetchSettingsFromApi = () => {
    chrome.runtime.sendMessage(
      { action: 'fetchUserSettings' },
      (response: {
        success: boolean
        settings?: {
          targetLanguage: string | null
          personalContext: string | null
        }
        error?: string
      }) => {
        if (response?.success && response.settings) {
          const { targetLanguage: apiTargetLang, personalContext: apiContext } =
            response.settings
          if (apiTargetLang) {
            setTargetLanguage(apiTargetLang)
            chrome.storage.sync.set({ targetLanguage: apiTargetLang })
          }
          if (apiContext) {
            setPersonalContext(apiContext)
            chrome.storage.sync.set({ personalContext: apiContext })
          }
        }
      },
    )
  }

  const languages: Array<{ code: string; name: string }> = []

  for (const lang in LANGUAGE_NAMES) {
    languages.push({ code: lang, name: LANGUAGE_NAMES[lang] })
  }

  useEffect(() => {
    chrome.storage.sync.get(['targetLanguage', 'personalContext'], (result) => {
      if (result.targetLanguage)
        setTargetLanguage(result.targetLanguage as string)
      if (result.personalContext)
        setPersonalContext(result.personalContext as string)
    })
  }, [])

  function handleSave() {
    // Save to local storage
    chrome.storage.sync.set(
      {
        targetLanguage,
        personalContext,
      },
      () => {
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
      },
    )

    // Also save to API if signed in
    if (session) {
      chrome.runtime.sendMessage({
        action: 'saveUserSettings',
        settings: {
          targetLanguage,
          personalContext,
        },
      })
    }
  }

  // Load allowed sites and derive current site pattern
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.url) return
      try {
        const url = new URL(tab.url)
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          setCurrentSitePattern(`${url.origin}/*`)
        }
      } catch { /* invalid URL, e.g. chrome:// */ }
    })

    chrome.runtime.sendMessage({ action: 'getAllowedSites' }, (response) => {
      if (response?.success) setAllowedSites(response.sites)
    })
  }, [])

  const isCurrentSiteAllowed = currentSitePattern
    ? allowedSites.includes(currentSitePattern)
    : false

  async function handleAddCurrentSite() {
    if (!currentSitePattern) return
    const granted = await chrome.permissions.request({
      origins: [currentSitePattern],
    })
    if (!granted) return

    chrome.runtime.sendMessage(
      { action: 'addAllowedSite', pattern: currentSitePattern },
      (response) => {
        if (response?.success) setAllowedSites(response.sites)
      },
    )
  }

  function handleRemoveSite(pattern: string) {
    chrome.runtime.sendMessage(
      { action: 'removeAllowedSite', pattern },
      (response) => {
        if (response?.success) setAllowedSites(response.sites)
      },
    )
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const maxChars = 150
  const remainingChars = maxChars - personalContext.length

  if (isLoading) {
    return (
      <div className='w-[420px] p-8 flex items-center justify-center'>
        <p className='text-sm text-muted-foreground'>Loading session...</p>
      </div>
    )
  }

  return (
    <div className='w-[420px]'>
      <Card className='rounded-none shadow-none'>
        <CardHeader className=''>
          <div className='flex items-center gap-2'>
            <Languages className='h-5 w-5 text-primary' />
            <CardTitle className='text-lg'>Context-Aware Translator</CardTitle>
          </div>
          <p className='text-sm text-muted-foreground mt-1'>
            Translate any text, in context. Enable on a site for automatic
            activation, or right-click selected text to translate anywhere.
          </p>
          <div className='mt-2'>
            {currentSitePattern ? (
              isCurrentSiteAllowed ? (
                <div className='flex items-center justify-between'>
                  <span className='flex items-center gap-1 text-sm text-green-600 dark:text-green-400 font-medium'>
                    <Check className='h-3.5 w-3.5' />
                    Enabled on this site
                  </span>
                  <Button
                    variant='link'
                    size='sm'
                    onClick={() => handleRemoveSite(currentSitePattern)}
                    className='text-muted-foreground hover:text-destructive hover:underline'
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <Button
                  variant='link'
                  size='sm'
                  onClick={handleAddCurrentSite}
                  className='text-foreground'
                >
                  Enable on this site
                </Button>
              )
            ) : (
              <p className='text-xs text-muted-foreground'>
                Translation is not available on this page.
              </p>
            )}
          </div>
          {allowedSites.length > 0 && (
            <div className='mt-3 space-y-1'>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Enabled Sites
              </p>
              <div className='space-y-0.5 max-h-[100px] overflow-y-auto'>
                {allowedSites.map((site) => (
                  <div
                    key={site}
                    className='flex items-center justify-between text-sm'
                  >
                    <span className='truncate max-w-[280px] text-muted-foreground'>
                      {site.replace('/*', '')}
                    </span>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleRemoveSite(site)}
                      className='h-6 w-6 p-0 text-muted-foreground hover:text-destructive'
                    >
                      <X className='h-3 w-3' />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label
              htmlFor='language'
              className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'
            >
              Target Language
            </Label>
            <select
              id='language'
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className='h-9 rounded-lg bg-secondary px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.name}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <div className='space-y-2'>
            <Label
              htmlFor='context'
              className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'
            >
              Personal Context
              <span className='text-muted-foreground font-normal text-xs ml-1 normal-case'>
                (optional)
              </span>
            </Label>
            <Textarea
              id='context'
              value={personalContext}
              onChange={(e) => {
                if (e.target.value.length <= maxChars) {
                  setPersonalContext(e.target.value)
                }
              }}
              placeholder="e.g., I'm a software engineer learning Spanish..."
              className='resize-none'
              rows={3}
              maxLength={maxChars}
            />
            <div className='flex justify-between items-center'>
              <p className='text-xs text-muted-foreground'>
                Help improve translation relevance
              </p>
              <Badge
                variant={remainingChars < 20 ? 'destructive' : 'secondary'}
                className='text-xs'
              >
                {remainingChars} left
              </Badge>
            </div>
          </div>

          <Button onClick={handleSave} variant='default' className='w-full'>
            {isSaved ? (
              <>
                <Check className='w-4 h-4 mr-2' />
                Saved!
              </>
            ) : (
              'Save Settings'
            )}
          </Button>

          <Separator />

          <div className='space-y-2'>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
              How to Use
            </p>

            <div className='space-y-3'>
              <div>
                <p className='text-xs font-medium text-foreground mb-1'>
                  On any page (no setup needed)
                </p>
                <p className='text-xs text-muted-foreground'>
                  Select text, right-click, and choose{' '}
                  <span className='font-medium text-foreground'>"Translate"</span>{' '}
                  from the menu.
                </p>
              </div>

              <div>
                <p className='text-xs font-medium text-foreground mb-1'>
                  On enabled sites (automatic)
                </p>
                <p className='text-xs text-muted-foreground'>
                  Click{' '}
                  <span className='font-medium text-foreground'>
                    "Enable on this site"
                  </span>{' '}
                  above. Then just select text and click the tooltip that
                  appears. Works across refreshes and restarts.
                </p>
              </div>
            </div>
          </div>
          <Separator />

          {!session ? (
            <AuthForm supabase={supabase} />
          ) : (
            <>
              <Button
                variant='outline'
                className='w-full'
                onClick={() =>
                  chrome.tabs.create({
                    url: import.meta.env.VITE_DASHBOARD_URL,
                  })
                }
              >
                Open Dashboard
              </Button>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center'>
                    <User className='h-4 w-4 text-primary' />
                  </div>
                  <div className='flex flex-col'>
                    <span className='text-xs font-medium truncate max-w-[150px]'>
                      {session.user.email}
                    </span>
                    <span className='text-[10px] text-muted-foreground'>
                      Signed in
                    </span>
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleSignOut}
                  className='text-muted-foreground hover:text-destructive'
                >
                  <LogOut className='h-4 w-4 mr-1' />
                  Logout
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
