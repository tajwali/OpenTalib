// lib/server/board-registry.ts
// Thin registry — names and descriptions only.
// Methodology is NOT hardcoded here; the resolver LLM supplies it.

export const BOARD_REGISTRY: Record<string, string> = {
  'FBISE': 'Federal Board of Intermediate and Secondary Education, Pakistan. National curriculum. Urdu and English medium. Short-answer and essay terminal exams.',
  'Cambridge O-Level': 'Cambridge Ordinary Level. Common in Pakistan, Bangladesh, Sri Lanka. English medium. Marks awarded for method as well as final answer.',
  'Cambridge IGCSE': 'International General Certificate of Secondary Education. UK-origin. English medium. Mix of coursework and terminal exams.',
  'Cambridge A-Level': 'Cambridge Advanced Level. Post-16. University entry qualification. Deep subject specialisation.',
  'CBSE': 'Central Board of Secondary Education, India. NCERT textbooks. English and Hindi medium. Structured mark allocation per question type.',
  'ICSE': 'Indian Certificate of Secondary Education. More analytical emphasis than CBSE. English medium.',
  'Punjab Board': 'Punjab Board of Secondary Education, Pakistan. Provincial curriculum. Primarily Urdu medium.',
  'Sindh Board': 'Sindh Board of Secondary Education, Pakistan. Provincial curriculum. Urdu medium.',
  'AQA': 'Assessment and Qualifications Alliance, UK. GCSE and A-Level. Tiered foundation and higher papers.',
  'Edexcel': 'Pearson Edexcel, UK and international. GCSE and A-Level. Widely used in the Middle East and South Asia.',
  'IB MYP': 'International Baccalaureate Middle Years Programme. Interdisciplinary, inquiry-based, criterion-referenced. Grades 6–10.',
  'IB DP': 'International Baccalaureate Diploma Programme. Internal assessment plus external exams. University-entry focused.',
  'US Common Core': 'Common Core State Standards, USA. Mathematical reasoning emphasis. Evidence-based writing across subjects.',
  'Other': 'Non-specified curriculum. Resolver will apply general best-practice pedagogy for the grade and subject.',
}

export function getBoardDescription(board: string): string {
  return BOARD_REGISTRY[board] ?? BOARD_REGISTRY['Other']
}
