import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'

type QuizItem = {
  conceptId: number
  concept: string
  phonetic?: string
  translation: string
}

type Props = {
  onBack: () => void
}

export default function QuickReview({ onBack }: Props) {
  const [items, setItems] = useState<QuizItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<number[]>([])

  useEffect(() => {
    chrome.runtime.sendMessage(
      { action: 'getQuizItems', count: 5 },
      (response) => {
        setItems(response?.items ?? [])
        setLoading(false)
      }
    )
  }, [])

  const handleRate = (quality: number) => {
    const item = items[currentIndex]
    chrome.runtime.sendMessage({
      action: 'submitReview',
      conceptId: item.conceptId,
      quality,
    })

    setResults((prev) => [...prev, quality])
    setRevealed(false)

    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const isFinished = results.length === items.length && items.length > 0
  const correctCount = results.filter((q) => q >= 4).length
  const accuracy = items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0

  if (loading) {
    return (
      <div className="w-[420px]">
        <div className="bg-card text-card-foreground">
          <div className="flex items-center gap-2 p-6 pb-4">
            <button
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-lg">Review</span>
          </div>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="w-[420px]">
        <div className="bg-card text-card-foreground">
          <div className="flex items-center gap-2 p-6 pb-4">
            <button
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-lg">Review</span>
          </div>
          <div className="px-6 pb-6 text-center">
            <p className="text-sm text-muted-foreground">
              No items to review right now.
            </p>
            <Button variant="outline" className="mt-4" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isFinished) {
    return (
      <div className="w-[420px]">
        <div className="bg-card text-card-foreground">
          <div className="flex items-center gap-2 p-6 pb-4">
            <button
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-semibold text-lg">Review Complete</span>
          </div>
          <div className="px-6 pb-6">
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 text-center space-y-2">
              <p className="text-2xl font-bold">
                {correctCount}/{items.length} correct
              </p>
              <p className="text-sm text-muted-foreground">
                {accuracy}% accuracy
              </p>
            </div>
            <Button className="w-full mt-4" onClick={onBack}>
              Done
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const item = items[currentIndex]

  return (
    <div className="w-[420px]">
      <div className="bg-card text-card-foreground">
        <div className="flex items-center gap-2 p-6 pb-4">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-semibold text-lg">
            Review ({currentIndex + 1}/{items.length})
          </span>
        </div>
        <div className="px-6 pb-6">
          <div className="py-6 text-center">
            <p className="text-xl font-bold">{item.concept}</p>
            {item.phonetic && (
              <p className="text-sm italic text-muted-foreground mt-1">
                {item.phonetic}
              </p>
            )}
          </div>

          {!revealed ? (
            <Button
              className="w-full"
              variant="default"
              onClick={() => setRevealed(true)}
            >
              Show Answer
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                <p className="text-center font-medium">{item.translation}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRate(1)}
                >
                  Again
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleRate(4)}
                >
                  Good
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                  onClick={() => handleRate(5)}
                >
                  Easy
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
