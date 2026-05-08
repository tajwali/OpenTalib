'use client'
// components/dashboard/ReviewQueue.tsx
// Daily spaced repetition review queue for student dashboard.

import { useState, useEffect } from 'react'

interface ConceptMastery {
  concept_key: string
  ease_factor: number
  interval_days: number
  repetitions: number
  next_review_date: string
  subject: string | null
}

export function ReviewQueue({ onComplete }: { onComplete?: () => void }) {
  const [queue, setQueue] = useState<ConceptMastery[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [question, setQuestion] = useState('')
  const [answered, setAnswered] = useState(false)
  const [startTime, setStartTime] = useState(Date.now())

  useEffect(() => {
    fetch('/api/spaced-repetition/queue')
      .then(r => r.json())
      .then(d => { setQueue(d.queue ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (queue.length > 0 && currentIndex < queue.length) {
      generateQuestion(queue[currentIndex].concept_key)
      setStartTime(Date.now())
    }
  }, [currentIndex, queue])

  async function generateQuestion(conceptKey: string) {
    setGenerating(true)
    setQuestion('')
    try {
      const res = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: '',
          sceneTitle: 'Daily Review',
          sceneText: '',
          messages: [{
            role: 'user',
            content: `One short review question about: "${conceptKey}". Just the question.`
          }],
        }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let text = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          for (const line of decoder.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue
            const d = line.slice(6).trim()
            if (d === '[DONE]' || d.startsWith(':')) continue
            try { const p = JSON.parse(d); if (p.text) text += p.text } catch {}
          }
        }
      }
      setQuestion(text.trim() || `Explain: ${conceptKey.replace(/_/g, ' ')}`)
    } catch {
      setQuestion(`Explain: ${conceptKey.replace(/_/g, ' ')}`)
    } finally {
      setGenerating(false)
    }
  }

  async function submitReview(quality: number) {
    const concept = queue[currentIndex]
    await fetch('/api/spaced-repetition/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conceptKey: concept.concept_key,
        quality,
        timeTakenSeconds: Math.round((Date.now() - startTime) / 1000),
      }),
    }).catch(() => {})
    setAnswered(true)
    setTimeout(() => {
      if (currentIndex + 1 >= queue.length) { setSessionComplete(true); onComplete?.() }
      else { setCurrentIndex(i => i + 1); setAnswered(false) }
    }, 800)
  }

  if (loading) return (
    <div className="rounded-xl border p-5 text-sm text-muted-foreground">
      Loading your review queue...
    </div>
  )

  if (queue.length === 0) return (
    <div className="rounded-xl border p-5">
      <p className="text-sm font-medium text-green-700">✓ No reviews due today</p>
      <p className="text-xs text-muted-foreground mt-1">Complete lessons to build your review queue.</p>
    </div>
  )

  if (sessionComplete) return (
    <div className="rounded-xl border p-5">
      <p className="text-sm font-medium text-green-700">
        ✓ Review complete — {queue.length} concept{queue.length !== 1 ? 's' : ''} reviewed
      </p>
      <p className="text-xs text-muted-foreground mt-1">Next review scheduled automatically.</p>
    </div>
  )

  const current = queue[currentIndex]
  const masteryPct = Math.round(((current.ease_factor - 1.3) / 2.7) * 100)

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Daily Review — {currentIndex + 1} of {queue.length}</h3>
        <span className="text-xs text-muted-foreground">~5 min</span>
      </div>

      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${(currentIndex / queue.length) * 100}%` }} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs bg-muted px-2 py-1 rounded font-mono">
          {current.concept_key.replace(/_/g, ' ')}
        </span>
        {current.subject && <span className="text-xs text-muted-foreground">{current.subject}</span>}
        <span className="text-xs text-muted-foreground ml-auto">Mastery: {masteryPct}%</span>
      </div>

      <div className="rounded-lg bg-muted/40 p-4 min-h-[80px] text-sm">
        {generating
          ? <span className="text-muted-foreground animate-pulse">Preparing question...</span>
          : question
        }
      </div>

      {!answered && !generating && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">How well did you know this?</p>
          <div className="grid grid-cols-3 gap-2">
            {[['Forgot it', 1, 'red'], ['Almost', 3, 'yellow'], ['Got it!', 5, 'green']].map(([label, q, color]) => (
              <button
                key={String(q)}
                onClick={() => submitReview(q as number)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-${color}-50 hover:border-${color}-200 hover:text-${color}-700`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {answered && <p className="text-xs text-muted-foreground text-center animate-pulse">Saving...</p>}
    </div>
  )
}
