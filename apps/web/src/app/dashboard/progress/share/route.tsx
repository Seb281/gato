/**
 * Server-rendered Open Graph image for the "share my progress" flow.
 *
 * GET /dashboard/progress/share returns a 1200x630 PNG built with
 * `next/og`'s `ImageResponse`. The route is auth-gated — it reads the
 * caller's Supabase session, forwards the access token to the API to
 * pull fresh stats, and renders the card server-side.
 *
 * Why server-side instead of the existing client-canvas ShareCard?
 *   - The image gets a stable URL so the user can paste it into a PR
 *     description, a Slack DM, or anywhere that does OG unfurls.
 *   - Browsers that strip-mine `<canvas>` (WebView contexts, some ad
 *     blockers) can still download the card.
 *   - One source of truth for the layout — the OG variant is what ends
 *     up on the public internet, so it's the one to invest styling in.
 *
 * Auth model: we intentionally do NOT allow arbitrary user IDs in the
 * URL. Only the signed-in user can render their own card. If someone
 * pastes the link elsewhere, the unfurl will hit an unauth'd request
 * and return a 401 — graceful degradation.
 */

import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type OverviewStats = {
  totalConcepts: number
  currentStreak: number
  longestStreak: number
  avgAccuracy: number
  conceptsByState?: Record<string, number>
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    return new Response('API URL not configured', { status: 500 })
  }

  let stats: OverviewStats
  try {
    const res = await fetch(`${apiUrl}/stats/overview`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      return new Response('Failed to load stats', { status: 500 })
    }
    stats = (await res.json()) as OverviewStats
  } catch {
    return new Response('Failed to load stats', { status: 500 })
  }

  const totalWords = stats.totalConcepts ?? 0
  const mastered = stats.conceptsByState?.mastered ?? 0
  const accuracy = stats.avgAccuracy ?? 0
  const streak = stats.currentStreak ?? 0

  const distribution = {
    new: stats.conceptsByState?.new ?? 0,
    learning: stats.conceptsByState?.learning ?? 0,
    familiar: stats.conceptsByState?.familiar ?? 0,
    mastered,
  }

  const segments: Array<{ key: string; color: string; count: number }> = [
    { key: 'new', color: '#a3a3a3', count: distribution.new },
    { key: 'learning', color: '#60a5fa', count: distribution.learning },
    { key: 'familiar', color: '#fbbf24', count: distribution.familiar },
    { key: 'mastered', color: '#10b981', count: distribution.mastered },
  ]

  const statCards: Array<{ label: string; value: string; accent: string }> = [
    { label: 'TOTAL WORDS', value: String(totalWords), accent: '#a3a3a3' },
    { label: 'MASTERED', value: String(mastered), accent: '#10b981' },
    { label: 'ACCURACY', value: `${accuracy}%`, accent: '#6366f1' },
    { label: 'DAY STREAK', value: String(streak), accent: '#f59e0b' },
  ]

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(circle at 0% 0%, rgba(99,102,241,0.15) 0%, rgba(17,17,17,1) 60%), #111111',
          color: '#ffffff',
          padding: '72px',
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 18,
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 500,
            }}
          >
            Gato
          </span>
          <div
            style={{
              height: 1,
              background: 'rgba(255,255,255,0.08)',
              marginTop: 12,
            }}
          />
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              marginTop: 40,
              letterSpacing: '-0.02em',
            }}
          >
            My Language Progress
          </span>
        </div>

        {/* Stat cards */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 40,
          }}
        >
          {statCards.map((card) => (
            <div
              key={card.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '24px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                style={{
                  height: 3,
                  width: 32,
                  background: card.accent,
                  borderRadius: 2,
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.45)',
                  marginTop: 16,
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                }}
              >
                {card.label}
              </span>
              <span
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  marginTop: 8,
                  letterSpacing: '-0.02em',
                }}
              >
                {card.value}
              </span>
            </div>
          ))}
        </div>

        {/* Mastery distribution */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 48,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 500,
              letterSpacing: '0.05em',
            }}
          >
            MASTERY DISTRIBUTION
          </span>
          <div
            style={{
              display: 'flex',
              height: 12,
              width: '100%',
              borderRadius: 6,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.08)',
              marginTop: 12,
            }}
          >
            {totalWords > 0 &&
              segments.map((seg) =>
                seg.count > 0 ? (
                  <div
                    key={seg.key}
                    style={{
                      background: seg.color,
                      width: `${(seg.count / totalWords) * 100}%`,
                      height: '100%',
                    }}
                  />
                ) : null
              )}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 32,
              marginTop: 20,
            }}
          >
            {segments
              .filter((seg) => seg.count > 0)
              .map((seg) => (
                <div
                  key={seg.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: seg.color,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: 'rgba(255,255,255,0.6)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {seg.key} {seg.count}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 15,
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          <span>gato.vercel.app</span>
          <span>{today}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
