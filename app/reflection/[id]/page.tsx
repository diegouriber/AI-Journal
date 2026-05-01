'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function ReflectionPage() {
  const params = useParams()
  const entryId = params.id as string

  const [text, setText] = useState('Loading reflection...')

  useEffect(() => {
    const loadReflection = async () => {
      const res = await fetch(`/api/reflection/${entryId}`)
      const data = await res.json()

      if (!res.ok) {
        setText(data.error || 'Could not load reflection.')
        return
      }

      setText(data.content || 'No reflection content found.')
    }

    if (entryId) loadReflection()
  }, [entryId])

  return (
    <main className="min-h-screen bg-stone-50 p-8 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Reflection</h1>

        <p className="text-sm text-stone-600">
          This reflection is based on the journal entry you just confirmed, with your previous profile used as background context.
        </p>

        <div className="whitespace-pre-wrap rounded-xl border bg-stone-50 p-5 leading-7">
          {text}
        </div>

        <a
          href="/upload"
          className="inline-block rounded-lg bg-stone-900 px-4 py-3 text-white"
        >
          Upload another entry
        </a>
      </div>
    </main>
  )
}