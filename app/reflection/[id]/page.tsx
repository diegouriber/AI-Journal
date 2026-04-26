'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function ReflectionPage() {
  const params = useParams()
  const entryId = params.id as string

  const [text, setText] = useState('Loading...')

  useEffect(() => {
    const loadReflection = async () => {
      const res = await fetch(`/api/reflection/${entryId}`)
      const data = await res.json()

      if (!res.ok) {
        setText(data.error || 'Could not load reflection')
        return
      }

      setText(data.content)
    }

    if (entryId) loadReflection()
  }, [entryId])

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Reflection</h1>

        <div className="whitespace-pre-wrap rounded-lg border p-4">
          {text}
        </div>
      </div>
    </main>
  )
}
