import { useState, useEffect } from "react"
import { X, Languages, Volume2, Info, GripVertical } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface TranslationPopupProps {
  selection: string
  selectionRect: DOMRect
  contextBefore: string
  contextAfter: string
  onClose: () => void
}

interface TranslationResponse {
  language: string
  fixedExpression?: string
  contextualTranslation: string
  phoneticApproximation: string
  commonUssage?: string
  grammarRules?: string
  commonness?: string
}

type AuthStatus = "loading" | "logged_in" | "logged_out"

export default function TranslationPopup({
  selection,
  selectionRect,
  contextBefore,
  contextAfter,
  onClose,
}: TranslationPopupProps) {
  const [translation, setTranslation] = useState<TranslationResponse>({
    language: "",
    contextualTranslation: "",
    phoneticApproximation: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [showMore, setShowMore] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const [targetLanguage, setTargetLanguage] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState("")

  const [status, setStatus] = useState<AuthStatus>("loading")
  const [saveState, setSaveState] = useState<"idle" | "saved" | "alreadySaved">("idle")
  const [fromCache, setFromCache] = useState(false)
  const [cachedConceptId, setCachedConceptId] = useState<number | null>(null)
  const [retranslated, setRetranslated] = useState(false)

  useEffect(() => {
    // Send a message to the Service Worker to check the status
    chrome.runtime.sendMessage(
      { type: "CHECK_LOGIN_STATUS" },
      (response: { isLoggedIn: boolean }) => {
        // if (chrome.runtime.lastError) {
        //   // Handle cases where the extension might be reloaded or context is lost
        //   console.error(chrome.runtime.lastError.message)
        //   setStatus("logged_out")
        //   return
        // }

        if (response && response.isLoggedIn) {
          setStatus("logged_in")
        } else {
          setStatus("logged_out")
        }
      }
    )
  }, [])

  useEffect(() => {
    chrome.storage.sync.get(["targetLanguage", "sourceLanguage"], (result) => {
      setTargetLanguage((result.targetLanguage as string) || "English")
      setSourceLanguage((result.sourceLanguage as string) || "auto")
    })
  }, [])

  useEffect(() => {
    chrome.runtime.sendMessage(
      {
        action: "translate",
        text: `${contextBefore} [${selection}] ${contextAfter}`,
        concept: selection,
      },
      (response: {
        success: boolean
        translateObject: TranslationResponse
        fromCache?: boolean
        cachedConceptId?: number
        error?: string
      }): void => {
        if (response.success) {
          setTranslation(response.translateObject)
          if (response.fromCache) {
            setFromCache(true)
            setSaveState("alreadySaved")
            setCachedConceptId(response.cachedConceptId ?? null)
          } else {
            setFromCache(false)
            setCachedConceptId(null)
          }
        } else {
          throw new Error(`Error: ${response?.error || "Translation failed"}`)
        }
        setIsLoading(false)
      }
    )
  }, [selection, contextBefore, contextAfter, targetLanguage, sourceLanguage])

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
        action: "saveConcept",
        concept: {
          targetLanguage,
          sourceLanguage,
          concept: selection,
          translation: translation.contextualTranslation,
        },
      },
      (response) => {
        if (response.alreadySaved) {
          setSaveState("alreadySaved")
        } else if (response.success) {
          setSaveState("saved")
        }
      }
    )
  }

  function handleRetranslate() {
    setIsLoading(true)
    setFromCache(false)
    chrome.runtime.sendMessage(
      {
        action: "translate",
        text: `${contextBefore} [${selection}] ${contextAfter}`,
        concept: selection,
        forceRefresh: true,
      },
      (response: {
        success: boolean
        translateObject: TranslationResponse
        error?: string
      }): void => {
        if (response.success) {
          setTranslation(response.translateObject)
          setRetranslated(true)
        }
        setIsLoading(false)
      }
    )
  }

  function handleUpdateTranslation() {
    if (cachedConceptId === null) return
    chrome.runtime.sendMessage(
      { action: "updateConcept", conceptId: cachedConceptId, translation: translation.contextualTranslation },
      (response) => {
        setSaveState(response?.success ? "saved" : "idle")
      }
    )
  }

  function handleAddSeparate() {
    chrome.runtime.sendMessage(
      {
        action: "saveConcept",
        concept: { targetLanguage, sourceLanguage, concept: selection, translation: translation.contextualTranslation },
      },
      (response) => {
        if (response?.concept?.alreadySaved) {
          setSaveState("alreadySaved")
        } else if (response?.success) {
          setSaveState("saved")
        }
      }
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
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
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
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="text-sm leading-relaxed pl-6">{value}</p>
      </div>
    )
  }

  return (
    <div
      className="fixed z-999999"
      style={{
        left: `${selectionRect.left}px`,
        top: `${selectionRect.bottom + 16}px`,
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <Card className="w-[500px] shadow-2xl border-2">
        <CardHeader className="pb-3">
          <div
            className="flex items-center justify-between cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
              <Languages className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Translation</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 max-h-[50vh] overflow-y-auto">
          <div className="space-y-2">
            {status === "logged_in" && (
              saveState === "saved" ? (
                <div className="w-full mb-3 text-center text-sm text-green-600 font-medium py-1.5">
                  ✓ Saved
                </div>
              ) : retranslated && saveState === "alreadySaved" ? (
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateTranslation}
                    className="flex-1"
                  >
                    Update translation
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddSeparate}
                    className="flex-1"
                  >
                    Add separate
                  </Button>
                </div>
              ) : saveState === "alreadySaved" ? (
                <div className="w-full mb-3 text-center text-sm text-muted-foreground py-1.5">
                  Already saved
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveConcept}
                  className="w-full mb-3"
                >
                  Save concept for review
                </Button>
              )
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Selected Text
              </span>
              {!isLoading && translation.language && (
                <Badge variant="secondary" className="text-xs">
                  {translation.language}
                </Badge>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium text-base">{selection}</p>
            </div>
          </div>

          {selection.length <= 6 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Context
              </span>
              <div className="rounded-lg bg-accent/30 p-3 text-sm leading-relaxed">
                <span className="text-muted-foreground">{contextBefore}</span>{" "}
                <span className="font-semibold text-foreground">
                  {selection}
                </span>{" "}
                <span className="text-muted-foreground">{contextAfter}</span>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Translation
                    </span>
                    {fromCache && (
                      <Badge variant="secondary" className="text-xs">
                        Saved
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-lg bg-primary/5 p-4 border border-primary/20">
                    <p className="text-base font-medium leading-relaxed">
                      {translation.contextualTranslation}
                    </p>
                  </div>
                  {fromCache && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRetranslate}
                      className="w-full"
                    >
                      Re-translate
                    </Button>
                  )}
                </div>

                {translation.phoneticApproximation && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pronunciation
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground italic pl-6">
                      {translation.phoneticApproximation}
                    </p>
                  </div>
                )}

                {(translation.fixedExpression &&
                  translation.fixedExpression !== "no") ||
                (translation.commonUssage &&
                  translation.commonUssage !== "no") ||
                translation.grammarRules ||
                translation.commonness ? (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMore(!showMore)}
                      className="w-full"
                    >
                      {showMore ? "See Less" : "See More"}
                    </Button>

                    {showMore && (
                      <>
                        {translation.fixedExpression &&
                          translation.fixedExpression !== "no" && (
                            <InfoItem
                              label="Part of an Expression"
                              value={translation.fixedExpression}
                              icon={<Info className="h-4 w-4 text-blue-500" />}
                            />
                          )}

                        {translation.commonUssage &&
                          translation.commonUssage !== "no" && (
                            <InfoItem
                              label="Usage Note"
                              value={translation.commonUssage}
                              icon={<Info className="h-4 w-4 text-amber-500" />}
                            />
                          )}

                        {translation.grammarRules && (
                          <InfoItem
                            label="Grammar"
                            value={translation.grammarRules}
                            icon={<Info className="h-4 w-4 text-green-500" />}
                          />
                        )}

                        {translation.commonness && (
                          <div className="space-y-1.5 pl-6">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Frequency
                            </p>
                            <Badge
                              variant="outline"
                              className="text-xs max-w-full"
                            >
                              {translation.commonness}
                            </Badge>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
