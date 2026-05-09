import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VOICES = [
  { id: 'coral',   name: 'Coral',   gender: 'female', description: 'Warm and friendly' },
  { id: 'nova',    name: 'Nova',    gender: 'female', description: 'Bright and energetic' },
  { id: 'shimmer', name: 'Shimmer', gender: 'female', description: 'Clear and expressive' },
  { id: 'echo',    name: 'Echo',    gender: 'male',   description: 'Authoritative and steady' },
  { id: 'onyx',    name: 'Onyx',    gender: 'male',   description: 'Confident and professional' },
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
  const voiceId = body.voiceId ?? body.voice ?? body.ttsVoice ?? ''
  if (!voiceId) return NextResponse.json({ error: 'voiceId required' }, { status: 400 })

  const voice = VOICES.find(v => v.id === voiceId)
  const voiceName = voice?.name ?? voiceId

  const previewText = `Hello! I am ${voiceName}, your AI teacher for today. I will guide you through the lesson with clear explanations and worked examples. Let us begin!`

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
