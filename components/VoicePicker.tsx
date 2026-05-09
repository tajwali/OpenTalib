'use client'
import { useState, useEffect, useRef } from 'react'

interface Voice {
  id: string; name: string; gender: string
  accent: string; description: string
}
interface Props { value: string; onChange: (id: string) => void }

export function VoicePicker({ value, onChange }: Props) {
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/api/tts/voices')
      .then(r => r.json())
      .then(d => { setVoices(d.voices ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function playPreview(voiceId: string) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (previewing === voiceId) { setPreviewing(null); return }
    setPreviewing(voiceId)
    setPreviewError(null)
    try {
      const res = await fetch('/api/tts/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setPreviewing(null); URL.revokeObjectURL(url) }
      audio.onerror = () => { setPreviewing(null); setPreviewError('Playback failed'); URL.revokeObjectURL(url) }
      await audio.play()
    } catch (e: any) {
      setPreviewing(null)
      setPreviewError(e.message ?? 'Preview unavailable')
    }
  }

  const female = voices.filter(v => v.gender === 'female')
  const male = voices.filter(v => v.gender === 'male')

  if (loading) return (
    <div className="text-sm text-muted-foreground py-2">Loading voices...</div>
  )

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium block">
        AI teacher voice
        <span className="text-muted-foreground font-normal ml-1">(optional)</span>
      </label>
      <p className="text-xs text-muted-foreground mt-1">
        Choose the voice your AI teacher will use. Press ▶ on any voice to hear a sample before deciding.
      </p>
      {previewError && <p className="text-xs text-amber-600">{previewError}</p>}
      <div className="space-y-4">
        {[{ label: 'Female voices', list: female }, { label: 'Male voices', list: male }]
          .map(group => group.list.length > 0 && (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.list.map(voice => (
                  <div key={voice.id} onClick={() => onChange(voice.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      value === voice.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-background hover:border-primary/40 hover:bg-muted/10'
                    }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{voice.name}</span>
                        {value === voice.id && (
                          <span className="text-xs text-primary font-bold">✓</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium">{voice.accent}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 italic">
                        {voice.description}
                      </p>
                    </div>
                    <button type="button"
                      onClick={e => { e.stopPropagation(); playPreview(voice.id) }}
                      className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                        previewing === voice.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border bg-background hover:border-primary hover:text-primary shadow-sm active:scale-90'
                      }`}
                      title={previewing === voice.id ? 'Stop' : 'Play sample'}>
                      {previewing === voice.id
                        ? <div className="w-2.5 h-2.5 bg-current rounded-sm" />
                        : <div className="ml-0.5" style={{
                            width: 0, height: 0,
                            borderStyle: 'solid',
                            borderWidth: '5px 0 5px 8px',
                            borderColor: 'transparent transparent transparent currentColor',
                          }} />
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
