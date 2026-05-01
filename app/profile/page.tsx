'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ProfilePage() {
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)

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

  const deleteProfileData = async () => {
    const confirmed = window.confirm(
      'Are you sure? This will permanently delete your journal archive, reflections, profile signals, and decision principles. This cannot be undone.'
    )

    if (!confirmed) return

    setDeleting(true)
    setMessage('Deleting your archive and principles...')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('You must be signed in first.')
      setDeleting(false)
      return
    }

    const res = await fetch('/api/profile/delete', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Delete failed.')
      setDeleting(false)
      return
    }

    setMessage('Archive and principles deleted.')
    setDeleting(false)
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

        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-900">Danger zone</h2>
          <p className="mt-1 text-sm text-red-800">
            Delete your saved journal archive, reflections, profile signals, and
            decision principles. This action cannot be undone.
          </p>

          <button
            onClick={deleteProfileData}
            disabled={deleting}
            className="mt-4 rounded-lg bg-red-700 px-4 py-3 text-white disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Archive and Principles'}
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