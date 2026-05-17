'use client'
// components/dashboard/StudyPlanner.tsx
// Study plan registration and display for student dashboard

import { useState, useEffect } from 'react'

interface StudySession {
  day: string
  topic: string
  duration_minutes: number
  type: 'study' | 'review' | 'mock-exam'
}

interface StudyWeek {
  week: number
  focus: string
  sessions: StudySession[]
}

interface Plan {
  id: string
  plan_json: StudyWeek[]
  student_exams: {
    board: string
    subject: string
    exam_date: string
    target_grade: string | null
  }
}

export function StudyPlanner() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [board, setBoard] = useState('FBISE')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [examDate, setExamDate] = useState('')
  const [targetGrade, setTargetGrade] = useState('')

  useEffect(() => {
    fetch('/api/planner')
      .then(r => r.json())
      .then(d => { setPlans(d.plans ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleCreate() {
    if (!subject.trim() || !examDate) {
      setError('Subject and exam date are required')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, subject, grade: grade || null, examDate, targetGrade: targetGrade || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlans(prev => [data.plan, ...prev])
      setShowForm(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const typeColor = (type: string) =>
    type === 'mock-exam' ? 'bg-red-50 border-red-200 text-red-700'
    : type === 'review' ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
    : 'bg-blue-50 border-blue-200 text-blue-700'

  if (loading) return (
    <div className="rounded-xl border p-5 text-sm text-muted-foreground">
      Loading study plans...
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Study Planner</h2>
        <button
          onClick={() => setShowForm(f => !f)}
          className="text-xs rounded-md border px-3 py-1.5 hover:bg-muted transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Exam'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border p-5 space-y-3 bg-card">
          <h3 className="text-sm font-medium">Register Upcoming Exam</h3>
          <select value={board} onChange={e => setBoard(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {['FBISE','Cambridge O-Level','Cambridge IGCSE','CBSE','ICSE','AQA','Edexcel','Other']
              .map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Subject (e.g. Mathematics)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={grade} onChange={e => setGrade(e.target.value)}
              placeholder="Grade (optional)" min={1} max={12}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input type="text" value={targetGrade} onChange={e => setTargetGrade(e.target.value)}
              placeholder="Target (e.g. A, B)"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Exam Date</label>
            <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={handleCreate} disabled={generating}
            className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
            {generating ? 'Generating your plan...' : 'Generate Study Plan'}
          </button>
        </div>
      )}

      {plans.length === 0 && !showForm && (
        <div className="rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">
            No study plans yet. Add an upcoming exam to generate a personalised plan.
          </p>
        </div>
      )}

      {plans.map(plan => (
        <div key={plan.id} className="rounded-xl border p-5 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {plan.student_exams.subject} — {plan.student_exams.board}
              </p>
              <p className="text-xs text-muted-foreground">
                Exam: {new Date(plan.student_exams.exam_date).toLocaleDateString()}
                {plan.student_exams.target_grade && ` · Target: ${plan.student_exams.target_grade}`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {(plan.plan_json ?? []).slice(0, 2).map(week => (
              <div key={week.week} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Week {week.week} — {week.focus}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {week.sessions.map((s, i) => (
                    <span key={i} /* TODO: replace with unique id */ /* TODO: replace with unique id */
                      className={`text-[10px] border rounded px-2 py-0.5 font-medium ${typeColor(s.type)}`}>
                      {s.day}: {s.topic} ({s.duration_minutes}m)
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {plan.plan_json?.length > 2 && (
              <p className="text-xs text-muted-foreground">
                + {plan.plan_json.length - 2} more weeks in your plan
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
