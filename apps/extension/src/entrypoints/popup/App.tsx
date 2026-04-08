import { useState, useEffect } from 'react'
import { supabase } from '@/entrypoints/background/helpers/supabaseAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Languages,
  Check,
  LogOut,
  User,
  BookOpen,
  PanelRight,
  ExternalLink,
  MessageSquare,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from '@/lib/i18n/useTranslation'
import AuthForm from './AuthForm'

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL

async function openSidePanelToTab(tab?: string) {
  if (tab) await chrome.storage.session.set({ sidepanelTab: tab })
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })
  if (activeTab?.windowId) {
    chrome.sidePanel.open({ windowId: activeTab.windowId })
    window.close()
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [allowedSites, setAllowedSites] = useState<string[]>([])
  const [currentSitePattern, setCurrentSitePattern] = useState<string | null>(
    null,
  )
  const [dueCount, setDueCount] = useState(0)
  const [sidepanelOpen, setSidepanelOpen] = useState(false)
  const { t } = useTranslation()

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
      if (session) fetchDueCount()
      else setDueCount(0)
    })

    chrome.storage.session.get('sidepanelOpen', (result) => {
      setSidepanelOpen(result.sidepanelOpen === true)
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

    const handleSessionChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'session' && changes.sidepanelOpen !== undefined) {
        setSidepanelOpen(changes.sidepanelOpen.newValue === true)
      }
    }
    chrome.storage.onChanged.addListener(handleSessionChange)

    return () => {
      subscription.unsubscribe()
      chrome.storage.local.onChanged.removeListener(handleStorageChange)
      chrome.storage.onChanged.removeListener(handleSessionChange)
    }
  }, [])

  const fetchDueCount = () => {
    chrome.runtime.sendMessage({ action: 'getDueCount' }, (response) => {
      setDueCount(response?.dueCount ?? 0)
    })
  }

  // Load allowed sites and derive current site pattern
  useEffect(() => {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.url) return
        try {
          const url = new URL(tab.url)
          if (url.protocol === 'https:' || url.protocol === 'http:') {
            const pattern = `${url.origin}/*`
            setCurrentSitePattern(pattern)

            // If permission was granted (e.g. popup closed before addAllowedSite ran),
            // auto-add the site now
            const sitesResponse = await chrome.runtime.sendMessage({
              action: 'getAllowedSites',
            })
            if (sitesResponse?.success) {
              setAllowedSites(sitesResponse.sites)
              if (!sitesResponse.sites.includes(pattern)) {
                const granted = await chrome.permissions.contains({
                  origins: [pattern],
                })
                if (granted) {
                  chrome.runtime.sendMessage(
                    { action: 'addAllowedSite', pattern },
                    (response) => {
                      if (response?.success) setAllowedSites(response.sites)
                    },
                  )
                }
              }
            }
          }
        } catch {
          /* invalid URL, e.g. chrome:// */
        }
      })
  }, [])

  const isCurrentSiteAllowed = currentSitePattern
    ? allowedSites.includes(currentSitePattern)
    : false

  async function handleAddCurrentSite() {
    if (!currentSitePattern) return

    // Check if permission already granted (e.g. from a previous attempt where popup closed)
    const alreadyGranted = await chrome.permissions.contains({
      origins: [currentSitePattern],
    })

    if (!alreadyGranted) {
      const granted = await chrome.permissions.request({
        origins: [currentSitePattern],
      })
      if (!granted) return
    }

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

  if (isLoading) {
    return (
      <div className='w-[380px] p-8 flex items-center justify-center'>
        <p className='text-sm text-muted-foreground'>
          {t('ext.loadingSession')}
        </p>
      </div>
    )
  }

  return (
    <div className='w-[380px]'>
      <Card className='rounded-none shadow-none'>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Languages className='h-5 w-5 text-primary' />
            <CardTitle className='text-lg'>{t('ext.title')}</CardTitle>
          </div>

          {/* Current site toggle */}
          <div className='mt-2'>
            {currentSitePattern ? (
              isCurrentSiteAllowed ? (
                <div className='flex items-center justify-between'>
                  <span className='flex items-center gap-1 text-sm text-green-600 dark:text-green-400 font-medium'>
                    <Check className='h-3.5 w-3.5' />
                    {t('ext.enabledOnSite')}
                  </span>
                  <Button
                    variant='link'
                    size='sm'
                    onClick={() => handleRemoveSite(currentSitePattern)}
                    className='text-muted-foreground hover:text-destructive hover:underline'
                  >
                    {t('ext.remove')}
                  </Button>
                </div>
              ) : (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleAddCurrentSite}
                  className='w-full'
                >
                  {t('ext.enableSite')}
                </Button>
              )
            ) : (
              <p className='text-xs text-muted-foreground'>
                {t('ext.notAvailable')}
              </p>
            )}
          </div>
          <p className='text-[10px] text-muted-foreground mt-1'>
            {t('ext.manageInSettings')}
          </p>
        </CardHeader>

        <CardContent className='space-y-3'>
          {/* Due count badge */}
          {session && dueCount > 0 && (
            <div className='flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/20'>
              <div className='flex items-center gap-2'>
                <BookOpen className='h-4 w-4 text-primary' />
                <span className='text-sm font-medium'>
                  {t('ext.wordsDue', {
                    count: dueCount,
                    words: dueCount === 1 ? 'word' : 'words',
                  })}
                </span>
              </div>
              <Button
                variant='link'
                size='sm'
                onClick={() =>
                  chrome.tabs.create({
                    url: `${DASHBOARD_URL}/dashboard/review`,
                  })
                }
              >
                {t('ext.side.review')}
                <ExternalLink className='h-3 w-3 ml-1' />
              </Button>
            </div>
          )}

          {/* Open Side Panel */}
          {!sidepanelOpen && (
            <Button
              variant='default'
              className='w-full'
              onClick={() => openSidePanelToTab()}
            >
              <PanelRight className='h-4 w-4 mr-2' />
              {t('ext.openSidePanel')}
            </Button>
          )}

          <Separator />

          {/* Auth section */}
          {!session ? (
            <AuthForm supabase={supabase} />
          ) : (
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center'>
                  <User className='h-4 w-4 text-primary' />
                </div>
                <div className='flex flex-col'>
                  <span className='text-xs font-medium truncate max-w-[180px]'>
                    {session.user.email}
                  </span>
                  <span className='text-[10px] text-muted-foreground'>
                    {t('ext.signedIn')}
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
                {t('ext.logout')}
              </Button>
            </div>
          )}

          {/* Feedback link */}
          <Button
            variant='link'
            size='sm'
            className='w-full text-muted-foreground pt-3'
            onClick={() =>
              chrome.tabs.create({
                url: `${DASHBOARD_URL}/dashboard/feedback`,
              })
            }
          >
            <MessageSquare className='h-3.5 w-3.5 mr-1' />
            {t('ext.sendFeedback')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
