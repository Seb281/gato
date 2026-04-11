/**
 * Hero-adjacent product demo.
 *
 * If a pre-rendered `/demo.webm` ships alongside the app, this component
 * plays it as a muted autoplay loop — that's the preferred path, since a
 * real screen capture conveys the actual UX better than any mock. If the
 * file is missing (local dev, or a deploy where the marketing team
 * hasn't dropped one in yet), we transparently fall back to a pure-CSS
 * mock of the translate-select-save flow. Either way the landing page
 * renders something non-empty, so nothing breaks before the asset exists.
 *
 * The video element uses `onError` to flip `videoOk` to false — that's
 * the only way to detect a missing public asset client-side without
 * doing a HEAD request, which would hurt TTFB.
 */

"use client";

import { useState } from "react";
import { MousePointer2 } from "lucide-react";

export default function DemoAnimation() {
  const [videoOk, setVideoOk] = useState(true);

  return (
    <section className="pt-4 pb-16 md:pb-24">
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative rounded-2xl border bg-card shadow-lg overflow-hidden aspect-video">
          {videoOk ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setVideoOk(false)}
              className="w-full h-full object-cover"
            >
              <source src="/demo.webm" type="video/webm" />
            </video>
          ) : (
            <CssFallback />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Pure-CSS mock of the translate flow. No JS animation, no layout shift —
 * just a couple of absolutely-positioned blocks and three `@keyframes`
 * that run on a 6-second loop. Locked in place so the fallback is stable
 * across screen sizes; anyone wanting a real demo should add the webm.
 */
function CssFallback() {
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-muted/40 to-muted/10">
      {/* Mock article content */}
      <div className="absolute inset-0 p-8 md:p-12 space-y-3">
        <div className="h-3 w-1/3 rounded bg-muted" />
        <div className="h-2 w-11/12 rounded bg-muted/60" />
        <div className="h-2 w-10/12 rounded bg-muted/60" />
        <div className="h-2 w-full rounded bg-muted/60 relative">
          {/* Highlighted word */}
          <span className="absolute left-[28%] top-1/2 -translate-y-1/2 h-5 w-20 rounded bg-primary/30 animate-[demoHighlight_6s_ease-in-out_infinite]" />
        </div>
        <div className="h-2 w-9/12 rounded bg-muted/60" />
      </div>

      {/* Floating translation popup */}
      <div className="absolute left-[28%] top-[60%] w-64 rounded-lg border bg-background shadow-xl p-4 opacity-0 animate-[demoPopup_6s_ease-in-out_infinite]">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          Translation
        </div>
        <div className="font-semibold">bonjour</div>
        <div className="text-xs text-muted-foreground">hello</div>
      </div>

      {/* Cursor */}
      <MousePointer2 className="absolute size-5 text-foreground drop-shadow-md animate-[demoCursor_6s_ease-in-out_infinite]" />

      <style>{`
        @keyframes demoCursor {
          0%   { left: 10%; top: 20%; }
          30%  { left: 32%; top: 48%; }
          40%  { left: 32%; top: 48%; }
          70%  { left: 40%; top: 68%; }
          100% { left: 40%; top: 68%; }
        }
        @keyframes demoHighlight {
          0%, 30%   { opacity: 0; transform: translateY(-50%) scaleX(0); }
          40%, 100% { opacity: 1; transform: translateY(-50%) scaleX(1); }
        }
        @keyframes demoPopup {
          0%, 50%   { opacity: 0; transform: translateY(8px); }
          60%, 100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
