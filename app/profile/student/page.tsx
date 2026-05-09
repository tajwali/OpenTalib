'use client'
import { StudentProfileEditor } from '@/components/StudentProfileEditor'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function StudentProfilePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Learning Profile</h1>
            <p className="text-xs text-muted-foreground">Manage your preferences for AI-generated courses</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <StudentProfileEditor onSave={() => router.push('/dashboard')} />
        </div>
      </main>
    </div>
  )
}
