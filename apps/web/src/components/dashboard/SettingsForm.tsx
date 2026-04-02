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
import { Loader2, Key, ShieldCheck, AlertCircle, Monitor, Sun, Moon, Globe, Plus, X, WifiOff, Target, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "@/lib/i18n/useTranslation";

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Russian", "Japanese", "Chinese", "Korean", "Arabic", "Hindi",
  "Dutch", "Swedish", "Norwegian", "Danish", "Finnish", "Polish",
  "Turkish", "Greek", "Hebrew", "Thai", "Vietnamese", "Indonesian",
  "Malay", "Czech", "Slovak", "Hungarian", "Romanian", "Bulgarian",
];

export default function SettingsForm() {
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const { t, refresh: refreshTranslations } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Form State
  const [firstName, setFirstName] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [personalContext, setPersonalContext] = useState("");
  const [preferredProvider, setPreferredProvider] = useState("google");
  const [customApiKey, setCustomApiKey] = useState("");
  const [dailyGoal, setDailyGoal] = useState(10);
  const [customGoalInput, setCustomGoalInput] = useState("");
  
  // Metadata State
  const [hasCustomApiKey, setHasCustomApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState("");

  // Allowed Sites State
  const [allowedSites, setAllowedSites] = useState<string[]>([]);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState("");

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
          setFirstName(data.name || "");
          setTargetLanguage(data.targetLanguage || "English");
          setPersonalContext(data.personalContext || "");
          setPreferredProvider(data.preferredProvider || "google");
          if (data.dailyGoal != null) {
            setDailyGoal(data.dailyGoal);
          }
          setHasCustomApiKey(data.hasCustomApiKey);
          if (data.maskedApiKey) {
            setMaskedApiKey(data.maskedApiKey);
          }
          // Sync theme from API (source of truth)
          if (data.theme && data.theme !== theme) {
            setTheme(data.theme);
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

  // Communicate with extension via postMessage for allowed sites
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "ALLOWED_SITES_RESPONSE") {
        setExtensionConnected(true);
        setAllowedSites(event.data.sites || []);
      }
    }

    window.addEventListener("message", handleMessage);

    // Request current sites from extension (will respond if installed)
    window.postMessage({ type: "GET_ALLOWED_SITES" }, window.location.origin);

    // If no response after 500ms, extension is not connected
    timeoutId = setTimeout(() => {
      setExtensionConnected((prev) => prev); // keep current state
    }, 500);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeoutId);
    };
  }, []);

  function handleAddSite() {
    const trimmed = newSiteUrl.trim();
    if (!trimmed) return;

    let pattern: string;
    try {
      // Accept bare domains like "example.com" or full URLs
      const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
      pattern = `${url.origin}/*`;
    } catch {
      return; // invalid URL
    }

    if (allowedSites.includes(pattern)) {
      setNewSiteUrl("");
      return;
    }

    window.postMessage({ type: "ADD_ALLOWED_SITE", pattern }, window.location.origin);
    setNewSiteUrl("");
  }

  function handleRemoveSite(pattern: string) {
    window.postMessage({ type: "REMOVE_ALLOWED_SITE", pattern }, window.location.origin);
  }

  async function handleThemeChange(newTheme: string) {
    setTheme(newTheme);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      fetch(`${API_URL}/user/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ theme: newTheme }),
      }).catch(console.error);
    } catch {}
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const token = session.access_token;

      const payload: any = {
        name: firstName.trim() || null,
        targetLanguage,
        personalContext,
        preferredProvider,
        dailyGoal,
        theme,
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
        setFirstName(data.name || "");
        setHasCustomApiKey(data.hasCustomApiKey);
        if (data.maskedApiKey) {
          setMaskedApiKey(data.maskedApiKey);
        }
        setCustomApiKey(""); // Clear input after save
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        // Refresh UI translations in case target language changed
        refreshTranslations();
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const THEME_OPTIONS = [
    { value: "system", labelKey: "settings.syncDevice", icon: Monitor },
    { value: "light", labelKey: "settings.light", icon: Sun },
    { value: "dark", labelKey: "settings.dark", icon: Moon },
  ] as const;

  const GOAL_PRESETS = [5, 10, 15, 20] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
          <CardDescription>
            {t("settings.appearanceDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mounted && (
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleThemeChange(option.value)}
                  className={`flex flex-col items-center gap-2 rounded-lg p-4 transition-colors ${
                    theme === option.value
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/50"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  <option.icon className="size-5" />
                  <span className="text-xs font-medium">{t(option.labelKey)}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    <form onSubmit={handleSave} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="size-5 text-muted-foreground" />
            <div>
              <CardTitle>{t("settings.profile")}</CardTitle>
              <CardDescription>
                {t("settings.profileDesc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="firstName">{t("settings.firstName")}</Label>
            <Input
              id="firstName"
              placeholder="Your first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="size-5 text-muted-foreground" />
            <div>
              <CardTitle>{t("settings.dailyGoal")}</CardTitle>
              <CardDescription>
                {t("settings.dailyGoalDesc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {GOAL_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setDailyGoal(value);
                  setCustomGoalInput("");
                }}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  dailyGoal === value
                    ? "bg-primary/15 text-foreground ring-1 ring-primary/50 font-medium"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="customGoal" className="text-sm text-muted-foreground whitespace-nowrap">
              {t("settings.custom")}
            </Label>
            <Input
              id="customGoal"
              type="number"
              min={1}
              max={100}
              placeholder="e.g. 25"
              value={customGoalInput}
              onChange={(e) => {
                const val = e.target.value;
                setCustomGoalInput(val);
                const num = parseInt(val, 10);
                if (num >= 1 && num <= 100) {
                  setDailyGoal(num);
                }
              }}
              className="w-24"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.translationPrefs")}</CardTitle>
          <CardDescription>
            {t("settings.translationPrefsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetLanguage">{t("settings.targetLanguage")}</Label>
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="context">{t("settings.personalContext")}</Label>
            <Textarea
              id="context"
              placeholder="I am a software engineer learning culinary terms..."
              className="min-h-[100px]"
              value={personalContext}
              onChange={(e) => setPersonalContext(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {t("settings.personalContextHint")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>{t("settings.allowedWebsites")}</CardTitle>
              <CardDescription>
                {t("settings.allowedWebsitesDesc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!extensionConnected ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
              <WifiOff className="h-4 w-4 shrink-0" />
              <p>
                {t("settings.installExtension")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  id="allowed-site"
                  name="site"
                  placeholder="example.com"
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSite();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddSite}
                  disabled={!newSiteUrl.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {allowedSites.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">
                  {t("settings.noSitesEnabled")}
                </p>
              ) : (
                <div className="max-h-[272px] overflow-y-auto rounded-lg border divide-y">
                  {allowedSites.map((site) => (
                    <div
                      key={site}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="truncate mr-2 text-foreground">
                        {site.replace("/*", "")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSite(site)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {allowedSites.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("settings.sitesEnabled", {
                    count: allowedSites.length,
                    sites: allowedSites.length === 1 ? t("common.site") : t("common.sites"),
                  })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.aiProvider")}</CardTitle>
          <CardDescription>
            {t("settings.aiProviderDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">{t("settings.aiProviderLabel")}</Label>
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
            <Label htmlFor="apiKey">{t("settings.apiKey")}</Label>
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
              <div className="flex items-center gap-2 text-sm text-emerald-500 mt-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Active Key: {maskedApiKey}</span>
              </div>
            )}
            
            <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2 bg-secondary/50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Your API key is encrypted and stored securely. We only use it to generate your translations.
                If you don't provide a key, we'll use our default system (Google Gemini 3.1 Flash Lite).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saveSuccess && (
          <span className="text-sm text-emerald-500 font-medium">{t("settings.settingsSaved")}</span>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? t("settings.saving") : t("settings.saveSettings")}
        </Button>
      </div>
    </form>
    </div>
  );
}