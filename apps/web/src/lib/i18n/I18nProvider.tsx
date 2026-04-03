"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { UI_STRINGS, STRINGS_VERSION } from "./strings";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const API_URL = process.env.NEXT_PUBLIC_API_URL;

type TranslationFn = (
  key: string,
  params?: Record<string, string | number>
) => string;

export type I18nContextValue = {
  t: TranslationFn;
  isLoading: boolean;
  language: string;
  refresh: () => Promise<void>;
};

export const I18nContext = createContext<I18nContextValue>({
  t: (key) => UI_STRINGS[key] ?? key,
  isLoading: false,
  language: "English",
  refresh: async () => {},
});

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [strings, setStrings] = useState<Record<string, string>>(UI_STRINGS);
  const [language, setLanguage] = useState("English");
  const [isLoading, setIsLoading] = useState(false);

  const loadTranslations = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    let targetLang = "English";
    try {
      const res = await fetch(`${API_URL}/user/settings`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        targetLang = data.displayLanguage || "English";
      }
    } catch {
      return;
    }

    setLanguage(targetLang);

    if (targetLang === "English") {
      setStrings(UI_STRINGS);
      return;
    }

    const cacheKey = `i18n_${targetLang}_${STRINGS_VERSION}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setStrings(JSON.parse(cached));
        return;
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/i18n/translations?language=${encodeURIComponent(targetLang)}&version=${STRINGS_VERSION}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.translations) {
          setStrings(data.translations);
          localStorage.setItem(cacheKey, JSON.stringify(data.translations));
        }
      }
    } catch {
      // Fall back to English on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  const refresh = useCallback(async () => {
    // Clear cached translations so we fetch fresh for potentially new language
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("i18n_")) {
        localStorage.removeItem(key);
      }
    }
    await loadTranslations();
  }, [loadTranslations]);

  const t: TranslationFn = useCallback(
    (key, params) => {
      const template = strings[key] ?? UI_STRINGS[key] ?? key;
      return interpolate(template, params);
    },
    [strings]
  );

  return (
    <I18nContext.Provider value={{ t, isLoading, language, refresh }}>
      {children}
    </I18nContext.Provider>
  );
}
