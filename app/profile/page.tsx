'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ProfilePage() {
  const [message, setMessage] = useState('')

  const downloadFile = async (url: string, filename: string) => {
    setMessage('Preparing download...')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('You must be signed in first.')
      return
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!res.ok) {
      const data = await res.json()
      setMessage(data.error || 'Download failed.')
      return
    }

    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()

    window.URL.revokeObjectURL(downloadUrl)
    setMessage('Download ready.')
  }

  return (
    <main className="min-h-screen bg-stone-50 p-8 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">User Profile</h1>

        <p className="text-sm leading-6 text-stone-600">
          Download your accumulated raw journal archive and the decision
          principles extracted from your entries.
        </p>

        <div className="space-y-3">
          <button
            onClick={() =>
              downloadFile('/api/export/archive', 'raw-journal-archive.docx')
            }
            className="w-full rounded-lg bg-stone-900 px-4 py-3 text-white"
          >
            Download Raw Journal Archive (.docx)
          </button>

          <button
            onClick={() =>
              downloadFile(
                '/api/export/principles',
                'decision-principles.xlsx'
              )
            }
            className="w-full rounded-lg border px-4 py-3"
          >
            Download Decision Principles (.xlsx)
          </button>
        </div>

        {message && <p className="text-sm text-stone-600">{message}</p>}

        <a href="/upload" className="inline-block text-sm underline">
          Upload another entry
        </a>
      </div>
    </main>
  )
}
