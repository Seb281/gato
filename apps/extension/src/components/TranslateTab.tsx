import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Volume2,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Check,
} from 'lucide-react'
import { languageToBCP47 } from '@/utils/languageCodes'
import { LANGUAGE_NAMES } from '@/entrypoints/content/helpers/detectLanguage'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { TranslationResponse, EnrichmentResponse } from '@/types/translation'
import type { Session } from '@supabase/supabase-js'

type Props = {
  session: Session | null
  onSwitchToSettings: () => void
}

export default function TranslateTab({ session, onSwitchToSettings }: Props) {
  const { t } = useTranslation()
  const [inputText, setInputText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [result, setResult] = useState<TranslationResponse | null>(null)
  const [error, setError] = useState(false)
  const [enrichment, setEnrichment] = useState<EnrichmentResponse | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [autoFillEnabled, setAutoFillEnabled] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showContextInput, setShowContextInput] = useState(false)
  const [personalContext, setPersonalContext] = useState('')
  const requestIdRef = useRef(0)

  // Load settings from storage
  useEffect(() => {
    chrome.storage.sync.get(
      ['targetLanguage', 'sidepanelAutoTranslate', 'personalContext'],
      (result) => {
        if (result.targetLanguage) setTargetLanguage(result.targetLanguage as string)
        if (result.sidepanelAutoTranslate !== undefined) {
          setAutoFillEnabled(result.sidepanelAutoTranslate as boolean)
        }
        if (result.personalContext) setPersonalContext(result.personalContext as string)
      },
    )
  }, [])

  // Listen for settings changes (e.g., language changed in Settings tab)
  useEffect(() => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'sync' && changes.targetLanguage?.newValue) {
        setTargetLanguage(changes.targetLanguage.newValue as string)
      }
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }, [])

  const doTranslate = useCallback(
    (text: string) => {
      if (!text.trim()) return

      const currentId = ++requestIdRef.current
      setIsTranslating(true)
      setError(false)
      setResult(null)
      setEnrichment(null)
      setShowMore(false)
      setSaveState('idle')

      chrome.runtime.sendMessage(
        { action: 'translate', text, concept: text },
        (response) => {
          if (currentId !== requestIdRef.current) return

          setIsTranslating(false)
          if (chrome.runtime.lastError || !response?.success || !response.translateObject) {
            setError(true)
          } else {
            setResult(response.translateObject)
          }
        },
      )
    },
    [],
  )

  const doTranslateWithContext = useCallback(
    (fullText: string, concept: string) => {
      const currentId = ++requestIdRef.current
      setIsTranslating(true)
      setError(false)
      setResult(null)
      setEnrichment(null)
      setShowMore(false)
      setSaveState('idle')

      chrome.runtime.sendMessage(
        { action: 'translate', text: fullText, concept },
        (response) => {
          if (currentId !== requestIdRef.current) return
          setIsTranslating(false)
          if (chrome.runtime.lastError || !response?.success || !response.translateObject) {
            setError(true)
          } else {
            setResult(response.translateObject)
          }
        },
      )
    },
    [],
  )

  // Listen for piped text from content script
  useEffect(() => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (
        areaName === 'session' &&
        changes.sidepanelText?.newValue &&
        autoFillEnabled
      ) {
        const fullText = changes.sidepanelText.newValue as string
        // Read the concept (just the selected text) from storage
        chrome.storage.session.get('sidepanelConcept', (result) => {
          const concept = (result.sidepanelConcept as string) || fullText
          setInputText(concept)
          // Translate with full context
          doTranslateWithContext(fullText, concept)
          chrome.storage.session.remove([
            'sidepanelText',
            'sidepanelConcept',
            'sidepanelContext',
            'sidepanelTimestamp',
          ])
        })
      }
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }, [autoFillEnabled, doTranslate])

  function handleToggleAutoFill(enabled: boolean) {
    setAutoFillEnabled(enabled)
    chrome.storage.sync.set({ sidepanelAutoTranslate: enabled })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      doTranslate(inputText)
    }
  }

  function handleSave() {
    if (!result) return
    setSaveState('saving')

    chrome.runtime.sendMessage(
      {
        action: 'saveConcept',
        concept: {
          concept: inputText,
          translation: result.contextualTranslation,
          sourceLanguage: result.language,
          targetLanguage,
        },
      },
      (response) => {
        if (response?.success) {
          setSaveState('saved')
        } else {
          setSaveState('error')
        }
      },
    )
  }

  function handleLoadEnrichment() {
    if (!result || isEnriching || enrichment) return

    // If LLM fallback already provided enrichment data, use it directly
    if (result.provider === 'llm' && result.phoneticApproximation) {
      setEnrichment({
        phoneticApproximation: result.phoneticApproximation,
        fixedExpression: result.fixedExpression,
        commonUsage: result.commonUsage,
        grammarRules: result.grammarRules,
        commonness: result.commonness,
        relatedWords: parseRelatedWords(result.relatedWords),
      })
      return
    }

    setIsEnriching(true)
    chrome.runtime.sendMessage(
      {
        action: 'enrich',
        text: inputText,
        translation: result.contextualTranslation,
        targetLanguage,
        sourceLanguage: result.language || '',
        personalContext: personalContext || '',
      },
      (response: { success: boolean; enrichment?: EnrichmentResponse }) => {
        if (chrome.runtime.lastError) {
          setIsEnriching(false)
          return
        }
        setIsEnriching(false)
        if (response?.success && response.enrichment) {
          setEnrichment(response.enrichment)
        }
      },
    )
  }

  function speakText(text: string, lang: string) {
    const utterance = new SpeechSynthesisUtterance(text)
    const bcp47 = languageToBCP47[lang]
    if (bcp47) utterance.lang = bcp47
    speechSynthesis.speak(utterance)
  }

  const parsedRelated = parseRelatedWords(enrichment?.relatedWords)

  return (
    <div className="p-3 space-y-3">
      {/* Auto-fill toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t('ext.side.autoFill')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autoFillEnabled}
          onClick={() => handleToggleAutoFill(!autoFillEnabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            autoFillEnabled ? 'bg-primary' : 'bg-input'
          }`}
        >
          <span
            className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
              autoFillEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Source input */}
      <Textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('ext.side.sourceText')}
        className="min-h-[100px] resize-none text-sm"
        rows={4}
      />

      {/* Collapsible context input */}
      <div>
        <button
          type="button"
          onClick={() => setShowContextInput(!showContextInput)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showContextInput ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {t('ext.side.addContext')}
        </button>
        {showContextInput && (
          <Textarea
            value={personalContext}
            onChange={(e) => setPersonalContext(e.target.value)}
            placeholder={t('ext.side.contextPlaceholder')}
            className="mt-1 min-h-[50px] resize-none text-xs"
            rows={2}
          />
        )}
      </div>

      {/* Target language selector */}
      <div className="flex items-center gap-2">
        <select
          value={targetLanguage}
          onChange={(e) => {
            setTargetLanguage(e.target.value)
            chrome.storage.sync.set({ targetLanguage: e.target.value })
          }}
          className="h-8 rounded-md bg-secondary px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1"
        >
          {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
            <option key={code} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <Button
        onClick={() => doTranslate(inputText)}
        disabled={isTranslating || !inputText.trim()}
        className="w-full"
        size="sm"
      >
        {isTranslating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        {isTranslating
          ? t('ext.side.translating')
          : t('ext.side.translateButton')}
      </Button>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive text-center">
          {t('ext.side.translationError')}
        </p>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
            <p className="text-sm font-medium">{result.contextualTranslation}</p>
          </div>

          {result.language && (
            <p className="text-[10px] text-muted-foreground">
              {t('ext.side.detectedLanguage', { language: result.language })}
            </p>
          )}

          {/* Speak button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => speakText(result.contextualTranslation, targetLanguage)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* More details - on demand */}
          <div>
            <button
              onClick={() => {
                const next = !showMore
                setShowMore(next)
                if (next) handleLoadEnrichment()
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showMore ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {t('ext.popup.context')}
            </button>

            {showMore && (
              <div className="mt-2 space-y-2">
                {isEnriching && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{t('ext.side.translating')}</span>
                  </div>
                )}

                {enrichment && (
                  <>
                    {enrichment.phoneticApproximation && (
                      <DetailItem label={t('ext.popup.pronunciation')} value={enrichment.phoneticApproximation} />
                    )}
                    {enrichment.fixedExpression && enrichment.fixedExpression !== 'no' && (
                      <DetailItem label={t('ext.popup.expression')} value={enrichment.fixedExpression} />
                    )}
                    {enrichment.commonUsage && enrichment.commonUsage !== 'no' && (
                      <DetailItem label={t('ext.popup.usageNote')} value={enrichment.commonUsage} />
                    )}
                    {enrichment.grammarRules && (
                      <DetailItem label={t('ext.popup.grammar')} value={enrichment.grammarRules} />
                    )}
                    {enrichment.commonness && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                          {t('ext.popup.frequency')}
                        </p>
                        <Badge variant="secondary" className="text-[10px]">
                          {enrichment.commonness}
                        </Badge>
                      </div>
                    )}
                    {parsedRelated.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                          {t('ext.popup.related')}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {parsedRelated.map((r, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              {r.word} — {r.translation}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Save button */}
          {session && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSave}
              disabled={saveState === 'saving' || saveState === 'saved'}
            >
              {saveState === 'saved' ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {t('ext.side.conceptSaved')}
                </>
              ) : saveState === 'error' ? (
                t('ext.side.saveFailed')
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5 mr-1" />
                  {t('ext.side.saveConceptButton')}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className="text-xs">{value}</p>
    </div>
  )
}

function parseRelatedWords(
  raw?: string | Array<{ word: string; translation: string; relation: string }>,
): Array<{ word: string; translation: string; relation: string }> {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
