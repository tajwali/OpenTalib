'use client'
import { StudentProfileEditor } from '@/components/StudentProfileEditor'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'

function ProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId') ?? undefined

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Learning Profile</h1>
            <p className="text-xs text-muted-foreground">
              {userId ? 'Manage student learning preferences' : 'Manage your preferences for AI-generated courses'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <StudentProfileEditor userId={userId} onSave={() => router.back()} />
        </div>
      </main>
    </div>
  )
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <ProfileContent />
    </Suspense>
  )
}
