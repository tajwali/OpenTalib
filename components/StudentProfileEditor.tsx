'use client'
import { useState, useEffect } from 'react'
import { StudentContextPicker } from '@/components/StudentContextPicker'
import { VoicePicker } from '@/components/VoicePicker'
import { STUDENT_CONTEXT_TAGS } from '@/lib/student-context-tags'

interface Props { userId?: string; onSave?: () => void }

export function StudentProfileEditor({ userId, onSave }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [boards, setBoards] = useState<string[]>([])

  const [form, setForm] = useState({
    age: '', gender: '', primaryBoard: 'Other', secondaryBoard: '',
    targetGrade: '', currentGrade: '', instructionLanguage: 'English',
    homeLanguage: '', englishProficiency: 'fluent',
    contextTags: [] as string[], customContext: '',
    preferredVoice: '', preferredPace: 'normal'
  })

  useEffect(() => {
    // Load existing profile
    fetch(`/api/user/student-profile${userId ? `?userId=${userId}` : ''}`)
      .then(r => r.json())
      .then(d => {
        if (d.profile) {
          setForm({
            age: d.profile.age?.toString() ?? '',
            gender: d.profile.gender ?? '',
            primaryBoard: d.profile.primary_board ?? 'Other',
            secondaryBoard: d.profile.secondary_board ?? '',
            targetGrade: d.profile.target_grade ?? '',
            currentGrade: d.profile.current_grade?.toString() ?? '',
            instructionLanguage: d.profile.instruction_language ?? 'English',
            homeLanguage: d.profile.home_language ?? '',
            english_proficiency: d.profile.english_proficiency ?? 'fluent',
            contextTags: d.profile.context_tags ?? [],
            customContext: d.profile.custom_context ?? '',
            preferredVoice: d.profile.preferred_voice ?? '',
            preferredPace: d.profile.preferred_pace ?? 'normal'
          } as any)
        }
        setLoading(false)
      })

    // Load board list
    fetch('/api/boards').then(r => r.json()).then(d => {
      setBoards(d.boards?.map((b: any) => b.name) ?? [])
    })
  }, [userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/user/student-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId }),
      })
      if (!res.ok) throw new Error('Failed to save profile')
      if (onSave) onSave()
      alert('Profile saved successfully!')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const updateForm = (updates: Partial<typeof form>) => setForm(f => ({ ...form, ...updates }))

  if (loading) return <div className="animate-pulse bg-muted h-64 rounded-xl" />

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Basic Info</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Age</label>
              <input type="number" value={form.age} onChange={e => updateForm({ age: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Gender</label>
              <select value={form.gender} onChange={e => updateForm({ gender: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Academic</h3>
          <div>
            <label className="text-xs font-medium mb-1 block">Primary Exam Board</label>
            <select value={form.primaryBoard} onChange={e => updateForm({ primaryBoard: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="Other">Other / Not Board Specific</option>
              {boards.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </section>
      </div>

      <div className="border-t pt-8">
        <StudentContextPicker
          value={STUDENT_CONTEXT_TAGS.filter(t => form.contextTags.includes(t.id)).map(t => t.label).join(', ')}
          onChange={(s) => {
            // This is a bit hacky because Picker returns a string, but we want IDs
            // In a real app, Picker should return IDs directly.
            // For now, let's just find matches.
            const labels = s.split(', ').map(l => l.trim())
            const ids = STUDENT_CONTEXT_TAGS.filter(t => labels.includes(t.label)).map(t => t.id)
            const custom = labels.find(l => !STUDENT_CONTEXT_TAGS.some(t => t.label === l)) ?? ''
            updateForm({ contextTags: ids, customContext: custom })
          }}
        />
      </div>

      <div className="border-t pt-8">
        <VoicePicker value={form.preferredVoice} onChange={v => updateForm({ preferredVoice: v })} />
      </div>

      <div className="pt-4">
        <button type="submit" disabled={saving}
          className="w-full md:w-auto px-8 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all">
          {saving ? 'Saving Profile...' : 'Save Learning Profile'}
        </button>
      </div>
    </form>
  )
}
