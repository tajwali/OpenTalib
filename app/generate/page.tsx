'use client';
const MAX_AVATAR_SIZE = 1024 * 1024 * 2; // 2MB
function isCustomAvatar(url: string) { return url.startsWith('data:') || url.startsWith('blob:'); }

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ImagePlus,
  Pencil,
  Trash2,
  Settings,
  Sun,
  Moon,
  Monitor,
  BotOff,
  ChevronUp,
  LogOut,
  UserCircle,
  Tag,
  Languages,
  GraduationCap,
  BookOpen,
  Plus,
} from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Textarea as UITextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/settings';
import { GenerationToolbar } from '@/components/generation/generation-toolbar';
import { AgentBar } from '@/components/agent/agent-bar';
import { useTheme } from '@/lib/hooks/use-theme';
import { nanoid } from 'nanoid';
import { storePdfBlob } from '@/lib/utils/image-storage';
import type { UserRequirements } from '@/lib/types/generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore, AVATAR_OPTIONS } from '@/lib/store/user-profile';
import {
  StageListItem,
  listStages,
  deleteStageData,
  getFirstSlideByStages,
} from '@/lib/utils/stage-storage';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import type { Slide } from '@/lib/types/slides';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { SpeechButton } from '@/components/audio/speech-button';
import { BOARD_REGISTRY } from '@/lib/server/board-registry';
import { StudentContextPicker } from '@/components/StudentContextPicker';
import Link from 'next/link';

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';
const LANGUAGE_STORAGE_KEY = 'generationLanguage';
const RECENT_OPEN_STORAGE_KEY = 'recentClassroomsOpen';

interface Subject {
  id: string;
  name: string;
  icon: string;
}

interface FormState {
  pdfFile: File | null;
  requirement: string;
  language: 'zh-CN' | 'en-US';
  webSearch: boolean;
  grade: string; // 'none' | 'all' | 'Grade 1' ... 'Grade 10'
  subjectId: string; // 'auto' | uuid
  board: string;
  studentContext: string;
  instructionLanguage: string;
  ttsVoice: string;
}

const initialFormState: FormState = {
  pdfFile: null,
  requirement: '',
  language: 'en-US', // Default to English for OpenTalib 2.0
  webSearch: false,
  grade: 'none',
  subjectId: 'auto',
  board: 'Other',
  studentContext: '',
  instructionLanguage: 'English',
  ttsVoice: '',
};

function HomePage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<
    import('@/lib/types/settings').SettingsSection | undefined
  >(undefined);

  const [showContextPanel, setShowContextPanel] = useState(false);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);

  // Close panels on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-panel]')) {
        setShowContextPanel(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Draft cache for requirement text
  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  // MAX_AVATAR_SIZE moved top
  const currentModelId = useSettingsStore((s) => s.modelId);
  const [recentOpen, setRecentOpen] = useState(true);
  
  const [boards, setBoards] = useState<{name: string, description: string, category: string}[]>([]);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Hydrate client-only state after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_OPEN_STORAGE_KEY);
      if (saved !== null) setRecentOpen(saved !== 'false');
    } catch { /* localStorage unavailable */ }
    
    // Fetch profile and boards
    Promise.all([
      fetch('/api/user/profile').then(r => r.ok ? r.json() : null),
      fetch('/api/user/student-profile').then(r => r.ok ? r.json() : null),
      fetch('/api/boards').then(r => r.ok ? r.json() : null)
    ]).then(([basic, student, boardData]) => {
      if (basic?.display_name) setUserDisplayName(basic.display_name);
      if (student?.profile) {
        setForm(prev => ({
          ...prev,
          board: student.profile.primary_board ?? 'Other',
          instructionLanguage: student.profile.instruction_language ?? 'English',
          studentContext: student.contextString ?? '',
          ttsVoice: student.profile.preferred_voice ?? ''
        }));
        setProfileLoaded(true);
      }
      if (boardData?.boards) setBoards(boardData.boards);
    });

    try {
      const savedWebSearch = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const updates: Partial<FormState> = {};
      if (savedWebSearch === 'true') updates.webSearch = true;
      if (savedLanguage === 'zh-CN' || savedLanguage === 'en-US') {
        updates.language = savedLanguage;
      } else {
        const detected = navigator.language?.startsWith('zh') ? 'zh-CN' : 'en-US';
        updates.language = detected;
      }
      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
      }
    } catch { /* localStorage unavailable */ }
  }, []);

  // Restore requirement draft from cache
  const [prevCachedRequirement, setPrevCachedRequirement] = useState(cachedRequirement);
  if (cachedRequirement !== prevCachedRequirement) {
    setPrevCachedRequirement(cachedRequirement);
    if (cachedRequirement) {
      setForm((prev) => ({ ...prev, requirement: cachedRequirement }));
    }
  }

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!languageOpen && !themeOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setLanguageOpen(false);
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [languageOpen, themeOpen]);

  const loadClassrooms = async () => {
    try {
      const res = await fetch('/api/user/classrooms');
      if (res.ok) {
        const dbCourses = (await res.json()) as any[];
        const ts = dbCourses.map((c) => new Date(c.created_at).getTime());
        const list: StageListItem[] = dbCourses.map((c, i) => ({
          id: c.id,
          name: c.title,
          sceneCount: 0,
          createdAt: ts[i],
          updatedAt: ts[i],
          grade: c.grade,
          subjectId: c.subject_id,
        }));
        setClassrooms(list);
        if (list.length > 0) {
          const slides = await getFirstSlideByStages(list.map((c) => c.id));
          setThumbnails(slides);
        }
      } else {
        const list = await listStages();
        setClassrooms(list);
        if (list.length > 0) {
          const slides = await getFirstSlideByStages(list.map((c) => c.id));
          setThumbnails(slides);
        }
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  };

  useEffect(() => {
    loadClassrooms();
    fetch('/api/subjects')
      .then((res) => res.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'requirement') updateRequirementCache(value as string);
  };

  const handleGenerate = async () => {
    if (!form.requirement.trim() || !currentModelId) return;

    setError(null);
    let pdfId: string | undefined;

    if (form.pdfFile) {
      try {
        pdfId = await storePdfBlob(form.pdfFile);
      } catch (err) {
        setError('Failed to process PDF file');
        return;
      }
    }

    const sessionId = nanoid();
    const requirements: UserRequirements = {
      requirement: form.requirement,
      language: form.language,
      webSearch: form.webSearch,
      grade: form.grade === 'none' ? null : form.grade,
      subjectId: form.subjectId === 'auto' ? null : form.subjectId,
      board: form.board,
      studentContext: form.studentContext,
      instructionLanguage: form.instructionLanguage,
    };

    useMediaGenerationStore.getState().setTtsVoice(form.ttsVoice || null);


    const session = {
      sessionId,
      requirements,
      pdfText: '',
      currentStep: 'generating',
      pdfStorageKey: pdfId,
      pdfFileName: form.pdfFile?.name,
    };
    sessionStorage.setItem('generationSession', JSON.stringify(session));
    router.push('/generation-preview');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate();
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(id);
  };

  const confirmDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/user/classrooms?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await deleteStageData(id);
        setClassrooms((prev) => prev.filter((c) => c.id !== id));
        toast.success(t('classroom.deleted'));
      } else {
        toast.error('Failed to delete course');
      }
    } catch (err) {
      toast.error('Error deleting course');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-GB', {
      month: 'short',
      day: 'numeric',
    });
  };

  const canGenerate = !!form.requirement.trim() && !!currentModelId;

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-8 font-sans selection:bg-violet-100 selection:text-violet-900 dark:selection:bg-violet-900/50 dark:selection:text-violet-100">
      {/* ── Background decoration ── */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-24 -left-24 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: '6s' }}
        />
      </div>

      {/* ═══ Hero section ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn(
          'relative z-20 w-full max-w-[800px] flex flex-col items-center',
          classrooms.length === 0 ? 'justify-center min-h-[calc(100dvh-8rem)]' : 'mt-[5vh]',
        )}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
          className="mb-2 flex items-center gap-2"
        >
          <span className="text-2xl font-bold tracking-tight">OpenTalib</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-muted-foreground/60 mb-8"
        >
          {t('home.slogan')}
        </motion.p>

        {/* ── Unified input area ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="w-full"
        >
          <div className="w-full rounded-2xl border border-border/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl shadow-black/[0.03] dark:shadow-black/20 transition-shadow focus-within:shadow-2xl focus-within:shadow-violet-500/[0.06]">
            
            <div className="relative z-20 flex items-start justify-between">
              <GreetingBar name={userDisplayName} />
              <div className="pr-3 pt-3.5 shrink-0">
                <AgentBar />
              </div>
            </div>

            <textarea
              ref={textareaRef}
              placeholder={t('upload.requirementPlaceholder')}
              className="w-full resize-none border-0 bg-transparent px-4 pt-4 pb-2 text-[14px] leading-relaxed placeholder:text-muted-foreground/40 focus:outline-none min-h-[100px]"
              value={form.requirement}
              onChange={(e) => updateForm('requirement', e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
            />

            <div className="px-4 pb-4 space-y-3">
              {/* Row 1: Inline Selects */}
              <div className="flex flex-wrap gap-2 items-center">
                {/* Grade */}
                <div className="relative">
                  <select
                    value={form.grade}
                    onChange={(e) => updateForm('grade', e.target.value)}
                    className="appearance-none h-8 pl-8 pr-8 rounded-md border border-border/50 bg-background text-[12px] font-medium hover:border-primary/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="none">All Grades</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={`Grade ${g}`}>Grade {g}</option>
                    ))}
                  </select>
                  <GraduationCap className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40 pointer-events-none" />
                </div>

                {/* Subject */}
                <div className="relative">
                  <select
                    value={form.subjectId}
                    onChange={(e) => updateForm('subjectId', e.target.value)}
                    className="appearance-none h-8 pl-8 pr-8 rounded-md border border-border/50 bg-background text-[12px] font-medium hover:border-primary/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    <option value="auto">Auto-detect Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <BookOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40 pointer-events-none" />
                </div>

                {/* Board */}
                <div className="relative">
                  <select
                    value={form.board}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '__request__') {
                        const boardName = window.prompt('Enter the board name (e.g. ACCA, NEBOSH, NEET):');
                        if (boardName?.trim()) {
                          fetch('/api/boards', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              name: boardName.trim(),
                              description: `Requested by user: ${boardName.trim()}`,
                              category: 'other',
                            }),
                          })
                          .then(r => r.json())
                          .then(d => {
                            alert(d.message ?? 'Board submitted for admin approval.');
                            setBoards(prev => [...prev, { name: boardName.trim(), description: `Requested by user: ${boardName.trim()}`, category: 'other' }]);
                            updateForm('board', boardName.trim());
                          })
                          .catch(() => alert('Could not submit. Please try again.'));
                        }
                        return;
                      }
                      updateForm('board', value);
                    }}
                    className="appearance-none h-8 pl-8 pr-8 rounded-md border border-border/50 bg-background text-[12px] font-medium hover:border-primary/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 max-w-[160px] truncate"
                  >
                    <option value="Other">🎓 Exam board</option>
                    {['academic','professional','language','university','vocational','other']
                      .map(cat => {
                        const catBoards = boards.filter(b => b.category === cat)
                        if (catBoards.length === 0) return null
                        const labels: Record<string,string> = {
                          academic:'🎓 Academic', professional:'💼 Professional',
                          language:'🌐 Language', university:'🏛️ University Entrance',
                          vocational:'🔧 Vocational', other:'📋 Other',
                        }
                        return (
                          <optgroup key={cat} label={labels[cat] ?? cat}>
                            {catBoards.map(b => (
                              <option key={b.name} value={b.name}>{b.name}</option>
                            ))}
                          </optgroup>
                        )
                      })}
                    <option value="__request__">+ Request new board...</option>
                  </select>
                  <Monitor className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40 pointer-events-none" />
                </div>

                {/* Language */}
                <div className="relative">
                  <select
                    value={form.instructionLanguage}
                    onChange={(e) => updateForm('instructionLanguage', e.target.value)}
                    className="appearance-none h-8 pl-8 pr-8 rounded-md border border-border/50 bg-background text-[12px] font-medium hover:border-primary/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
                  >
                    {['English', 'English + Urdu', 'English + Arabic', 'Urdu', 'Arabic', 'Spanish', 'French', 'Other'].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <Languages className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/40 pointer-events-none" />
                </div>
              </div>

              {/* Row 2: Icons/Tooltips & Enter */}
              <div className="flex items-center gap-2">
                {/* Context */}
                <div className="relative" data-panel>
                  <button
                    type="button"
                    onClick={() => setShowContextPanel(!showContextPanel)}
                    className={cn(
                      'flex items-center gap-1.5 h-8 px-3 rounded-md border text-[12px] font-medium transition-all',
                      form.studentContext
                        ? 'border-primary/30 bg-primary/5 text-primary'
                        : 'border-border/50 bg-background text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    <Tag className="size-3.5" />
                    <span>Context</span>
                    {form.studentContext && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                  <AnimatePresence>
                    {showContextPanel && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-2 z-50 w-80 rounded-xl border border-border/60 bg-white dark:bg-slate-900 shadow-2xl p-4 max-h-72 overflow-y-auto"
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Student Context</p>
                        <StudentContextPicker
                          value={form.studentContext}
                          onChange={(v) => updateForm('studentContext', v)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Voice select with preview */}
                <div className="flex items-center gap-1">
                  <select
                    value={form.ttsVoice}
                    onChange={e => updateForm('ttsVoice', e.target.value)}
                    className="rounded-md border px-2 py-1.5 text-sm bg-background"
                  >
                    <option value="">🎙 Voice</option>
                    <optgroup label="Female">
                      <option value="coral">Coral</option>
                      <option value="nova">Nova</option>
                      <option value="shimmer">Shimmer</option>
                    </optgroup>
                    <optgroup label="Male">
                      <option value="echo">Echo</option>
                      <option value="onyx">Onyx</option>
                    </optgroup>
                  </select>

                  {form.ttsVoice && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (isPreviewingVoice) return;
                        setIsPreviewingVoice(true);
                        try {
                          const res = await fetch('/api/tts/voices', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ voiceId: form.ttsVoice }),
                          });
                          if (!res.ok) throw new Error('Preview failed');
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const audio = new Audio(url);
                          audio.onended = () => {
                            setIsPreviewingVoice(false);
                            URL.revokeObjectURL(url);
                          };
                          audio.onerror = () => {
                            setIsPreviewingVoice(false);
                            URL.revokeObjectURL(url);
                          };
                          await audio.play();
                        } catch {
                          setIsPreviewingVoice(false);
                        }
                      }}
                      className="w-7 h-7 rounded-full border flex items-center justify-center text-xs hover:border-primary hover:text-primary transition-colors"
                      title="Preview this voice"
                    >
                      {isPreviewingVoice ? '■' : '▶'}
                    </button>
                  )}
                </div>

                <div className="flex-1" />

                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={cn(
                    'shrink-0 h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all px-4',
                    canGenerate
                      ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 cursor-pointer'
                      : 'bg-muted text-muted-foreground/40 cursor-not-allowed',
                  )}
                >
                  <span className="text-sm font-bold">{t('toolbar.enterClassroom')}</span>
                  <ArrowUp className="size-4" />
                </button>
              </div>
            </div>

            {/* Toolbar row (PDF, Web Search) */}
            <div className="px-3 pb-3 flex items-center justify-between border-t border-border/30 pt-3">
              <div className="flex-1 min-w-0">
                <GenerationToolbar
                  webSearch={form.webSearch}
                  onWebSearchChange={(v) => updateForm('webSearch', v)}
                  onSettingsOpen={(section) => {
                    setSettingsSection(section);
                    setSettingsOpen(true);
                  }}
                  pdfFile={form.pdfFile}
                  onPdfFileChange={(f) => updateForm('pdfFile', f)}
                  onPdfError={setError}
                />
              </div>

              <div className="flex items-center gap-2">
                <SpeechButton
                  size="sm"
                  onTranscription={(text) => {
                    setForm((prev) => {
                      const next = prev.requirement + (prev.requirement ? ' ' : '') + text;
                      updateRequirementCache(next);
                      return { ...prev, requirement: next };
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 w-full p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ═══ Recent classrooms ═══ */}
      {classrooms.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 mt-12 w-full max-w-6xl flex flex-col items-center"
        >
          <div className="w-full flex items-center justify-between mb-8">
            <div className="flex-1 h-px bg-border/40" />
            <div className="shrink-0 flex flex-wrap items-center gap-4 px-4">
              <span className="flex items-center gap-2 text-[13px] text-muted-foreground/60 select-none">
                <Clock className="size-3.5" />
                {t('classroom.recentClassrooms')}
                <span className="text-[11px] tabular-nums opacity-60">{classrooms.length}</span>
              </span>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter:</span>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-xs bg-background cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                  ))}
                </select>
              </div>

              <motion.div
                animate={{ rotate: recentOpen ? 180 : 0 }}
                className="cursor-pointer"
                onClick={() => {
                  const next = !recentOpen;
                  setRecentOpen(next);
                  localStorage.setItem(RECENT_OPEN_STORAGE_KEY, String(next));
                }}
              >
                <ChevronDown className="size-3.5" />
              </motion.div>
            </div>
            <div className="flex-1 h-px bg-border/40" />
          </div>

          <AnimatePresence>
            {recentOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="w-full overflow-hidden"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-8">
                  {classrooms
                    .filter((c) => selectedSubjectId === 'all' || c.subjectId === selectedSubjectId)
                    .map((classroom, i) => (
                      <motion.div
                        key={classroom.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.35, ease: 'easeOut' }}
                      >
                        <ClassroomCard
                          classroom={classroom}
                          slide={thumbnails[classroom.id]}
                          formatDate={formatDate}
                          onDelete={handleDelete}
                          confirmingDelete={pendingDeleteId === classroom.id}
                          onConfirmDelete={() => confirmDelete(classroom.id)}
                          onCancelDelete={() => setPendingDeleteId(null)}
                          onClick={() => router.push(`/classroom/${classroom.id}`)}
                        />
                      </motion.div>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <div className="mt-auto pt-12 pb-4 text-center text-xs text-muted-foreground/40">
        OpenTalib Open Source Project
      </div>

      {settingsOpen && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialSection={settingsSection}
        />
      )}
    </div>
  );
}

function GreetingBar({ name }: { name: string }) {
  const { t } = useI18n();
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const bio = useUserProfileStore((s) => s.bio);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);
  const setNickname = useUserProfileStore((s) => s.setNickname);
  const setBio = useUserProfileStore((s) => s.setBio);

  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = name || nickname || t('profile.defaultNickname');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingName(false);
        setAvatarPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const startEditName = () => {
    setNameDraft(nickname);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const commitName = () => {
    setNickname(nameDraft.trim());
    setEditingName(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error(t('profile.fileTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(128 / img.width, 128 / img.height);
        const w = img.width * scale; const h = img.height * scale;
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div ref={containerRef} className="relative pl-4 pr-2 pt-3.5 pb-1 w-auto">
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      {!open && (
        <div
          className="flex items-center gap-2.5 cursor-pointer transition-all duration-200 group rounded-full px-2.5 py-1.5 border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 active:scale-[0.97]"
          onClick={() => setOpen(true)}
        >
          <div className="shrink-0 relative">
            <div className="size-8 rounded-full overflow-hidden ring-[1.5px] ring-border/30 group-hover:ring-violet-400/60 dark:group-hover:ring-violet-400/40 transition-all duration-300">
              <img src={avatar} alt="" className="size-full object-cover" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-white dark:bg-slate-800 border border-border/40 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
              <Pencil className="size-[7px] text-muted-foreground/70" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="leading-none select-none flex items-center gap-1">
                  <span>
                    <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                      {t('home.greeting')}
                    </span>
                    <span className="text-[13px] font-semibold text-foreground/85 group-hover:text-foreground transition-colors">
                      {displayName}
                    </span>
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {t('profile.editTooltip')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute left-4 top-3.5 z-50 w-64"
          >
            <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_-2px_rgba(0,0,0,0.3)] px-2.5 py-2">
              <div
                className="flex items-center gap-2.5 cursor-pointer transition-all duration-200"
                onClick={() => { setOpen(false); setEditingName(false); setAvatarPickerOpen(false); }}
              >
                <div
                  className="shrink-0 relative cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setAvatarPickerOpen(!avatarPickerOpen); }}
                >
                  <div className="size-8 rounded-full overflow-hidden ring-[1.5px] ring-violet-300/70 dark:ring-violet-500/40 transition-all duration-300">
                    <img src={avatar} alt="" className="size-full object-cover" />
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-white dark:bg-slate-800 border border-border/60 flex items-center justify-center"
                  >
                    <ChevronDown className={cn('size-2 text-muted-foreground/70 transition-transform duration-200', avatarPickerOpen && 'rotate-180')} />
                  </motion.div>
                </div>

                <div className="flex-1 min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={nameInputRef}
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
                        onBlur={commitName}
                        maxLength={20}
                        placeholder={t('profile.defaultNickname')}
                        className="flex-1 min-w-0 h-6 bg-transparent border-b border-border/80 text-[13px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/40"
                      />
                      <button onClick={commitName} className="shrink-0 size-5 rounded flex items-center justify-center text-violet-500 hover:bg-violet-100 dark:hover:bg-violet-900/30">
                        <Check className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <span onClick={(e) => { e.stopPropagation(); startEditName(); }} className="group/name inline-flex items-center gap-1 cursor-pointer">
                      <span className="text-[13px] font-semibold text-foreground/85 group-hover/name:text-foreground transition-colors">{displayName}</span>
                      <Pencil className="size-2.5 text-muted-foreground/30 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                    </span>
                  )}
                </div>
                <motion.div initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 size-6 rounded-full flex items-center justify-center hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                  <ChevronUp className="size-3.5 text-muted-foreground/50" />
                </motion.div>
              </div>

              <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                <AnimatePresence>
                  {avatarPickerOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15, ease: 'easeInOut' }} className="overflow-hidden">
                      <div className="p-1 pb-2.5 flex items-center gap-1.5 flex-wrap">
                        {AVATAR_OPTIONS.map((url) => (
                          <button key={url} onClick={() => setAvatar(url)} className={cn('size-7 rounded-full overflow-hidden bg-gray-50 dark:bg-gray-800 cursor-pointer transition-all duration-150', 'hover:scale-110 active:scale-95', avatar === url ? 'ring-2 ring-violet-400 dark:ring-violet-500 ring-offset-0' : 'hover:ring-1 hover:ring-muted-foreground/30')}>
                            <img src={url} alt="" className="size-full" />
                          </button>
                        ))}
                        <label className={cn('size-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 border border-dashed', 'hover:scale-110 active:scale-95', isCustomAvatar(avatar) ? 'ring-2 ring-violet-400 dark:ring-violet-500 ring-offset-0 border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30' : 'border-muted-foreground/30 text-muted-foreground/50 hover:border-muted-foreground/50')} onClick={() => avatarInputRef.current?.click()} title={t('profile.uploadAvatar')}>
                          <ImagePlus className="size-3" />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <UITextarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                  maxLength={200}
                  rows={2}
                  className="resize-none border-border/40 bg-transparent min-h-[72px] !text-[13px] !leading-relaxed placeholder:!text-[11px] placeholder:!leading-relaxed focus-visible:ring-1 focus-visible:ring-border/60"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClassroomCard({ classroom, slide, formatDate, onDelete, confirmingDelete, onConfirmDelete, onCancelDelete, onClick }: any) {
  const { t } = useI18n();
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbWidth, setThumbWidth] = useState(0);

  useEffect(() => {
    const el = thumbRef.current; if (!el) return;
    const ro = new ResizeObserver(([entry]) => { setThumbWidth(Math.round(entry.contentRect.width)); });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  return (
    <div className="group cursor-pointer" onClick={confirmingDelete ? undefined : onClick}>
      <div ref={thumbRef} className="relative w-full aspect-[16/9] rounded-2xl bg-slate-100 dark:bg-slate-800/80 overflow-hidden transition-transform duration-200 group-hover:scale-[1.02]">
        {slide && thumbWidth > 0 ? (
          <ThumbnailSlide slide={slide} size={thumbWidth} viewportSize={slide.viewportSize ?? 1000} viewportRatio={slide.viewportRatio ?? 0.5625} />
        ) : !slide ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <span className="text-xl opacity-50">📄</span>
            </div>
          </div>
        ) : null}
        <AnimatePresence>
          {!confirmingDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 hover:bg-destructive/80 text-white hover:text-white backdrop-blur-sm rounded-full" onClick={(e) => onDelete(classroom.id, e)}>
                <Trash2 className="size-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {confirmingDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-[6px]" onClick={(e) => e.stopPropagation()}>
              <span className="text-[13px] font-medium text-white/90">{t('classroom.deleteConfirmTitle')}?</span>
              <div className="flex gap-2">
                <button className="px-3.5 py-1 rounded-lg text-[12px] font-medium bg-white/15 text-white/80 hover:bg-white/25 backdrop-blur-sm transition-colors" onClick={onCancelDelete}>{t('common.cancel')}</button>
                <button className="px-3.5 py-1 rounded-lg text-[12px] font-medium bg-red-500/90 text-white hover:bg-red-500 transition-colors" onClick={onConfirmDelete}>{t('classroom.delete')}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-2.5 px-1 flex flex-wrap items-center gap-2">
        <span className="shrink-0 inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
          {classroom.sceneCount} {t('classroom.slides')} · {formatDate(classroom.updatedAt)}
        </span>
        {classroom.grade && (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold">G{classroom.grade}</span>
        )}
        <p className="font-medium text-[15px] truncate text-foreground/90 min-w-0 flex-1">{classroom.name}</p>
      </div>
    </div>
  );
}

export default function Page() { return <HomePage />; }
