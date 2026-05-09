'use client'
import { useState } from 'react'
import { STUDENT_CONTEXT_TAGS, TAG_CATEGORIES } from '@/lib/student-context-tags'

interface Props { value: string; onChange: (v: string) => void }

function buildString(ids: Set<string>, custom: string): string {
  const labels = STUDENT_CONTEXT_TAGS
    .filter(t => ids.has(t.id)).map(t => t.label)
  return [...labels, ...(custom.trim() ? [custom.trim()] : [])].join(', ')
}

export function StudentContextPicker({ value, onChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      onChange(buildString(next, custom))
      return next
    })
  }

  function handleCustom(text: string) {
    setCustom(text)
    onChange(buildString(selected, text))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Student context
          <span className="text-muted-foreground font-normal ml-1">(optional)</span>
        </label>
        {(selected.size > 0 || custom) && (
          <button type="button"
            onClick={() => { setSelected(new Set()); setCustom(''); onChange('') }}
            className="text-xs text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        )}
      </div>

      {TAG_CATEGORIES.map(category => (
        <div key={category}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            {category}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STUDENT_CONTEXT_TAGS.filter(t => t.category === category).map(tag => (
              <button key={tag.id} type="button" onClick={() => toggle(tag.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  selected.has(tag.id)
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                }`}>
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button type="button" onClick={() => setShowCustom(s => !s)}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2">
        {showCustom ? '− Hide custom input' : '+ Add custom context'}
      </button>

      {showCustom && (
        <input type="text" value={custom} onChange={e => handleCustom(e.target.value)}
          placeholder="e.g. preparing for resit, strong in algebra"
          className="w-full rounded-md border px-3 py-2 text-sm bg-background" />
      )}

      {value && (
        <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Context: </span>{value}
        </div>
      )}
    </div>
  )
}
