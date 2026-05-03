'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ProfilePage() {
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [firstName, setFirstName] = useState('there')

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        const name = user.email.split('@')[0].split('.')[0]
        setFirstName(name.charAt(0).toUpperCase() + name.slice(1))
      }
    }

    loadUser()
  }, [])

  const downloadFile = async (url: string, filename: string) => {
    setMessage('Preparing your file...')

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
    <main className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50 to-stone-100 p-6 text-stone-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-stone-200 bg-white/85 p-8 shadow-sm backdrop-blur">
          <p className="text-sm uppercase tracking-[0.25em] text-stone-500">
            Personal Archive
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Hi {firstName}, this is where your thinking accumulates.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            Your raw entries are preserved as an archive. Your principles are
            extracted as a living decision framework. This page is where your
            writing becomes something you can revisit, export, and build from.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/upload"
              className="rounded-full bg-stone-900 px-5 py-3 text-sm text-white hover:bg-stone-800"
            >
              Upload new entry
            </a>

            <a
              href="/"
              className="rounded-full border px-5 py-3 text-sm hover:bg-stone-50"
            >
              Back to home
            </a>
          </div>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm backdrop-blur">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-white">
              W
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Raw Journal Archive
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              Download the full raw archive of your journal entries as a Word
              document. This is the source material: your actual writing,
              preserved chronologically.
            </p>

            <button
              onClick={() =>
                downloadFile('/api/export/archive', 'raw-journal-archive.docx')
              }
              className="mt-6 w-full rounded-2xl bg-stone-900 px-4 py-3 text-white hover:bg-stone-800"
            >
              Download Word Archive
            </button>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm backdrop-blur">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-200 text-stone-900">
              X
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Decision Principles
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              Download the principles extracted from your entries as an Excel
              file. These are the values, rules, tensions, and decision patterns
              that begin to form your personal framework.
            </p>

            <button
              onClick={() =>
                downloadFile(
                  '/api/export/principles',
                  'decision-principles.xlsx'
                )
              }
              className="mt-6 w-full rounded-2xl border px-4 py-3 hover:bg-stone-50"
            >
              Download Principles Excel
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-stone-900 p-8 text-white shadow-sm">
          <p className="text-sm uppercase tracking-[0.25em] text-stone-400">
            What this profile is for
          </p>

          <div className="mt-5 grid gap-5 text-sm leading-7 text-stone-200 md:grid-cols-3">
            <p>
              To preserve what you actually wrote, not just what you remember
              writing.
            </p>

            <p>
              To help identify patterns that repeat across entries and slowly
              become part of your self-knowledge.
            </p>

            <p>
              To turn reflection into something practical: principles that can
              guide future decisions.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-900">Danger zone</h2>

          <p className="mt-2 text-sm leading-6 text-red-800">
            Delete your saved journal archive, reflections, profile signals, and
            decision principles. This action cannot be undone.
          </p>

          <button
            onClick={deleteProfileData}
            disabled={deleting}
            className="mt-5 rounded-2xl bg-red-700 px-5 py-3 text-white hover:bg-red-800 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Archive and Principles'}
          </button>
        </section>

        {message && (
          <p className="rounded-2xl bg-white/85 p-4 text-sm text-stone-700 shadow-sm">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}