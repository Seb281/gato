"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Key, ShieldCheck, AlertCircle } from "lucide-react";

export default function SettingsForm() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [targetLanguage, setTargetLanguage] = useState("");
  const [personalContext, setPersonalContext] = useState("");
  const [preferredProvider, setPreferredProvider] = useState("google");
  const [customApiKey, setCustomApiKey] = useState("");
  
  // Metadata State
  const [hasCustomApiKey, setHasCustomApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const token = session.access_token;

        const res = await fetch(`${API_URL}/user/settings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setTargetLanguage(data.targetLanguage || "English");
          setPersonalContext(data.personalContext || "");
          setPreferredProvider(data.preferredProvider || "google");
          setHasCustomApiKey(data.hasCustomApiKey);
          if (data.maskedApiKey) {
            setMaskedApiKey(data.maskedApiKey);
          }
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [supabase, API_URL]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const token = session.access_token;

      const payload: any = {
        targetLanguage,
        personalContext,
        preferredProvider,
      };

      // Only send API key if user typed a new one
      if (customApiKey) {
        payload.customApiKey = customApiKey;
      }

      const res = await fetch(`${API_URL}/user/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setHasCustomApiKey(data.hasCustomApiKey);
        if (data.maskedApiKey) {
          setMaskedApiKey(data.maskedApiKey);
        }
        setCustomApiKey(""); // Clear input after save
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Translation Preferences</CardTitle>
          <CardDescription>
            Customize how translations are generated for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetLanguage">Target Language</Label>
            <Input
              id="targetLanguage"
              placeholder="e.g. Spanish, French, Japanese"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="context">Personal Context</Label>
            <Textarea
              id="context"
              placeholder="I am a software engineer learning culinary terms..."
              className="min-h-[100px]"
              value={personalContext}
              onChange={(e) => setPersonalContext(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              This context helps the AI understand who you are and adjust translations accordingly.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider Settings</CardTitle>
          <CardDescription>
            Bring your own API key to use premium models.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">AI Provider</Label>
            <Select
              value={preferredProvider}
              onValueChange={setPreferredProvider}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google Gemini (Default)</SelectItem>
                <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude Sonnet)</SelectItem>
                <SelectItem value="mistral">Mistral (Large)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type="password"
                placeholder={hasCustomApiKey ? "Enter new key to overwrite" : "sk-..."}
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="pr-10"
              />
              <Key className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            
            {hasCustomApiKey && (
              <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Active Key: {maskedApiKey}</span>
              </div>
            )}
            
            <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Your API key is encrypted and stored securely. We only use it to generate your translations.
                If you don't provide a key, we'll use our default system (Google Gemini 2.0 Flash).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}