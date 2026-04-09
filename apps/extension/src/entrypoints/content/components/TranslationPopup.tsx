import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Languages,
  Volume2,
  Info,
  GripVertical,
  AlertCircle,
  Plus,
  Check,
  ChevronDown,
  AlignLeft,
  BarChart2,
} from 'lucide-react'
import { languageToBCP47 } from '@/utils/languageCodes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type {
  TranslationResponse,
  EnrichmentResponse,
} from '@/types/translation'

interface TranslationPopupProps {
  selection: string
  selectionRect: DOMRect
  contextBefore: string
  contextAfter: string
  onClose: () => void
}

type AuthStatus = 'loading' | 'logged_in' | 'logged_out'

export default function TranslationPopup({
  selection,
  selectionRect,
  contextBefore,
  contextAfter,
  onClose,
}: TranslationPopupProps) {
  const { t } = useTranslation()
  const [translation, setTranslation] = useState<TranslationResponse>({
    language: '',
    contextualTranslation: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [enrichment, setEnrichment] = useState<EnrichmentResponse | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const [targetLanguage, setTargetLanguage] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState('')

  const [status, setStatus] = useState<AuthStatus>('loading')
  const [saveState, setSaveState] = useState<
    'idle' | 'saved' | 'alreadySaved' | 'error'
  >('idle')
  const [fromCache, setFromCache] = useState(false)
  const [cachedConceptId, setCachedConceptId] = useState<number | null>(null)
  const [retranslated, setRetranslated] = useState(false)
  const [translationError, setTranslationError] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [personalContext, setPersonalContext] = useState('')
  const langDropdownRef = useRef<HTMLDivElement>(null)

  const TARGET_LANGUAGES = [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Chinese',
    'Japanese',
    'Korean',
    'Russian',
    'Arabic',
    'Hindi',
    'Dutch',
    'Swedish',
    'Turkish',
  ] as const

  function handleSpeak() {
    if (isSpeaking) return
    const utterance = new SpeechSynthesisUtterance(selection)
    const langCode = languageToBCP47[translation.language]
    if (langCode) {
      utterance.lang = langCode
    }
    setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    speechSynthesis.speak(utterance)
    setTimeout(() => setIsSpeaking(false), 500)
  }

  // Close language dropdown on click outside
  useEffect(() => {
    if (!showLangDropdown) return
    function handleClickOutside(e: MouseEvent) {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(e.target as Node)
      ) {
        setShowLangDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showLangDropdown])

  const handleLanguageSwitch = useCallback(
    (newLang: string) => {
      setShowLangDropdown(false)
      if (newLang === targetLanguage) return

      // Update storage
      chrome.storage.sync.set({ targetLanguage: newLang })
      setTargetLanguage(newLang)

      // Re-translate with the new language
      setIsLoading(true)
      setFromCache(false)
      setRetranslated(false)
      setSaveState('idle')
      setEnrichment(null)
      setShowMore(false)
      chrome.runtime.sendMessage(
        {
          action: 'translate',
          text: `${contextBefore} [${selection}] ${contextAfter}`,
          selection,
          contextBefore,
          contextAfter,
          concept: selection,
          forceRefresh: true,
        },
        (response: {
          success: boolean
          translateObject: TranslationResponse
          error?: string
        }): void => {
          if (response?.success) {
            setTranslation(response.translateObject)
            setRetranslated(true)
          } else {
            setTranslationError(true)
          }
          setIsLoading(false)
        },
      )
    },
    [targetLanguage, contextBefore, contextAfter, selection],
  )

  useEffect(() => {
    // Send a message to the Service Worker to check the status
    chrome.runtime.sendMessage(
      { type: 'CHECK_LOGIN_STATUS' },
      (response: { isLoggedIn: boolean }) => {
        if (response && response.isLoggedIn) {
          setStatus('logged_in')
        } else {
          setStatus('logged_out')
        }
      },
    )
  }, [])

  useEffect(() => {
    chrome.storage.sync.get(
      ['targetLanguage', 'sourceLanguage', 'personalContext'],
      (result) => {
        setTargetLanguage((result.targetLanguage as string) || 'English')
        setSourceLanguage((result.sourceLanguage as string) || 'auto')
        if (result.personalContext)
          setPersonalContext(result.personalContext as string)
      },
    )
  }, [])

  useEffect(() => {
    chrome.runtime.sendMessage(
      {
        action: 'translate',
        text: `${contextBefore} [${selection}] ${contextAfter}`,
        selection,
        contextBefore,
        contextAfter,
        concept: selection,
      },
      (response: {
        success: boolean
        translateObject: TranslationResponse
        fromCache?: boolean
        cachedConceptId?: number
        error?: string
      }): void => {
        if (response?.success) {
          setTranslation(response.translateObject)
          if (response.fromCache) {
            setFromCache(true)
            setSaveState('alreadySaved')
            setCachedConceptId(response.cachedConceptId ?? null)
          } else {
            setFromCache(false)
            setCachedConceptId(null)
          }
        } else {
          setTranslationError(true)
        }
        setIsLoading(false)
      },
    )
  }, [selection, contextBefore, contextAfter])

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  function handleSaveConcept() {
    chrome.runtime.sendMessage(
      {
        action: 'saveConcept',
        concept: {
          targetLanguage,
          sourceLanguage,
          concept: selection,
          translation: translation.contextualTranslation,
          contextBefore,
          contextAfter,
          sourceUrl: window.location.href,
        },
      },
      (response) => {
        if (response?.alreadySaved) {
          setSaveState('alreadySaved')
        } else if (response?.success) {
          setSaveState('saved')
        } else {
          setSaveState('error')
          setTimeout(() => setSaveState('idle'), 3000)
        }
      },
    )
  }

  function handleRetranslate() {
    setIsLoading(true)
    setFromCache(false)
    setEnrichment(null)
    setShowMore(false)
    chrome.runtime.sendMessage(
      {
        action: 'translate',
        text: `${contextBefore} [${selection}] ${contextAfter}`,
        selection,
        contextBefore,
        contextAfter,
        concept: selection,
        forceRefresh: true,
      },
      (response: {
        success: boolean
        translateObject: TranslationResponse
        error?: string
      }): void => {
        if (response?.success) {
          setTranslation(response.translateObject)
          setRetranslated(true)
        }
        setIsLoading(false)
      },
    )
  }

  function handleUpdateTranslation() {
    if (cachedConceptId === null) return
    chrome.runtime.sendMessage(
      {
        action: 'updateConcept',
        conceptId: cachedConceptId,
        translation: translation.contextualTranslation,
      },
      (response) => {
        setSaveState(response?.success ? 'saved' : 'idle')
      },
    )
  }

  function handleAddSeparate() {
    chrome.runtime.sendMessage(
      {
        action: 'saveConcept',
        concept: {
          targetLanguage,
          sourceLanguage,
          concept: selection,
          translation: translation.contextualTranslation,
          contextBefore,
          contextAfter,
          sourceUrl: window.location.href,
        },
      },
      (response) => {
        if (response?.alreadySaved) {
          setSaveState('alreadySaved')
        } else if (response?.success) {
          setSaveState('saved')
        } else {
          setSaveState('error')
          setTimeout(() => setSaveState('idle'), 3000)
        }
      },
    )
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      }
    }

    function handleMouseUp() {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart])

  function InfoItem({
    label,
    value,
    icon,
  }: {
    label: string
    value?: string
    icon?: React.ReactNode
  }) {
    if (!value) return null

    return (
      <div className='space-y-1.5'>
        <div className='flex items-center gap-2'>
          {icon}
          <span className='text-sm font-medium text-muted-foreground'>
            {label}
          </span>
        </div>
        <p className='text-sm leading-relaxed pl-6'>{value}</p>
      </div>
    )
  }

  return (
    <div
      className='fixed z-999999'
      style={{
        left: `${selectionRect.left}px`,
        top: `${selectionRect.bottom + 16}px`,
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <Card className='w-[500px] shadow-2xl border-2 relative'>
        {translationError && (
          <div className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-background/97 p-8 text-center backdrop-blur-sm'>
            <Button
              variant='ghost'
              size='icon'
              onClick={onClose}
              className='absolute top-3 right-3 h-8 w-8'
            >
              <X className='h-4 w-4' />
            </Button>
            <AlertCircle className='h-10 w-10 text-muted-foreground' />
            <div className='space-y-2'>
              <h3 className='text-base font-semibold'>
                {t('ext.popup.translationUnavailable')}
              </h3>
              <p className='text-sm text-muted-foreground leading-relaxed'>
                {t('ext.popup.usageLimitDesc')}
              </p>
            </div>
            <p className='text-xs text-muted-foreground'>
              {t('ext.popup.dashboardHint')}
            </p>
          </div>
        )}
        <CardHeader>
          <div
            className='flex items-center justify-between cursor-grab active:cursor-grabbing'
            onMouseDown={handleMouseDown}
          >
            <div className='flex items-center gap-2'>
              <Languages className='h-5 w-5 text-primary' />
              <CardTitle className='text-lg'>{t('ext.popup.title')}</CardTitle>
            </div>
            <Button
              variant='ghost'
              size='icon'
              onClick={onClose}
              className='h-8 w-8'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        </CardHeader>

        <CardContent className='space-y-3 max-h-[50vh] overflow-y-auto'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                {t('ext.popup.selectedText')}
              </span>
              <div className='flex items-center gap-1'>
                {(contextBefore || contextAfter) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        className={`h-6 w-6 ${showContext ? 'text-foreground' : 'text-muted-foreground'}`}
                        onClick={() => setShowContext((v) => !v)}
                      >
                        <AlignLeft className='h-3.5 w-3.5' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className='z-[9999999]'>
                      {t('ext.popup.showContext')}
                    </TooltipContent>
                  </Tooltip>
                )}
                {status === 'logged_in' &&
                  (saveState === 'saved' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className='h-6 w-6 flex items-center justify-center text-green-600 cursor-default'>
                          <Check className='h-3.5 w-3.5' />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className='z-[9999999] max-w-[180px] text-center'>
                        {t('ext.popup.savedTooltip')}
                      </TooltipContent>
                    </Tooltip>
                  ) : saveState === 'alreadySaved' && !retranslated ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className='h-6 w-6 flex items-center justify-center text-muted-foreground/50 cursor-default'>
                          <Check className='h-3.5 w-3.5' />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className='z-[9999999] max-w-[180px] text-center'>
                        {t('ext.popup.alreadySaved')}
                      </TooltipContent>
                    </Tooltip>
                  ) : saveState === 'error' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className='h-6 w-6 flex items-center justify-center text-destructive cursor-default'>
                          <AlertCircle className='h-3.5 w-3.5' />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className='z-[9999999] max-w-[180px] text-center'>
                        {t('ext.popup.saveFailed')}
                      </TooltipContent>
                    </Tooltip>
                  ) : saveState === 'idle' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6 text-muted-foreground hover:text-foreground'
                          onClick={handleSaveConcept}
                        >
                          <Plus className='h-3.5 w-3.5' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className='z-[9999999]'>
                        {t('ext.popup.saveConcept')}
                      </TooltipContent>
                    </Tooltip>
                  ) : null)}
              </div>
            </div>
            <div className='rounded-lg bg-muted/50 p-3'>
              <p className='font-medium text-base'>{selection}</p>
            </div>
            {status === 'logged_in' &&
              retranslated &&
              saveState === 'alreadySaved' && (
                <div className='flex gap-1.5'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleUpdateTranslation}
                    className='flex-1 h-7 text-xs'
                  >
                    {t('ext.popup.updateTranslation')}
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={handleAddSeparate}
                    className='flex-1 h-7 text-xs'
                  >
                    {t('ext.popup.addNew')}
                  </Button>
                </div>
              )}
          </div>

          {showContext && (contextBefore || contextAfter) && (
            <div className='space-y-2'>
              <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                {t('ext.popup.surroundingContext')}
              </span>
              <div className='rounded-lg bg-accent/30 p-3 text-sm leading-relaxed'>
                <span className='text-muted-foreground'>{contextBefore}</span>{' '}
                <span className='font-semibold text-foreground'>
                  {selection}
                </span>{' '}
                <span className='text-muted-foreground'>{contextAfter}</span>
              </div>
            </div>
          )}

          <Separator />

          <div className='space-y-3'>
            {isLoading ? (
              <div className='space-y-3'>
                <Skeleton className='h-4 w-full' />
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-4 w-5/6' />
              </div>
            ) : (
              <>
                <div className='space-y-1.5'>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                      {t('ext.popup.translation')}
                    </span>
                    {targetLanguage && (
                      <div className='relative' ref={langDropdownRef}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant='outline'
                              className='text-xs cursor-pointer hover:bg-secondary flex items-center gap-0.5'
                              onClick={() => setShowLangDropdown((v) => !v)}
                            >
                              {translation.language &&
                              translation.language !== targetLanguage
                                ? `${translation.language} → ${targetLanguage}`
                                : targetLanguage}
                              <ChevronDown
                                className={`size-3 ml-1 transition-transform ${showLangDropdown ? 'rotate-180' : ''}`}
                              />
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className='z-[9999999]'>
                            {t('ext.popup.changeLanguage')}
                          </TooltipContent>
                        </Tooltip>
                        {showLangDropdown && (
                          <div className='absolute top-full right-0 mt-1 bg-popover border rounded-lg shadow-lg z-10 py-1 max-h-60 overflow-y-auto w-40'>
                            {TARGET_LANGUAGES.map((lang) => (
                              <div
                                key={lang}
                                className={`px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between ${
                                  lang === targetLanguage
                                    ? 'bg-secondary font-medium'
                                    : 'hover:bg-secondary'
                                }`}
                                onClick={() => handleLanguageSwitch(lang)}
                              >
                                {lang}
                                {lang === targetLanguage && (
                                  <Check className='h-3 w-3 text-primary' />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className='rounded-lg bg-primary/5 p-3 border border-primary/20'>
                    <p className='text-base font-medium leading-relaxed'>
                      {translation.contextualTranslation}
                    </p>
                  </div>
                  {fromCache && (
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={handleRetranslate}
                      className='w-full'
                    >
                      {t('ext.popup.retranslate')}
                    </Button>
                  )}
                </div>

                {/* On-demand enrichment section */}
                {(() => {
                  // Use LLM inline data if already present (fallback path), otherwise use enrichment state
                  const data =
                    translation.provider === 'llm' &&
                    translation.phoneticApproximation
                      ? translation
                      : enrichment

                  if (!showMore) {
                    return (
                      <div className='space-y-3'>
                        <div
                          onClick={() => {
                            setShowMore(true)
                            if (
                              !enrichment &&
                              !isEnriching &&
                              translation.provider !== 'llm'
                            ) {
                              setIsEnriching(true)
                              chrome.runtime.sendMessage(
                                {
                                  action: 'enrich',
                                  text: selection,
                                  translation:
                                    translation.contextualTranslation,
                                  targetLanguage,
                                  sourceLanguage:
                                    translation.language ||
                                    sourceLanguage ||
                                    '',
                                  contextBefore,
                                  contextAfter,
                                  personalContext,
                                },
                                (response: {
                                  success: boolean
                                  enrichment?: EnrichmentResponse
                                }) => {
                                  if (chrome.runtime.lastError) {
                                    setIsEnriching(false)
                                    return
                                  }
                                  setIsEnriching(false)
                                  if (
                                    response?.success &&
                                    response.enrichment
                                  ) {
                                    setEnrichment(response.enrichment)
                                  }
                                },
                              )
                            }
                          }}
                          className='flex items-center gap-2 cursor-pointer group'
                        >
                          <div className='flex-1 h-px bg-border' />
                          <ChevronDown className='h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:text-foreground' />
                          <div className='flex-1 h-px bg-border' />
                        </div>
                      </div>
                    )
                  }

                  if (showMore && isEnriching) {
                    return (
                      <div className='space-y-3'>
                        <div
                          onClick={() => setShowMore(false)}
                          className='flex items-center gap-2 cursor-pointer group'
                        >
                          <div className='flex-1 h-px bg-border' />
                          <ChevronDown className='h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:text-foreground rotate-180' />
                          <div className='flex-1 h-px bg-border' />
                        </div>
                        <div className='space-y-3'>
                          <Skeleton className='h-4 w-full' />
                          <Skeleton className='h-4 w-3/4' />
                          <Skeleton className='h-4 w-5/6' />
                        </div>
                      </div>
                    )
                  }

                  if (showMore && data) {
                    return (
                      <div className='space-y-3'>
                        <div
                          onClick={() => setShowMore(false)}
                          className='flex items-center gap-2 cursor-pointer group'
                        >
                          <div className='flex-1 h-px bg-border' />
                          <ChevronDown className='h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:text-foreground rotate-180' />
                          <div className='flex-1 h-px bg-border' />
                        </div>

                        {data.phoneticApproximation && (
                          <div className='space-y-1.5'>
                            <div className='flex items-center gap-2'>
                              <button
                                onClick={handleSpeak}
                                className={`transition-colors ${isSpeaking ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                              >
                                <Volume2 className='h-4 w-4' />
                              </button>
                              <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                                {t('ext.popup.pronunciation')}
                              </span>
                            </div>
                            <p className='text-sm text-muted-foreground italic pl-6'>
                              {data.phoneticApproximation}
                            </p>
                          </div>
                        )}

                        {data.fixedExpression &&
                          data.fixedExpression !== 'no' && (
                            <InfoItem
                              label={t('ext.popup.expression')}
                              value={data.fixedExpression}
                              icon={<Info className='h-4 w-4 text-blue-500' />}
                            />
                          )}

                        {data.commonUsage && data.commonUsage !== 'no' && (
                          <InfoItem
                            label={t('ext.popup.usageNote')}
                            value={data.commonUsage}
                            icon={<Info className='h-4 w-4 text-amber-500' />}
                          />
                        )}

                        {data.grammarRules && (
                          <InfoItem
                            label={t('ext.popup.grammar')}
                            value={data.grammarRules}
                            icon={<Info className='h-4 w-4 text-green-500' />}
                          />
                        )}

                        {(() => {
                          try {
                            const raw = data.relatedWords
                            if (!raw) return null
                            const words: Array<{
                              word: string
                              translation: string
                              relation: string
                            }> = typeof raw === 'string' ? JSON.parse(raw) : raw
                            if (!Array.isArray(words) || words.length === 0)
                              return null
                            return (
                              <div className='space-y-1.5'>
                                <div className='flex items-center gap-2'>
                                  <Info className='h-4 w-4 text-purple-500' />
                                  <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                                    {t('ext.popup.related')}
                                  </span>
                                </div>
                                <p className='text-sm leading-relaxed pl-6'>
                                  {words.map((rw, i) => (
                                    <span key={i}>
                                      {i > 0 && ', '}
                                      {rw.word} ({rw.translation})
                                    </span>
                                  ))}
                                </p>
                              </div>
                            )
                          } catch {
                            return null
                          }
                        })()}

                        {data.commonness && (
                          <div className='space-y-1.5'>
                            <div className='flex items-center gap-2'>
                              <BarChart2 className='h-4 w-4 text-muted-foreground' />
                              <span className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                                {t('ext.popup.frequency')}
                              </span>
                            </div>
                            <Badge
                              variant='outline'
                              className='text-xs max-w-full ml-5'
                            >
                              {data.commonness}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )
                  }

                  // showMore but no data and not enriching (enrichment failed or not available)
                  if (showMore) {
                    return (
                      <div className='space-y-3'>
                        <div
                          onClick={() => setShowMore(false)}
                          className='flex items-center gap-2 cursor-pointer group'
                        >
                          <div className='flex-1 h-px bg-border' />
                          <ChevronDown className='h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:text-foreground rotate-180' />
                          <div className='flex-1 h-px bg-border' />
                        </div>
                      </div>
                    )
                  }

                  return null
                })()}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
