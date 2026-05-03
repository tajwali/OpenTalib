'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Clock, CheckCircle, XCircle, ArrowLeft, AlertCircle } from 'lucide-react';

interface ExamQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short_answer';
  question: string;
  options?: { value: string; label: string }[];
  points: number;
}

interface ExamData {
  id: string;
  title: string;
  time_limit_minutes: number;
  difficulty: string;
  question_count: number;
  questions: ExamQuestion[];
}

interface GradedAnswer {
  questionId: string;
  question: string;
  submitted: string | string[] | undefined;
  correctAnswer: string[] | undefined;
  analysis: string | undefined;
  earned: number;
  points: number;
  correct: boolean;
}

interface ExamResult {
  result_id: string;
  score: number;
  total: number;
  percentage: number;
  answers: GradedAnswer[];
}

type Phase = 'before' | 'taking' | 'submitting' | 'results';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('before');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`/api/exams/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: ExamData) => {
        setExam(data);
        setSecondsLeft(data.time_limit_minutes * 60);
        setLoading(false);
      })
      .catch(() => {
        setError('Exam not found');
        setLoading(false);
      });
  }, [id]);

  const submitExam = useCallback(
    async (forceAnswers?: Record<string, string | string[]>) => {
      if (!exam) return;
      setPhase('submitting');
      if (timerRef.current) clearInterval(timerRef.current);

      const timeTaken = Math.round((Date.now() - startTime) / 1000);
      const used = forceAnswers ?? answers;
      const payload = exam.questions.map((q) => ({
        questionId: q.id,
        answer: used[q.id] ?? (q.type === 'multiple' ? [] : ''),
      }));

      try {
        const res = await fetch(`/api/exams/${id}/results`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: payload, time_taken_seconds: timeTaken }),
        });
        const data = (await res.json()) as ExamResult;
        setResult(data);
        setPhase('results');
      } catch {
        setError('Failed to submit exam');
        setPhase('taking');
      }
    },
    [exam, answers, id, startTime],
  );

  useEffect(() => {
    if (phase === 'taking') {
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            submitExam();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, submitExam]);

  function startExam() {
    setStartTime(Date.now());
    setPhase('taking');
  }

  function setAnswer(qId: string, value: string, multi: boolean) {
    setAnswers((prev) => {
      if (!multi) return { ...prev, [qId]: value };
      const current = (prev[qId] as string[]) ?? [];
      return {
        ...prev,
        [qId]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  function setTextAnswer(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading exam…
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">{error}</p>
        <button onClick={() => router.back()} className="text-blue-600 hover:underline">
          Go back
        </button>
      </div>
    );
  if (!exam) return null;

  // ── BEFORE ──────────────────────────────────────────────────────────────────
  if (phase === 'before') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 mb-6 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{exam.title}</h1>
          <p className="text-gray-500 text-sm mb-6 capitalize">Difficulty: {exam.difficulty}</p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{exam.question_count}</p>
              <p className="text-sm text-blue-500 mt-1">Questions</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{exam.time_limit_minutes}</p>
              <p className="text-sm text-purple-500 mt-1">Minutes</p>
            </div>
          </div>
          <ul className="text-sm text-gray-500 space-y-1 mb-8 list-disc list-inside">
            <li>Answer all questions before the timer runs out</li>
            <li>You cannot pause once you start</li>
            <li>Short-answer questions are for self-review only</li>
          </ul>
          <button
            onClick={startExam}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Start Exam
          </button>
        </div>
      </div>
    );
  }

  // ── TAKING ───────────────────────────────────────────────────────────────────
  if (phase === 'taking' || phase === 'submitting') {
    const q = exam.questions[currentQ];
    const isMulti = q.type === 'multiple';
    const isText = q.type === 'short_answer';
    const selectedMulti = (answers[q.id] as string[]) ?? [];
    const selectedSingle = (answers[q.id] as string) ?? '';
    const textVal = (answers[q.id] as string) ?? '';
    const answered = isText
      ? textVal.trim().length > 0
      : isMulti
        ? selectedMulti.length > 0
        : selectedSingle !== '';

    const timerWarning = secondsLeft < 60;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{exam.title}</span>
          <span
            className={`flex items-center gap-1.5 font-mono font-semibold text-sm ${timerWarning ? 'text-red-600' : 'text-gray-700'}`}
          >
            <Clock className="w-4 h-4" />
            {formatTime(secondsLeft)}
          </span>
        </div>

        {/* Progress */}
        <div className="bg-white border-b px-4 py-2 flex gap-1 overflow-x-auto">
          {exam.questions.map((_, i) => {
            const isAnswered =
              exam.questions[i].type === 'short_answer'
                ? typeof answers[exam.questions[i].id] === 'string' &&
                  (answers[exam.questions[i].id] as string).trim().length > 0
                : exam.questions[i].type === 'multiple'
                  ? Array.isArray(answers[exam.questions[i].id]) &&
                    (answers[exam.questions[i].id] as string[]).length > 0
                  : (answers[exam.questions[i].id] as string | undefined) !== undefined &&
                    answers[exam.questions[i].id] !== '';
            return (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                  i === currentQ
                    ? 'bg-blue-600 text-white'
                    : isAnswered
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question */}
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Question {currentQ + 1} of {exam.questions.length}
                {isMulti && ' · Select all that apply'}
                {isText && ' · Short answer'}
              </span>
              <span className="text-xs text-gray-400">
                {q.points} pt{q.points !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-gray-900 font-medium mb-5 leading-relaxed">{q.question}</p>

            {isText ? (
              <textarea
                value={textVal}
                onChange={(e) => setTextAnswer(q.id, e.target.value)}
                rows={4}
                placeholder="Type your answer here…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            ) : (
              <div className="space-y-2">
                {(q.options ?? []).map((opt) => {
                  const active = isMulti
                    ? selectedMulti.includes(opt.value)
                    : selectedSingle === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAnswer(q.id, opt.value, isMulti)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <span className="font-medium mr-2">{opt.value}.</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nav buttons */}
          <div className="flex gap-3">
            {currentQ > 0 && (
              <button
                onClick={() => setCurrentQ((q) => q - 1)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
              >
                Previous
              </button>
            )}
            {currentQ < exam.questions.length - 1 ? (
              <button
                onClick={() => setCurrentQ((q) => q + 1)}
                disabled={!answered}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  answered
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => submitExam()}
                disabled={phase === 'submitting'}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {phase === 'submitting' ? 'Submitting…' : 'Submit Exam'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ──────────────────────────────────────────────────────────────────
  if (phase === 'results' && result) {
    const pct = result.percentage;
    const color = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600';
    const bg = pct >= 80 ? 'bg-green-50' : pct >= 60 ? 'bg-yellow-50' : 'bg-red-50';

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 mb-6 text-sm mt-4"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>

          <div className={`rounded-2xl p-6 mb-6 text-center ${bg}`}>
            <p className={`text-6xl font-bold ${color} mb-2`}>{Math.round(pct)}%</p>
            <p className="text-gray-600 text-sm">
              {result.score} / {result.total} points
            </p>
            <h2 className="text-xl font-semibold text-gray-800 mt-3">{exam.title}</h2>
          </div>

          <div className="space-y-4">
            {result.answers.map((a, i) => {
              const isShort = !a.correctAnswer;
              return (
                <div key={a.questionId} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-sm font-medium text-gray-800 flex-1">
                      <span className="text-gray-400 mr-1">Q{i + 1}.</span>
                      {a.question}
                    </p>
                    {isShort ? (
                      <span className="text-xs text-gray-400 whitespace-nowrap">self-review</span>
                    ) : a.correct ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                  </div>

                  {a.submitted !== undefined &&
                    a.submitted !== '' &&
                    !(Array.isArray(a.submitted) && a.submitted.length === 0) && (
                      <p className="text-xs text-gray-500 mb-1">
                        <span className="font-medium">Your answer:</span>{' '}
                        {Array.isArray(a.submitted) ? a.submitted.join(', ') : a.submitted}
                      </p>
                    )}

                  {a.correctAnswer && !a.correct && (
                    <p className="text-xs text-green-600 mb-1">
                      <span className="font-medium">Correct:</span> {a.correctAnswer.join(', ')}
                    </p>
                  )}

                  {a.analysis && <p className="text-xs text-gray-400 mt-2 italic">{a.analysis}</p>}

                  <p className="text-xs text-gray-400 mt-2">
                    {isShort
                      ? `${a.points} pt${a.points !== 1 ? 's' : ''} (not auto-graded)`
                      : `${a.earned} / ${a.points} pt${a.points !== 1 ? 's' : ''}`}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 mb-10 flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
                setCurrentQ(0);
                if (exam) setSecondsLeft(exam.time_limit_minutes * 60);
                setPhase('before');
              }}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors"
            >
              Retake Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
