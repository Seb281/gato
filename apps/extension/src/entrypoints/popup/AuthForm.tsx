import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function AuthForm({ supabase }: { supabase: SupabaseClient }) {
  const { t } = useTranslation()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const [awaitingGoogleAuth, setAwaitingGoogleAuth] = useState(false)

  const handleGoogleSignIn = () => {
    chrome.tabs.create({ url: `${import.meta.env.VITE_DASHBOARD_URL}/sign-in` })
    setAwaitingGoogleAuth(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(error.message)
        } else {
          setConfirmationSent(true)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(error.message)
        }
      }
    } catch {
      setError(t('ext.auth.unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  if (awaitingGoogleAuth) {
    return (
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">{t('ext.auth.waitingGoogle')}</p>
        <p className="text-xs text-muted-foreground">
          {t('ext.auth.waitingGoogleDesc')}
        </p>
        <Button variant="link" size="sm" onClick={() => setAwaitingGoogleAuth(false)}>
          {t('ext.auth.cancel')}
        </Button>
      </div>
    )
  }

  if (confirmationSent) {
    return (
      <div className='text-center space-y-2'>
        <p className='text-sm font-medium'>{t('ext.auth.checkEmail')}</p>
        <p className='text-xs text-muted-foreground'>
          {t('ext.auth.confirmationSent')} <strong>{email}</strong>
        </p>
        <Button
          variant='link'
          size='sm'
          onClick={() => {
            setConfirmationSent(false)
            setIsSignUp(false)
            setPassword('')
          }}
        >
          {t('ext.auth.backToSignIn')}
        </Button>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {t('ext.auth.continueWithGoogle')}
      </Button>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">{t('ext.auth.or')}</span>
        </div>
      </div>
    <form onSubmit={handleSubmit} className='space-y-3'>
      <div className='space-y-1.5'>
        <Label htmlFor='email' className='text-xs'>{t('ext.auth.email')}</Label>
        <Input
          id='email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='you@example.com'
          required
        />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='password' className='text-xs'>{t('ext.auth.password')}</Label>
        <Input
          id='password'
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder='••••••••'
          required
          minLength={6}
        />
      </div>
      {error && (
        <p className='text-xs text-destructive'>{error}</p>
      )}
      <Button type='submit' className='w-full' disabled={loading}>
        {loading ? (isSignUp ? t('ext.auth.creatingAccount') : t('ext.auth.signingIn')) : (isSignUp ? t('ext.auth.signUp') : t('ext.auth.signIn'))}
      </Button>
      <p className='text-xs text-center text-muted-foreground'>
        {isSignUp ? t('ext.auth.alreadyHaveAccount') : t('ext.auth.dontHaveAccount')}{' '}
        <button
          type='button'
          onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
          className='text-primary underline-offset-4 hover:underline'
        >
          {isSignUp ? t('ext.auth.signIn') : t('ext.auth.signUp')}
        </button>
      </p>
    </form>
    </div>
  )
}
