'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient } from '@/lib/supabase/client'
import { authVariablesLight, authVariablesDark } from '@/lib/auth-theme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Languages } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
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
      <Link href="/" className="mb-8 flex items-center gap-2 font-bold text-2xl">
        <Languages className="size-8 text-primary" />
        <span className="text-foreground">Context Translator</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Create Account</CardTitle>
          <p className="text-muted-foreground text-sm">Start building your vocabulary</p>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            view="sign_up"
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
