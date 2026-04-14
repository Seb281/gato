import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Volume2,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Info,
  BarChart2,
  X,
} from 'lucide-react'
import { parseRelatedWords } from '@gato/shared'
import { languageToBCP47 } from '@/utils/languageCodes'
import { LANGUAGE_NAMES } from '@/entrypoints/content/helpers/detectLanguage'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type {
  TranslationResponse,
  EnrichmentResponse,
  SidepanelTranslationSignal,
} from '@/types/translation'
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
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [personalContext, setPersonalContext] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [contextBefore, setContextBefore] = useState('')
  const [contextAfter, setContextAfter] = useState('')
  const requestIdRef = useRef(0)

  // Load settings from storage + active tab URL
  useEffect(() => {
    chrome.storage.sync.get(['targetLanguage', 'personalContext'], (result) => {
      if (result.targetLanguage)
        setTargetLanguage(result.targetLanguage as string)
      if (result.personalContext)
        setPersonalContext(result.personalContext as string)
    })
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) setSourceUrl(tab.url)
    })
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

  // Consume translation signals forwarded from content script via background
  useEffect(() => {
    function consumeSignal(signal: SidepanelTranslationSignal) {
      requestIdRef.current++
      setInputText(signal.inputText)
      setResult(signal.result)
      setIsTranslating(false)
      setError(false)
      setEnrichment(null)
      setShowMore(false)
      setSaveState('idle')
      setSourceUrl(signal.sourceUrl)
      setContextBefore(signal.contextBefore)
      setContextAfter(signal.contextAfter)
      chrome.storage.session.remove('sidepanelTranslation')
    }

    chrome.storage.session.get('sidepanelTranslation', (data) => {
      if (data.sidepanelTranslation) {
        consumeSignal(data.sidepanelTranslation as SidepanelTranslationSignal)
      }
    })

    const handler = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'session' && changes.sidepanelTranslation?.newValue) {
        consumeSignal(
          changes.sidepanelTranslation.newValue as SidepanelTranslationSignal,
        )
      }
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
  }, [])

  const doTranslate = useCallback((text: string) => {
    if (!text.trim()) return

    const currentId = ++requestIdRef.current
    setIsTranslating(true)
    setError(false)
    setResult(null)
    setEnrichment(null)
    setShowMore(false)
    setSaveState('idle')
    setContextBefore('')
    setContextAfter('')

    chrome.runtime.sendMessage(
      { action: 'translate', selection: text },
      (response) => {
        if (currentId !== requestIdRef.current) return

        setIsTranslating(false)
        if (
          chrome.runtime.lastError ||
          !response?.success ||
          !response.translateObject
        ) {
          setError(true)
        } else {
          setResult(response.translateObject)
        }
      },
    )
  }, [])

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
          contextBefore,
          contextAfter,
          sourceUrl,
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
        contextBefore,
        contextAfter,
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
    <div className='p-3 space-y-3'>
      {/* Target language */}
      <p className='text-sm text-muted-foreground'>
        {(() => {
          const template = t('ext.side.translatingTo', { language: '__SLOT__' })
          const parts = template.split('__SLOT__')
          const selectEl = (
            <select
              key='lang-select'
              value={targetLanguage}
              onChange={(e) => {
                setTargetLanguage(e.target.value)
                chrome.storage.sync.set({ targetLanguage: e.target.value })
              }}
              className='italic font-bold text-sm text-muted-foreground bg-transparent border-none p-0 cursor-pointer focus-visible:outline-none appearance-none'
            >
              {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                <option key={code} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )
          return <>{parts[0]}{selectEl}{parts[1]}</>
        })()}
      </p>

      {/* Source input */}
      <Textarea
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value)
          setContextBefore('')
          setContextAfter('')
        }}
        onKeyDown={handleKeyDown}
        placeholder={t('ext.side.sourceText')}
        className='min-h-[100px] resize-none text-sm'
        rows={4}
      />

      {/* Context */}
      <div className='space-y-1'>
        <p className='text-sm text-muted-foreground'>
          {t('ext.side.contextLabel')}
        </p>
        {contextBefore || contextAfter ? (
          <div className='rounded-lg bg-accent/30 p-3 text-sm leading-relaxed'>
            <span className='text-muted-foreground'>{contextBefore}</span>{' '}
            <span className='font-semibold text-foreground'>{inputText}</span>{' '}
            <span className='text-muted-foreground'>{contextAfter}</span>
          </div>
        ) : (
          <Textarea
            value={personalContext}
            onChange={(e) => setPersonalContext(e.target.value)}
            placeholder={t('ext.side.contextPlaceholder')}
            className='min-h-[50px] resize-none text-sm'
            rows={2}
          />
        )}
      </div>

      {result ? (
        <div className='flex gap-2 justify-between'>
          {session && (
            <Button
              variant='ghost'
              size='sm'
              className='flex-[2] text-sm'
              onClick={handleSave}
              disabled={saveState === 'saving' || saveState === 'saved'}
            >
              {saveState === 'saved' ? (
                <>
                  <Check className='h-3.5 w-3.5 mr-1' />
                  {t('ext.side.conceptSaved')}
                </>
              ) : saveState === 'error' ? (
                t('ext.side.saveFailed')
              ) : (
                <>
                  <Plus className='h-3.5 w-3.5 mr-1' />
                  {t('ext.side.saveConceptButton')}
                </>
              )}
            </Button>
          )}
          <Button
            variant='ghost'
            size='sm'
            className={`${session ? 'flex-[1]' : 'w-full'} text-sm`}
            onClick={() => {
              setResult(null)
              setEnrichment(null)
              setShowMore(false)
              setSaveState('idle')
              setInputText('')
              setContextBefore('')
              setContextAfter('')
            }}
          >
            <X className='h-3.5 w-3.5 mr-1' />
            {t('ext.side.clearTranslation')}
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => doTranslate(inputText)}
          disabled={isTranslating || !inputText.trim()}
          className='w-full text-sm'
          size='sm'
        >
          {isTranslating && (
            <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />
          )}
          {isTranslating
            ? t('ext.side.translating')
            : t('ext.side.translateButton')}
        </Button>
      )}

      {/* Error */}
      {error && (
        <p className='text-sm text-destructive text-center'>
          {t('ext.side.translationError')}
        </p>
      )}

      {/* Result */}
      {result && (
        <div className='space-y-2'>
          <div className='bg-primary/5 p-3 rounded-lg border border-primary/20'>
            <p className='text-sm font-medium'>
              {result.contextualTranslation}
            </p>
          </div>

          {result.language && (
            <p className='text-sm text-muted-foreground'>
              {t('ext.side.detectedLanguage', { language: result.language })}
            </p>
          )}

          {/* More details - on demand */}
          <div>
            <button
              onClick={() => {
                const next = !showMore
                setShowMore(next)
                if (next) handleLoadEnrichment()
              }}
              className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              {showMore ? (
                <ChevronUp className='h-3 w-3' />
              ) : (
                <ChevronDown className='h-3 w-3' />
              )}
              {t('ext.popup.context')}
            </button>

            {showMore && (
              <div className='mt-3 space-y-4'>
                {isEnriching && (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Loader2 className='h-3 w-3 animate-spin' />
                    <span>{t('ext.side.translating')}</span>
                  </div>
                )}

                {enrichment && (
                  <>
                    {enrichment.phoneticApproximation && (
                      <DetailItem
                        label={t('ext.popup.pronunciation')}
                        value={enrichment.phoneticApproximation}
                        icon={
                          <button
                            onClick={() =>
                              speakText(inputText, result.language || '')
                            }
                            className='text-muted-foreground hover:text-foreground transition-colors'
                          >
                            <Volume2 className='h-4 w-4' />
                          </button>
                        }
                      />
                    )}
                    {enrichment.fixedExpression &&
                      enrichment.fixedExpression !== 'no' && (
                        <DetailItem
                          label={t('ext.popup.expression')}
                          value={enrichment.fixedExpression}
                          icon={<Info className='h-4 w-4 text-blue-500' />}
                        />
                      )}
                    {enrichment.commonUsage &&
                      enrichment.commonUsage !== 'no' && (
                        <DetailItem
                          label={t('ext.popup.usageNote')}
                          value={enrichment.commonUsage}
                          icon={<Info className='h-4 w-4 text-amber-500' />}
                        />
                      )}
                    {enrichment.grammarRules && (
                      <DetailItem
                        label={t('ext.popup.grammar')}
                        value={enrichment.grammarRules}
                        icon={<Info className='h-4 w-4 text-green-500' />}
                      />
                    )}
                    {parsedRelated.length > 0 && (
                      <div className='space-y-1'>
                        <div className='flex items-center gap-2'>
                          <Info className='h-4 w-4 text-purple-500' />
                          <p className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                            {t('ext.popup.related')}
                          </p>
                        </div>
                        <div className='flex flex-wrap gap-1 ml-6'>
                          {parsedRelated.map((r, i) => (
                            <Badge
                              key={i}
                              variant='outline'
                              className='text-sm font-light'
                            >
                              {r.word} — {r.translation}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {enrichment.commonness && (
                      <div className='space-y-1'>
                        <div className='flex items-center gap-2'>
                          <BarChart2 className='h-4 w-4 text-muted-foreground' />
                          <p className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                            {t('ext.popup.frequency')}
                          </p>
                        </div>
                        <Badge
                          variant='outline'
                          className='text-sm ml-6 font-light'
                        >
                          {enrichment.commonness}
                        </Badge>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailItem({
  label,
  value,
  icon,
}: {
  label: string
  value: string | Record<string, unknown>
  icon?: React.ReactNode
}) {
  /** LLM may return a structured object instead of a string — flatten it for display. */
  const display =
    typeof value === 'string'
      ? value
      : Object.entries(value)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}: ${v}`)
          .join(', ')

  return (
    <div className='space-y-1'>
      <div className='flex items-center gap-2'>
        {icon}
        <p className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
          {label}
        </p>
      </div>
      <p className={`text-sm ${icon ? 'pl-6' : ''}`}>{display}</p>
    </div>
  )
}

