import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Real Kokoro voice IDs supported by the backend
const VOICES = [
  { id: 'af_heart',    name: 'Heart',    gender: 'female', accent: 'American English', description: 'Warm and encouraging — ideal for younger students' },
  { id: 'af_bella',    name: 'Bella',    gender: 'female', accent: 'American English', description: 'Clear and friendly — good for all ages' },
  { id: 'bf_emma',     name: 'Emma',     gender: 'female', accent: 'British English',  description: 'Professional and calm — suited for exam prep' },
  { id: 'bf_isabella', name: 'Isabella', gender: 'female', accent: 'British English',  description: 'Bright and expressive — good for languages' },
  { id: 'am_adam',     name: 'Adam',     gender: 'male',   accent: 'American English', description: 'Confident and clear — suited for STEM' },
  { id: 'am_michael',  name: 'Michael',  gender: 'male',   accent: 'American English', description: 'Steady and reassuring — good for complex topics' },
  { id: 'bm_george',   name: 'George',   gender: 'male',   accent: 'British English',  description: 'Authoritative and precise — professional courses' },
  { id: 'bm_lewis',    name: 'Lewis',    gender: 'male',   accent: 'British English',  description: 'Energetic and engaging — younger students' },
]

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ voices: VOICES })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { voiceId } = body
  if (!voiceId) return NextResponse.json({ error: 'voiceId required' }, { status: 400 })

  const voice = VOICES.find(v => v.id === voiceId)
  if (!voice) return NextResponse.json({ error: 'Unknown voice' }, { status: 404 })

  const previewText = `Hello! I am ${voice.name}, your AI teacher for today. I will guide you through the lesson with clear explanations and worked examples. Let us begin!`

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    
    const ttsResponse = await fetch(`${baseUrl}/api/generate/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ 
        text: previewText, 
        audioId: `preview_${voiceId}`,
        ttsVoice: voiceId,
        ttsProviderId: 'openai-tts' 
      }),
    })

    if (!ttsResponse.ok) {
      const errData = await ttsResponse.json().catch(() => ({}))
      throw new Error(errData.error || `TTS route returned ${ttsResponse.status}`)
    }

    const data = await ttsResponse.json()
    if (!data.success || !data.base64) {
       throw new Error(data.error || 'Invalid TTS response')
    }

    const audioBuffer = Buffer.from(data.base64, 'base64')

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': `audio/${data.format || 'mp3'}`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[tts/voices] error:', error)
    return NextResponse.json(
      { error: 'Preview unavailable', detail: String(error) },
      { status: 500 }
    )
  }
}
