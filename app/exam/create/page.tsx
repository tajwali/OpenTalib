'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, BookOpen, Clock, BarChart2 } from 'lucide-react';

interface Classroom {
  id: string;
  title: string;
  topic: string;
  created_at: string;
}

export default function CreateExamPage() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState('mixed');
  const [timeLimit, setTimeLimit] = useState(30);
  const [title, setTitle] = useState('');

  useEffect(() => {
    fetch('/api/user/classrooms')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Classroom[]) => {
        setClassrooms(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggleCourse(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleGenerate() {
    if (!selected.length) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroom_ids: selected,
          num_questions: numQuestions,
          difficulty,
          time_limit_minutes: timeLimit,
          title: title.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? 'Generation failed');
        setGenerating(false);
        return;
      }
      router.push(`/exam/${data.id}`);
    } catch {
      setError('Network error. Please try again.');
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading courses…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-600 mb-6 text-sm mt-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Exam</h1>
        <p className="text-gray-500 text-sm mb-6">
          Select courses and let AI generate exam questions
        </p>

        {/* Course selection */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            Select Courses
          </h2>
          {classrooms.length === 0 ? (
            <p className="text-sm text-gray-400">No courses found. Generate a course first.</p>
          ) : (
            <div className="space-y-2">
              {classrooms.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCourse(c.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm ${
                    selected.includes(c.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-gray-800">{c.title}</p>
                  {c.topic && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.topic}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-500" />
            Exam Settings
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Exam Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Unit 3 Assessment"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1">
                Number of Questions: <strong>{numQuestions}</strong>
              </label>
              <input
                type="range"
                min={5}
                max={30}
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-2">Difficulty</label>
              <div className="grid grid-cols-4 gap-2">
                {(['easy', 'medium', 'hard', 'mixed'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`py-2 rounded-xl text-xs font-medium capitalize transition-colors border-2 ${
                      difficulty === d
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 block mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Time Limit: <strong className="ml-1">{timeLimit} min</strong>
              </label>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={selected.length === 0 || generating}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors mb-10 ${
            selected.length > 0 && !generating
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {generating
            ? 'Generating Exam…'
            : `Generate Exam from ${selected.length} Course${selected.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
