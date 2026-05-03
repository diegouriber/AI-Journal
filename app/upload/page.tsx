'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Mode = 'write' | 'upload'

export default function UploadPage() {
  const router = useRouter()

  const [mode, setMode] = useState<Mode>('write')
  const [title, setTitle] = useState('')
  const [entryText, setEntryText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const wordCount = useMemo(() => {
    return entryText.trim() ? entryText.trim().split(/\s+/).length : 0
  }, [entryText])

  const estimatedMinutes = useMemo(() => {
    if (!wordCount) return 0
    return Math.max(1, Math.ceil(wordCount / 180))
  }, [wordCount])

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat('en', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date())
  }, [])

  const handleSubmit = async () => {
    setLoading(true)
    setMessage('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('You must be signed in first.')
      setLoading(false)
      return
    }

    const formData = new FormData()

    if (mode === 'upload') {
      if (!selectedFile) {
        setMessage('Choose a file first.')
        setLoading(false)
        return
      }

      formData.append('file', selectedFile)
    }

    if (mode === 'write') {
      if (!entryText.trim()) {
        setMessage('Write something first. Even one honest sentence is enough.')
        setLoading(false)
        return
      }

      const safeTitle =
        title.trim().replace(/[^a-zA-Z0-9-_ ]/g, '') || 'journal-entry'

      const textFile = new File([entryText], `${safeTitle}.txt`, {
        type: 'text/plain',
      })

      formData.append('file', textFile)
      formData.append('typed_entry', 'true')
      formData.append('entry_title', title.trim())
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Something went wrong.')
        setLoading(false)
        return
      }

      setMessage('Entry saved.')

      if (data.entryId) {
        router.push(`/review/${data.entryId}`)
        return
      }

      router.push('/profile')
    } catch (error) {
      setMessage('Something went wrong while saving your entry.')
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#faf9f6] px-5 py-6 text-stone-900 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between">
          <a
            href="/"
            className="text-sm font-medium tracking-[0.22em] text-stone-500"
          >
            AI — Journal
          </a>

          <nav className="flex items-center gap-3">
            <a
              href="/profile"
              className="rounded-full border border-stone-200 bg-white/70 px-4 py-2 text-sm text-stone-600 shadow-sm transition hover:bg-white"
            >
              Profile
            </a>
          </nav>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-stone-200 bg-white/80 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.04)] backdrop-blur">
              <p className="text-sm uppercase tracking-[0.28em] text-stone-400">
                {todayLabel}
              </p>

              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                Take a moment.
                <br />
                Put it somewhere.
              </h1>

              <p className="mt-5 text-base leading-8 text-stone-600">
                This does not need to be beautiful. It does not need to be
                complete. Just write what is present, while it is still close.
              </p>

              <div className="mt-7 rounded-[1.5rem] bg-stone-50 p-5">
                <p className="text-sm leading-7 text-stone-500">
                  A thought becomes easier to understand once it stops living
                  only in your head.
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-stone-200 bg-white/70 p-6 shadow-sm">
              <p className="text-sm font-medium text-stone-500">
                Gentle prompts
              </p>

              <div className="mt-4 space-y-3">
                <p className="rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                  What has been quietly taking space in your mind?
                </p>

                <p className="rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                  What are you avoiding because it feels too obvious?
                </p>

                <p className="rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                  What do you already know, but have not admitted clearly?
                </p>
              </div>
            </div>
          </aside>

          <section className="rounded-[2.5rem] border border-stone-200 bg-white p-5 shadow-[0_24px_90px_rgba(0,0,0,0.05)] md:p-8">
            <div className="flex flex-col gap-5 border-b border-stone-100 pb-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-stone-400">
                  New entry
                </p>

                <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                  Write freely.
                </h2>
              </div>

              <div className="inline-flex w-full rounded-full border border-stone-200 bg-stone-50 p-1 md:w-auto">
                <button
                  onClick={() => setMode('write')}
                  className={`flex-1 rounded-full px-5 py-3 text-sm font-medium transition md:flex-none ${
                    mode === 'write'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Write
                </button>

                <button
                  onClick={() => setMode('upload')}
                  className={`flex-1 rounded-full px-5 py-3 text-sm font-medium transition md:flex-none ${
                    mode === 'upload'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Upload
                </button>
              </div>
            </div>

            {mode === 'write' ? (
              <div className="pt-7">
                <label className="block">
                  <span className="text-sm font-medium text-stone-500">
                    Title, optional
                  </span>

                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="A quiet thought"
                    className="mt-3 w-full border-none bg-transparent text-3xl font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-300"
                  />
                </label>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-stone-400">
                  <span>{wordCount} words</span>
                  <span>·</span>
                  <span>
                    {estimatedMinutes
                      ? `${estimatedMinutes} min read`
                      : 'Start anywhere'}
                  </span>
                  <span>·</span>
                  <span>Saved to your archive after submission</span>
                </div>

                <label className="mt-8 block">
                  <textarea
                    value={entryText}
                    onChange={(e) => setEntryText(e.target.value)}
                    placeholder="Start with the thing you keep circling around..."
                    className="min-h-[520px] w-full resize-none rounded-[2rem] border border-stone-100 bg-[#fbfaf7] px-6 py-6 text-[17px] leading-9 text-stone-800 outline-none transition placeholder:text-stone-300 focus:border-stone-300"
                  />
                </label>

                <div className="mt-6 rounded-[1.5rem] bg-stone-50 px-5 py-4">
                  <p className="text-sm leading-7 text-stone-500">
                    You can write messy. The system can organize later. Your job
                    is only to be honest enough that something real gets
                    captured.
                  </p>
                </div>
              </div>
            ) : (
              <div className="pt-7">
                <div className="rounded-[2rem] border border-dashed border-stone-300 bg-[#fbfaf7] p-8 text-center md:p-12">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                    ↑
                  </div>

                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                    Upload pages you already wrote.
                  </h3>

                  <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-stone-500">
                    Add screenshots, scans, PDFs, Word documents, or text files.
                    Keep the archive alive without rewriting everything.
                  </p>

                  <div className="mx-auto mt-8 max-w-md rounded-[1.5rem] border border-stone-200 bg-white p-4">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setSelectedFile(file)
                      }}
                      className="w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-stone-900 file:px-4 file:py-2 file:text-sm file:text-white"
                    />
                  </div>

                  {selectedFile && (
                    <div className="mx-auto mt-5 max-w-md rounded-2xl bg-white px-4 py-3 text-sm text-stone-600 shadow-sm">
                      Selected:{' '}
                      <span className="font-medium text-stone-800">
                        {selectedFile.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.5rem] bg-stone-50 p-5">
                    <p className="text-sm font-medium text-stone-700">
                      Good for
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Old journal pages, reflections, handwritten notes, and
                      documents.
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] bg-stone-50 p-5">
                    <p className="text-sm font-medium text-stone-700">
                      Supported
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      PDF, DOC, DOCX, TXT, PNG, JPG, and JPEG files.
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] bg-stone-50 p-5">
                    <p className="text-sm font-medium text-stone-700">
                      Purpose
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Preserve the raw entry first. Extract meaning second.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-4 border-t border-stone-100 pt-6 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-6 text-stone-500">
                {mode === 'write'
                  ? 'When you are ready, save the entry and let the reflection begin.'
                  : 'When the file is ready, upload it into your archive.'}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/profile"
                  className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm text-stone-700 transition hover:bg-stone-50"
                >
                  Back to profile
                </a>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
                >
                  {loading
                    ? 'Saving...'
                    : mode === 'write'
                    ? 'Save entry'
                    : 'Upload entry'}
                </button>
              </div>
            </div>

            {message && (
              <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                {message}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  )
}