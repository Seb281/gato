"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

export default function FeedbackPage() {
  const supabase = createClient();
  const { t } = useTranslation();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const [category, setCategory] = useState("feature");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ category, message }),
      });

      if (res.ok) {
        setSent(true);
        setMessage("");
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

  if (sent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("feedback.title")}</h1>
          <p className="text-muted-foreground">{t("feedback.subtitle")}</p>
        </div>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("feedback.title")}</h1>
        <p className="text-muted-foreground">{t("feedback.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-muted-foreground" />
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

            <div className="space-y-2">
              <Label htmlFor="message">{t("feedback.message")}</Label>
              <Textarea
                id="message"
                placeholder="Describe what you'd like to share..."
                className="min-h-[150px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={sending || !message.trim()}>
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {sending ? t("feedback.sending") : t("feedback.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
