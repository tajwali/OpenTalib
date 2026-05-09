// app/api/content/revision-cards/route.ts
// POST — generates printable revision cards for a course as HTML

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveModelFromHeaders } from '@/lib/server/resolve-model'
import { callLLM } from '@/lib/ai/llm'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = JSON.parse(await request.text())
  const { courseTitle = '', conceptKeys = [], subject = '' } = body

  if (conceptKeys.length === 0) {
    return NextResponse.json({ error: 'conceptKeys array is required' }, { status: 400 })
  }

  const prompt = `Create revision flashcards for these concepts from a ${subject} course: "${courseTitle}"

Concepts: ${conceptKeys.slice(0, 12).join(', ')}

For each concept create a flashcard with:
- Front: concept name as a question prompt
- Back: concise answer (2-3 sentences max)

Return ONLY valid JSON array:
[
  {
    "concept": "concept_key",
    "front": "What is...? / Define... / Explain...",
    "back": "Concise answer with key facts."
  }
]`

  try {
    const resolvedModel = await resolveModelFromHeaders(request)
    const response = await callLLM(
      {
        model: resolvedModel.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1500,
      },
      'revision-cards-gen'
    )

    const rawText = response.text

    const jsonText = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const cards = JSON.parse(jsonText)

    // Generate printable HTML
    const cardHtml = cards.map((card: any, i: number) => `
      <div class="card">
        <div class="card-front">
          <div class="card-number">${i + 1}</div>
          <div class="card-subject">${subject}</div>
          <div class="card-question">${card.front}</div>
        </div>
        <div class="card-back">
          <div class="card-number">${i + 1} ✓</div>
          <div class="card-answer">${card.back}</div>
          <div class="card-concept">${card.concept.replace(/_/g, ' ')}</div>
        </div>
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Revision Cards — ${courseTitle}</title>
<style>
  @media print { body { margin: 0; } }
  body { font-family: system-ui, sans-serif; background: #f5f5f5; padding: 20px; }
  h1 { font-size: 18px; margin-bottom: 20px; color: #333; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { background: white; border-radius: 8px; border: 1px solid #e0e0e0; overflow: hidden; page-break-inside: avoid; margin-bottom: 16px; }
  .card-front { padding: 16px; border-bottom: 2px dashed #e0e0e0; min-height: 100px; }
  .card-back { padding: 16px; background: #f9f9f9; min-height: 100px; }
  .card-number { font-size: 10px; color: #999; margin-bottom: 4px; }
  .card-subject { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
  .card-question { font-size: 14px; font-weight: 600; color: #333; }
  .card-answer { font-size: 13px; color: #333; line-height: 1.5; }
  .card-concept { font-size: 10px; color: #999; margin-top: 8px; font-style: italic; }
</style>
</head>
<body>
<h1>Revision Cards — ${courseTitle}</h1>
<div class="grid">${cardHtml}</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="revision-cards-${courseTitle.replace(/\s+/g, '-')}.html"`,
      },
    })

  } catch (e) {
    console.error('[content/revision-cards]', e)
    return NextResponse.json(
      { error: 'Revision card generation failed' },
      { status: 500 }
    )
  }
}
