// app/api/content/mindmap/route.ts
// POST — returns mind map JSON for a course scene

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveModelFromHeaders } from '@/lib/server/resolve-model'
import { callLLM } from '@/lib/ai/llm'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = JSON.parse(await request.text())
  const { sceneTitle = '', sceneText = '' } = body

  if (!sceneText.trim()) {
    return NextResponse.json({ error: 'sceneText is required' }, { status: 400 })
  }

  const prompt = `Given this lesson content, extract key concepts and relationships for a mind map.

LESSON TITLE: ${sceneTitle}
LESSON CONTENT: ${sceneText.slice(0, 1500)}

Return ONLY valid JSON. No preamble:
{
  "center": "main topic in 3 words max",
  "branches": [
    {
      "label": "branch topic 3 words max",
      "children": ["detail 1", "detail 2", "detail 3"]
    }
  ]
}

Maximum 5 branches. Maximum 3 children per branch. Labels max 4 words.`

  try {
    const resolvedModel = await resolveModelFromHeaders(request)
    const response = await callLLM(
      {
        model: resolvedModel.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 600,
      },
      'mindmap-gen'
    )

    const rawText = response.text

    const jsonText = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const mindmap = JSON.parse(jsonText)
    return NextResponse.json({ mindmap })
  } catch (e) {
    console.error('[content/mindmap]', e)
    return NextResponse.json(
      { error: 'Mind map generation failed' },
      { status: 500 }
    )
  }
}
