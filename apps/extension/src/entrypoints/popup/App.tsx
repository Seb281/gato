import { useState, useEffect } from 'react'
import {
  SignInButton,
  SignOutButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from '@clerk/chrome-extension'
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
import { Languages, Check, CheckCircle, LogOut } from 'lucide-react'
import { LANGUAGE_NAMES } from '@/entrypoints/content/helpers/detectLanguage'
import { Separator } from '@/components/ui/separator'

const EXTENSION_URL = chrome.runtime.getURL('.')

export default function App() {
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [personalContext, setPersonalContext] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [showSignInSuccess, setShowSignInSuccess] = useState(false)
  const [showSignOutSuccess, setShowSignOutSuccess] = useState(false)

  const { isSignedIn, isLoaded } = useAuth()

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

  // Check for pending sign-in/sign-out when popup opens
  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        chrome.storage.local.get(['signInPending'], (result) => {
          if (result.signInPending) {
            setShowSignInSuccess(true)
            chrome.storage.local.remove('signInPending')
            setTimeout(() => setShowSignInSuccess(false), 3000)
            // Fetch settings from API after sign-in
            fetchSettingsFromApi()
          }
        })
      } else {
        chrome.storage.local.get(['signOutPending'], (result) => {
          if (result.signOutPending) {
            setShowSignOutSuccess(true)
            setPersonalContext('')
            chrome.storage.sync.remove('personalContext')
            chrome.storage.local.remove('signOutPending')
            setTimeout(() => setShowSignOutSuccess(false), 3000)
          }
        })
      }
    }
  }, [isSignedIn, isLoaded])

  // Set pending flag when sign-in button is clicked
  const handleSignInClick = () => {
    chrome.storage.local.set({ signInPending: true })
  }

  // Set pending flag when sign-out button is clicked
  const handleSignOutClick = () => {
    chrome.storage.local.set({ signOutPending: true })
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
    if (isSignedIn) {
      chrome.runtime.sendMessage({
        action: 'saveUserSettings',
        settings: {
          targetLanguage,
          personalContext,
        },
      })
    }
  }

  const maxChars = 150
  const remainingChars = maxChars - personalContext.length

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
              <SelectContent className='bg-white'>
                {languages.map((lang) => (
                  <SelectItem
                    key={lang.code}
                    value={lang.name}
                    className='text-black'
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

          <SignedOut>
            {showSignOutSuccess && (
              <div className='flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700'>
                <CheckCircle className='h-4 w-4' />
                <span className='text-sm font-medium'>
                  Successfully signed out!
                </span>
              </div>
            )}
            <div onClick={handleSignInClick}>
              <SignInButton mode='modal'>
                <Button variant='outline' className='w-full'>
                  Sign In
                </Button>
              </SignInButton>
            </div>
          </SignedOut>

          <SignedIn>
            {showSignInSuccess && (
              <div className='flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700'>
                <CheckCircle className='h-4 w-4' />
                <span className='text-sm font-medium'>
                  Successfully signed in!
                </span>
              </div>
            )}
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <UserButton />
                <span className='text-sm text-muted-foreground'>Signed in</span>
              </div>
              <div onClick={handleSignOutClick}>
                <SignOutButton redirectUrl={`${EXTENSION_URL}/popup.html`}>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-muted-foreground hover:text-destructive'
                  >
                    <LogOut className='h-4 w-4 mr-1' />
                    Logout
                  </Button>
                </SignOutButton>
              </div>
            </div>
            <Button
              variant='outline'
              className='w-full'
              onClick={() =>
                chrome.tabs.create({ url: 'http://localhost:3000' })
              }
            >
              Open Dashboard
            </Button>
          </SignedIn>
        </CardContent>
      </Card>
    </div>
  )
}
