"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

const CATEGORIES = [
  { value: "bug", labelKey: "feedback.bugReport" },
  { value: "feature", labelKey: "feedback.featureRequest" },
  { value: "improvement", labelKey: "feedback.improvement" },
  { value: "other", labelKey: "feedback.other" },
];

interface FeedbackPageClientProps {
  isLoggedIn: boolean;
  userEmail: string | null;
}

/**
 * Client-side feedback form. Adapts to auth state:
 * - Logged in: sends auth token, no email field
 * - Anonymous: shows optional email field, no auth token
 */
export default function FeedbackPageClient({
  isLoggedIn,
}: FeedbackPageClientProps) {
  const supabase = createClient();
  const { t } = useTranslation();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [category, setCategory] = useState("feature");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Attach auth token if logged in
      if (isLoggedIn) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          category,
          message,
          ...(!isLoggedIn && email ? { email } : {}),
          ...(honeypot ? { website: honeypot } : {}),
        }),
      });

      if (res.ok) {
        setSent(true);
        setMessage("");
        setEmail("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send feedback");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <nav className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-semibold text-sm text-foreground"
        >
          <Image src="/cat-icon.png" alt="Gato" width={24} height={24} />
          Gato
        </Link>
        <div>
          {isLoggedIn ? (
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/sign-in">
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="font-display text-4xl">{t("feedback.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("feedback.subtitle")}
          </p>
        </div>

        {sent ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="p-3 rounded-full bg-emerald-500/10">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-medium">{t("feedback.thankYou")}</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {t("feedback.thankYouDesc")}
              </p>
              <Button variant="outline" onClick={() => setSent(false)}>
                {t("feedback.sendMore")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                <div>
                  <CardTitle>{t("feedback.sendFeedback")}</CardTitle>
                  <CardDescription>
                    {t("feedback.sendFeedbackDesc")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot — invisible to humans, bots fill it */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    opacity: 0,
                    height: 0,
                    overflow: "hidden",
                  }}
                >
                  <label htmlFor="website">Website</label>
                  <input
                    type="text"
                    id="website"
                    name="website"
                    autoComplete="off"
                    tabIndex={-1}
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">{t("feedback.category")}</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {t(cat.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Email field — only shown for anonymous users */}
                {!isLoggedIn && (
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="message">{t("feedback.message")}</Label>
                  <Textarea
                    id="message"
                    placeholder="Describe what you'd like to share..."
                    className="min-h-[150px]"
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <div className="flex justify-end">
                  <Button type="submit" disabled={sending || !message.trim()}>
                    {sending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {sending ? t("feedback.sending") : t("feedback.submit")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
