import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VOICES = [
  { id: 'alloy',   name: 'Alloy',   gender: 'neutral', accent: 'American English', description: 'Versatile and balanced' },
  { id: 'ash',     name: 'Ash',     gender: 'neutral', accent: 'American English', description: 'Clear and modern' },
  { id: 'ballad',  name: 'Ballad',  gender: 'neutral', accent: 'American English', description: 'Deep and resonant' },
  { id: 'coral',   name: 'Coral',   gender: 'female',  accent: 'American English', description: 'Warm and friendly' },
  { id: 'echo',    name: 'Echo',    gender: 'male',    accent: 'American English', description: 'Authoritative and steady' },
  { id: 'fable',   name: 'Fable',   gender: 'neutral', accent: 'American English', description: 'Engaging and narrative' },
  { id: 'nova',    name: 'Nova',    gender: 'female',  accent: 'American English', description: 'Bright and energetic' },
  { id: 'onyx',    name: 'Onyx',    gender: 'male',    accent: 'American English', description: 'Confident and professional' },
  { id: 'sage',    name: 'Sage',    gender: 'neutral', accent: 'American English', description: 'Calm and steady' },
  { id: 'shimmer', name: 'Shimmer', gender: 'female',  accent: 'American English', description: 'Clear and expressive' },
  { id: 'verse',   name: 'Verse',   gender: 'neutral', accent: 'American English', description: 'Poetic and fluid' },
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
    // Note: In local/prod the API URL might vary. We use relative fetch or absolute if env set.
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
        ttsProviderId: 'openai-tts' // Backend maps this to Kokoro
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

    // Return the base64 audio as a buffer
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
