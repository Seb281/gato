import { useState, useEffect } from 'react'
import { supabase } from '@/entrypoints/background/helpers/supabaseAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge.tsx'
import { Languages, Check, CheckCircle, LogOut, User } from 'lucide-react'
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

    return () => subscription.unsubscribe()
  }, [])

  // Fetch user settings from API
  const fetchSettingsFromApi = () => {
    chrome.runtime.sendMessage(
      { action: 'fetchUserSettings' },
      (response: { success: boolean; settings?: { targetLanguage: string | null; personalContext: string | null }; error?: string }) => {
        if (response?.success && response.settings) {
          const { targetLanguage: apiTargetLang, personalContext: apiContext } = response.settings
          if (apiTargetLang) {
            setTargetLanguage(apiTargetLang)
            chrome.storage.sync.set({ targetLanguage: apiTargetLang })
          }
          if (apiContext) {
            setPersonalContext(apiContext)
            chrome.storage.sync.set({ personalContext: apiContext })
          }
        }
      }
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
      }
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
      <Card className='rounded-none border-0 shadow-none'>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <Languages className='h-5 w-5 text-primary' />
            <CardTitle className='text-lg'>Context Translator</CardTitle>
          </div>
          <p className='text-sm text-muted-foreground mt-1'>
            Smart translations with context
          </p>
        </CardHeader>

        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label
              htmlFor='language'
              className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'
            >
              Target Language
            </Label>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger id='language'>
                <SelectValue placeholder='Select a language' />
              </SelectTrigger>
              <SelectContent className='bg-popover'>
                {languages.map((lang) => (
                  <SelectItem
                    key={lang.code}
                    value={lang.name}
                    className='text-popover-foreground'
                  >
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <Button onClick={handleSave} className='w-full'>
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

            <div className='space-y-2'>
              <div className='flex items-start gap-3'>
                <Badge
                  variant='outline'
                  className='shrink-0 w-6 h-6 rounded-full flex items-center justify-center p-0'
                >
                  1
                </Badge>
                <p className='text-sm text-muted-foreground'>
                  Select any text on a webpage
                </p>
              </div>

              <div className='flex items-start gap-3'>
                <Badge
                  variant='outline'
                  className='shrink-0 w-6 h-6 rounded-full flex items-center justify-center p-0'
                >
                  2
                </Badge>
                <p className='text-sm text-muted-foreground'>
                  Press{' '}
                  <kbd className='px-2 py-0.5 bg-muted rounded text-xs font-mono'>
                    Ctrl+Shift+T
                  </kbd>
                </p>
              </div>

              <div className='flex items-start gap-3'>
                <Badge
                  variant='outline'
                  className='shrink-0 w-6 h-6 rounded-full flex items-center justify-center p-0'
                >
                  3
                </Badge>
                <p className='text-sm text-muted-foreground'>
                  View context-aware translation
                </p>
              </div>
            </div>
          </div>
          <Separator />

          {!session ? (
            <AuthForm supabase={supabase} />
          ) : (
            <>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center'>
                    <User className='h-4 w-4 text-primary' />
                  </div>
                  <div className='flex flex-col'>
                    <span className='text-xs font-medium truncate max-w-[150px]'>{session.user.email}</span>
                    <span className='text-[10px] text-muted-foreground'>Signed in</span>
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
              <Button
                variant='outline'
                className='w-full'
                onClick={() =>
                  chrome.tabs.create({ url: import.meta.env.VITE_DASHBOARD_URL })
                }
              >
                Open Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}