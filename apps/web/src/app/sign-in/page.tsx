'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { authVariablesLight, authVariablesDark } from '@/lib/auth-theme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

export const dynamic = 'force-dynamic'

export default function SignInPage() {
  const supabase = createClient()
  const router = useRouter()
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard')
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="mb-8 flex items-center gap-3 text-2xl">
        <Image src="/cat-icon.png" alt="Gato" width={32} height={32} className="hue-rotate-[30deg] saturate-[1.1]" />
        <span className="font-display text-foreground">Gato</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Welcome Back</CardTitle>
          <p className="text-muted-foreground text-sm">Sign in to continue learning</p>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            view="sign_in"
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: authVariablesLight,
                dark: authVariablesDark,
              },
            }}
            theme={resolvedTheme === 'dark' ? 'dark' : 'default'}
            showLinks={true}
            providers={['google']}
            redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard`}
          />
        </CardContent>
      </Card>
    </div>
  )
}
