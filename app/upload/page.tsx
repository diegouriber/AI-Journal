'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Mode = 'write' | 'upload'

type UploadItem = {
  file: File
  previewUrl: string | null
}

export default function UploadPage() {
  const [mode, setMode] = useState<Mode>('write')
  const [title, setTitle] = useState('')
  const [entryText, setEntryText] = useState('')
  const [files, setFiles] = useState<UploadItem[]>([])
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [firstName, setFirstName] = useState('there')

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        const name = user.email.split('@')[0].split(/[._-]/)[0]
        setFirstName(name.charAt(0).toUpperCase() + name.slice(1))
      }
    }

    loadUser()
  }, [])

  useEffect(() => {
    return () => {
      files.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl)
        }
      })
    }
  }, [files])

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

  const addFiles = (incomingFiles: FileList | File[]) => {
    const selectedFiles = Array.from(incomingFiles)

    if (selectedFiles.length === 0) return

    const newFiles = selectedFiles.map((file) => ({
      file,
      previewUrl: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null,
    }))

    setFiles((prev) => [...prev, ...newFiles])
    setMessage('')
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const itemToRemove = prev[index]

      if (itemToRemove?.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl)
      }

      return prev.filter((_, i) => i !== index)
    })
  }

  const clearFiles = () => {
    files.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
    })

    setFiles([])
  }

  const reverseFiles = () => {
    setFiles((prev) => [...prev].reverse())
  }

  const moveFile = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    setFiles((prev) => {
      const updated = [...prev]
      const [movedFile] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, movedFile)
      return updated
    })
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null) return

    moveFile(draggedIndex, dropIndex)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleWriteSubmit = async () => {
    if (!entryText.trim()) {
      setMessage('Write something first. Even one honest sentence is enough.')
      return
    }

    setUploading(true)
    setMessage('Saving your entry...')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be signed in first.')
      setUploading(false)
      return
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        source_type: 'text',
        status: 'transcribed',
      })
      .select()
      .single()

    if (entryError || !entry) {
      setMessage(entryError?.message || 'Could not create journal entry.')
      setUploading(false)
      return
    }

    const fullText = title.trim()
      ? `${title.trim()}\n\n${entryText.trim()}`
      : entryText.trim()

    const { error: transcriptError } = await supabase
      .from('journal_transcripts')
      .insert({
        entry_id: entry.id,
        raw_ocr_text: fullText,
        is_confirmed: false,
      })

    if (transcriptError) {
      setMessage(transcriptError.message)
      setUploading(false)
      return
    }

    window.location.href = `/review/${entry.id}`
  }

  const handleUploadSubmit = async () => {
    if (files.length === 0) {
      setMessage('Add at least one page before submitting your entry.')
      return
    }

    setUploading(true)
    setMessage('Creating space for this entry...')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be signed in first.')
      setUploading(false)
      return
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        source_type: 'image',
        status: 'uploaded',
      })
      .select()
      .single()

    if (entryError || !entry) {
      setMessage(entryError?.message || 'Could not create journal entry.')
      setUploading(false)
      return
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i].file

      setMessage(`Saving page ${i + 1} of ${files.length}...`)

      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const filePath = `${user.id}/${entry.id}/${i + 1}-${Date.now()}-${cleanName}`

      const { error: storageError } = await supabase.storage
        .from('journal-uploads')
        .upload(filePath, file)

      if (storageError) {
        setMessage(storageError.message)
        setUploading(false)
        return
      }

      const { error: uploadRowError } = await supabase
        .from('journal_uploads')
        .insert({
          entry_id: entry.id,
          file_path: filePath,
          page_order: i + 1,
          mime_type: file.type,
        })

      if (uploadRowError) {
        setMessage(uploadRowError.message)
        setUploading(false)
        return
      }
    }

    setMessage('Reading your pages carefully...')

    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entryId: entry.id }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'OCR failed.')
      setUploading(false)
      return
    }

    window.location.href = `/review/${entry.id}`
  }

  const handleSubmit = async () => {
    if (uploading) return

    if (mode === 'write') {
      await handleWriteSubmit()
      return
    }

    await handleUploadSubmit()
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

          <a
            href="/profile"
            className="rounded-full border border-stone-200 bg-white/70 px-4 py-2 text-sm text-stone-600 shadow-sm transition hover:bg-white"
          >
            Profile
          </a>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-stone-200 bg-white/80 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.04)] backdrop-blur">
              <p className="text-sm uppercase tracking-[0.28em] text-stone-400">
                {todayLabel}
              </p>

              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                Hi {firstName},
                <br />
                take a moment.
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
                  type="button"
                  onClick={() => setMode('write')}
                  disabled={uploading}
                  className={`flex-1 rounded-full px-5 py-3 text-sm font-medium transition md:flex-none ${
                    mode === 'write'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Write
                </button>

                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  disabled={uploading}
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

            <div className="pt-7">
              <label className="block">
                <span className="text-sm font-medium text-stone-500">
                  Title, optional
                </span>

                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={uploading}
                  placeholder={
                    mode === 'write' ? 'A quiet thought' : 'Pages from today'
                  }
                  className="mt-3 w-full border-none bg-transparent text-3xl font-semibold tracking-tight text-stone-900 outline-none placeholder:text-stone-300 disabled:opacity-60"
                />
              </label>
            </div>

            {mode === 'write' ? (
              <div className="pt-5">
                <div className="flex flex-wrap items-center gap-3 text-sm text-stone-400">
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
                    disabled={uploading}
                    placeholder="Start with the thing you keep circling around..."
                    className="min-h-[520px] w-full resize-none rounded-[2rem] border border-stone-100 bg-[#fbfaf7] px-6 py-6 text-[17px] leading-9 text-stone-800 outline-none transition placeholder:text-stone-300 focus:border-stone-300 disabled:opacity-60"
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
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (!uploading) setIsDraggingOver(true)
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDraggingOver(false)

                    if (uploading) return

                    if (e.dataTransfer.files?.length) {
                      addFiles(e.dataTransfer.files)
                    }
                  }}
                  className={`rounded-[2rem] border border-dashed p-8 text-center transition md:p-12 ${
                    isDraggingOver
                      ? 'border-stone-700 bg-stone-100'
                      : 'border-stone-300 bg-[#fbfaf7]'
                  }`}
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                    ↑
                  </div>

                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                    Upload pages you already wrote.
                  </h3>

                  <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-stone-500">
                    Drag files here or choose them manually. You can upload
                    multiple pages, preview them, reverse them, and drag them
                    into the right order.
                  </p>

                  <div className="mx-auto mt-8 max-w-md rounded-[1.5rem] border border-stone-200 bg-white p-4">
                    <input
                      type="file"
                      multiple
                      disabled={uploading}
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          addFiles(e.target.files)
                          e.target.value = ''
                        }
                      }}
                      className="w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-stone-900 file:px-4 file:py-2 file:text-sm file:text-white disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="mt-7">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-stone-700">
                        Selected pages
                      </p>
                      <p className="mt-1 text-sm text-stone-400">
                        Drag to reorder. The order below is the order sent to
                        the archive.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={reverseFiles}
                        disabled={uploading || files.length === 0}
                        className="rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
                      >
                        Reverse order
                      </button>

                      <button
                        type="button"
                        onClick={clearFiles}
                        disabled={uploading || files.length === 0}
                        className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-40"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  {files.length === 0 ? (
                    <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-8 text-center">
                      <p className="text-sm text-stone-500">
                        No pages selected yet.
                      </p>
                      <p className="mt-2 text-sm text-stone-400">
                        Once you choose images, they will appear here as preview
                        cards.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {files.map((item, index) => (
                        <div
                          key={`${item.file.name}-${item.file.size}-${item.file.lastModified}-${index}`}
                          draggable={!uploading}
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(index)}
                          onDragEnd={handleDragEnd}
                          className={`group overflow-hidden rounded-[1.5rem] border bg-white p-3 shadow-sm transition ${
                            uploading
                              ? 'cursor-default opacity-70'
                              : 'cursor-grab active:cursor-grabbing'
                          } ${
                            draggedIndex === index
                              ? 'border-stone-700 bg-stone-50 opacity-60'
                              : 'border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          <div className="relative overflow-hidden rounded-[1.15rem] bg-stone-50">
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                className="h-44 w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-44 w-full items-center justify-center px-4 text-center">
                                <div>
                                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-stone-600 shadow-sm">
                                    DOC
                                  </div>
                                  <p className="mt-3 text-sm text-stone-500">
                                    Preview not available
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-stone-700 shadow-sm">
                              Page {index + 1}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              disabled={uploading}
                              className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-stone-700 opacity-100 shadow-sm transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="px-1 pt-3">
                            <p className="truncate text-sm font-medium text-stone-800">
                              {item.file.name}
                            </p>

                            <p className="mt-1 text-xs text-stone-400">
                              {(item.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.5rem] bg-stone-50 p-5">
                    <p className="text-sm font-medium text-stone-700">
                      Multiple files
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Add several pages or documents in one entry.
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] bg-stone-50 p-5">
                    <p className="text-sm font-medium text-stone-700">
                      Reorder
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Drag pages or reverse the order before saving.
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] bg-stone-50 p-5">
                    <p className="text-sm font-medium text-stone-700">
                      Preserve first
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      The raw entry stays intact before analysis begins.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-4 border-t border-stone-100 pt-6 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-6 text-stone-500">
                {mode === 'write'
                  ? 'When you are ready, save the entry and review it before reflection.'
                  : files.length > 0
                    ? `${files.length} file${files.length === 1 ? '' : 's'} ready.`
                    : 'Upload one page or a full set of pages.'}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/profile"
                  className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm text-stone-700 transition hover:bg-stone-50"
                >
                  Back to profile
                </a>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={uploading}
                  className="rounded-full bg-stone-900 px-7 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
                >
                  {uploading
                    ? 'Processing...'
                    : mode === 'write'
                      ? 'Save entry'
                      : files.length === 0
                        ? 'Add pages to begin'
                        : `Submit ${files.length} page${
                            files.length === 1 ? '' : 's'
                          }`}
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