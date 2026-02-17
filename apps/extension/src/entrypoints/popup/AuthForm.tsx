import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SupabaseClient } from '@supabase/supabase-js'

export default function AuthForm({ supabase }: { supabase: SupabaseClient }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

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
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className='text-center space-y-2'>
        <p className='text-sm font-medium'>Check your email</p>
        <p className='text-xs text-muted-foreground'>
          We sent a confirmation link to <strong>{email}</strong>
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
          Back to Sign In
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-3'>
      <div className='space-y-1.5'>
        <Label htmlFor='email' className='text-xs'>Email</Label>
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
        <Label htmlFor='password' className='text-xs'>Password</Label>
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
        {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
      </Button>
      <p className='text-xs text-center text-muted-foreground'>
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type='button'
          onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
          className='text-primary underline-offset-4 hover:underline'
        >
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </form>
  )
}
