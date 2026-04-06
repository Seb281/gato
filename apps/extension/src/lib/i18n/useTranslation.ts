import { useState, useEffect, useCallback } from "react";
import { UI_STRINGS, STRINGS_VERSION } from "./strings";

type TranslationFn = (
  key: string,
  params?: Record<string, string | number>
) => string;

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

export function useTranslation() {
  const [strings, setStrings] = useState<Record<string, string>>(UI_STRINGS);
  const [language, setLanguage] = useState("English");
  const [isLoading, setIsLoading] = useState(false);

  const loadLanguage = useCallback(async (lang: string) => {
    setLanguage(lang);

    if (lang === "English") {
      setStrings(UI_STRINGS);
      return;
    }

    // Check chrome.storage.local cache
    const cacheKey = `i18n_${lang}_${STRINGS_VERSION}`;
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) {
      try {
        const parsed =
          typeof cached[cacheKey] === "string"
            ? JSON.parse(cached[cacheKey])
            : cached[cacheKey];
        setStrings(parsed);
        return;
      } catch {
        await chrome.storage.local.remove(cacheKey);
      }
    }

    // Fetch via background script
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "fetchTranslations",
        language: lang,
        version: STRINGS_VERSION,
      });
      if (response?.success && response.translations) {
        setStrings(response.translations);
        await chrome.storage.local.set({
          [cacheKey]: response.translations,
        });
      }
    } catch {
      // Fall back to English
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      const stored = await chrome.storage.sync.get(["displayLanguage", "targetLanguage"]);
      const lang = (stored.displayLanguage as string) || (stored.targetLanguage as string) || "English";
      await loadLanguage(lang);
    }

    load();

    // Re-load strings when displayLanguage changes
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === "sync" && changes.displayLanguage?.newValue) {
        loadLanguage(changes.displayLanguage.newValue as string);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [loadLanguage]);

  const t: TranslationFn = useCallback(
    (key, params) => {
      const template = strings[key] ?? UI_STRINGS[key] ?? key;
      return interpolate(template, params);
    },
    [strings]
  );

  return { t, isLoading, language };
}
