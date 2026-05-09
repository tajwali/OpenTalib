'use client'
// app/exam/page.tsx
// Mock exam interface — full screen, timed, board-aligned

import { useState, useEffect, useCallback } from 'react'

interface Question {
  id: string
  question_text: string
  marks: number
  question_type: string
}

interface ExamResult {
  question_text: string
  student_answer: string
  marks_available: number
  marks_awarded: number
  ai_feedback: string
}

export default function ExamPage() {
  const [step, setStep] = useState<'setup' | 'active' | 'results'>('setup')
  const [board, setBoard] = useState('FBISE')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [duration, setDuration] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [totalMarks, setTotalMarks] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [scorePercent, setScorePercent] = useState(0)
  const [scoredMarks, setScoredMarks] = useState(0)
  const [results, setResults] = useState<ExamResult[]>([])

  // Countdown timer
  useEffect(() => {
    if (step !== 'active' || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { handleSubmit(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [step, timeLeft])

  async function handleStart() {
    if (!subject.trim()) { setError('Please enter a subject'); return }
    setLoading(true)
    setError('')
    try {
      // Generate questions first
      const genRes = await fetch('/api/exam/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board, subject,
          grade: grade ? parseInt(grade) : null,
          topic: subject,
          questionType: 'short-answer',
          count: 5,
          difficulty: 3,
        }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData.error)

      const questionIds = genData.questions.map((q: any) => q.id)

      // Start session
      const sessionRes = await fetch('/api/exam/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board, subject,
          grade: grade ? parseInt(grade) : null,
          durationMinutes: duration,
          questionIds,
        }),
      })
      const sessionData = await sessionRes.json()
      if (!sessionRes.ok) throw new Error(sessionData.error)

      setSessionId(sessionData.session.id)
      setQuestions(sessionData.questions)
      setTotalMarks(sessionData.totalMarks)
      setTimeLeft(duration * 60)
      setStep('active')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/exam/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setScorePercent(data.scorePercent)
      setScoredMarks(data.scoredMarks)
      setResults(data.results)
      setStep('results')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, answers, submitting])

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const gradeColor = scorePercent >= 70 ? 'text-green-600'
    : scorePercent >= 50 ? 'text-yellow-600'
    : 'text-red-600'

  if (step === 'setup') return (
    <div className="max-w-lg mx-auto mt-12 p-6 space-y-5">
      <h1 className="text-xl font-semibold">Mock Exam</h1>
      <p className="text-sm text-muted-foreground">
        An AI examiner will generate board-aligned questions and mark your answers.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1">Exam Board</label>
          <select value={board} onChange={e => setBoard(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm">
            {['FBISE','Cambridge O-Level','Cambridge IGCSE','CBSE','ICSE','AQA','Edexcel','Punjab Board','Other']
              .map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Subject</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="e.g. Mathematics, Biology, Chemistry"
            className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Grade (optional)</label>
          <input type="number" value={grade} onChange={e => setGrade(e.target.value)}
            placeholder="e.g. 8" min={1} max={12}
            className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Duration (minutes)</label>
          <select value={duration} onChange={e => setDuration(parseInt(e.target.value))}
            className="w-full rounded-md border px-3 py-2 text-sm">
            {[30, 45, 60, 90, 120].map(d =>
              <option key={d} value={d}>{d} minutes</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button onClick={handleStart} disabled={loading}
        className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
        {loading ? 'Generating questions...' : 'Start Exam'}
      </button>
    </div>
  )

  if (step === 'active') return (
    <div className="max-w-2xl mx-auto mt-8 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{subject} — {board}</h1>
        <div className={`font-mono text-lg font-bold ${timeLeft < 300 ? 'text-red-600' : ''}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="w-full h-1.5 bg-muted rounded-full">
        <div className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${(timeLeft / (duration * 60)) * 100}%` }} />
      </div>

      <div className="space-y-6">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border p-5 space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-xs font-medium text-muted-foreground">
                Question {i + 1}
              </span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {q.marks} mark{q.marks !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm">{q.question_text}</p>
            <textarea
              value={answers[q.id] ?? ''}
              onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="Write your answer here..."
              rows={4}
              className="w-full rounded-md border px-3 py-2 text-sm resize-y"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting}
        className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
        {submitting ? 'Marking your answers...' : 'Submit Exam'}
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Exam Results</h1>
        <p className={`text-3xl font-bold ${gradeColor}`}>
          {scoredMarks}/{totalMarks} — {scorePercent}%
        </p>
        <p className="text-sm text-muted-foreground">
          {scorePercent >= 70 ? '✓ Pass' : scorePercent >= 50 ? '△ Near pass' : '✗ Below pass'}
        </p>
      </div>

      <div className="space-y-4">
        {results.map((r, i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <div className="flex justify-between">
              <span className="text-xs font-medium text-muted-foreground">Q{i + 1}</span>
              <span className={`text-xs font-medium ${
                r.marks_awarded === r.marks_available ? 'text-green-600'
                : r.marks_awarded > 0 ? 'text-yellow-600'
                : 'text-red-600'
              }`}>
                {r.marks_awarded}/{r.marks_available} marks
              </span>
            </div>
            <p className="text-sm font-medium">{r.question_text}</p>
            <div className="rounded bg-muted/40 p-3 text-xs">
              <span className="font-medium">Your answer: </span>
              {r.student_answer || '(no answer)'}
            </div>
            <p className="text-xs text-muted-foreground">{r.ai_feedback}</p>
          </div>
        ))}
      </div>

      <button onClick={() => { setStep('setup'); setAnswers({}) }}
        className="w-full rounded-md border py-2 text-sm">
        Take Another Exam
      </button>
    </div>
  )
}
