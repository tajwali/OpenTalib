export interface ContextTag {
  id: string
  label: string
  category: string
}

export const STUDENT_CONTEXT_TAGS: ContextTag[] = [
  { id: 'esl',           label: 'ESL learner',          category: 'Language' },
  { id: 'urdu_home',     label: 'Urdu at home',          category: 'Language' },
  { id: 'arabic_home',   label: 'Arabic at home',        category: 'Language' },
  { id: 'bilingual',     label: 'Bilingual',             category: 'Language' },
  { id: 'limited_eng',   label: 'Limited English',       category: 'Language' },
  { id: 'visual',        label: 'Visual learner',        category: 'Learning style' },
  { id: 'kinesthetic',   label: 'Hands-on learner',      category: 'Learning style' },
  { id: 'dyslexia',      label: 'Dyslexia',              category: 'Learning needs' },
  { id: 'adhd',          label: 'ADHD',                  category: 'Learning needs' },
  { id: 'slow_pace',     label: 'Needs slower pace',     category: 'Learning needs' },
  { id: 'repetition',    label: 'Needs repetition',      category: 'Learning needs' },
  { id: 'short_tasks',   label: 'Short tasks only',      category: 'Learning needs' },
  { id: 'no_prior',      label: 'No prior knowledge',    category: 'Prior knowledge' },
  { id: 'weak_maths',    label: 'Weak maths background', category: 'Prior knowledge' },
  { id: 'weak_english',  label: 'Weak English writing',  category: 'Prior knowledge' },
  { id: 'advanced',      label: 'Advanced learner',      category: 'Prior knowledge' },
  { id: 'gifted',        label: 'Gifted student',        category: 'Prior knowledge' },
  { id: 'revision',      label: 'Revision mode',         category: 'Prior knowledge' },
  { id: 'rural',         label: 'Rural school',          category: 'Context' },
  { id: 'large_class',   label: 'Large class (30+)',     category: 'Context' },
  { id: 'exam_soon',     label: 'Exam in 2 weeks',       category: 'Context' },
  { id: 'homeschool',    label: 'Homeschooled',          category: 'Context' },
  { id: 'low_resource',  label: 'Limited resources',     category: 'Context' },
  { id: 'working',       label: 'Working professional',  category: 'Professional' },
  { id: 'self_study',    label: 'Self-studying',         category: 'Professional' },
  { id: 'career_change', label: 'Career change',         category: 'Professional' },
  { id: 'time_poor',     label: 'Limited study time',    category: 'Professional' },
]

export const TAG_CATEGORIES = Array.from(
  new Set(STUDENT_CONTEXT_TAGS.map(t => t.category))
)
