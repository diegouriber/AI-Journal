'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type UploadFile = {
  file: File
  previewUrl: string | null
}

function getDisplayName(email?: string | null) {
  if (!email) return 'there'

  const prefix = email.split('@')[0].toLowerCase()

  if (prefix.includes('diego')) return 'Diego'

  const clean = prefix.split(/[._-]/)[0]
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [firstName, setFirstName] = useState('there')

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setFirstName(getDisplayName(user?.email))
    }

    loadUser()
  }, [])

  useEffect(() => {
    return () => {
      files.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [files])

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    const newFiles = selectedFiles.map((file) => ({
      file,
      previewUrl: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null,
    }))

    setFiles((prev) => [...prev, ...newFiles])
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const item = prev[index]
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const clearFiles = () => {
    files.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
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

  const handleSubmit = async () => {
    if (files.length === 0) {
      setMessage('Add at least one page before submitting.')
      return
    }

    setUploading(true)
    setMessage('Creating today’s session...')

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

      const filePath = `${user.id}/${entry.id}/${i + 1}-${Date.now()}-${file.name}`

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
      headers: { 'Content-Type': 'application/json' },
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

  return (
    <main className="calm-room min-h-screen px-6 py-10 text-[#172033]">
      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="fade-down flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#51739b]">
              Today’s Session
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-[#143c73] md:text-6xl">
              Let’s start today’s session, your introspective journey.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              Hi {firstName}. Bring in the pages from one entry, arrange them
              gently, and submit when the sequence feels true.
            </p>
          </div>

          <a
            href="/profile"
            className="w-fit rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-[#172033] shadow-sm transition hover:bg-slate-50"
          >
            Profile
          </a>
        </header>

        <section className="calm-card fade-up delay-1 mt-10 rounded-[2rem] p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#172033]">
                Bring in your pages
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                Images, PDFs, and Word files are welcome. Handwritten images are
                read with OCR; digital files can become part of the same archive.
              </p>
            </div>

            <label className="primary-button cursor-pointer rounded-full px-7 py-4 text-sm font-semibold">
              Choose files
              <input
                type="file"
                multiple
                accept="image/*,application/pdf,.doc,.docx"
                onChange={handleAddFiles}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </section>

        <section className="soft-panel fade-up delay-2 mt-7 rounded-[2rem] p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-[#172033]">
                Reading order
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Drag, reverse, or remove before submitting.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reverseFiles}
                disabled={uploading || files.length < 2}
                className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Reverse
              </button>

              <button
                type="button"
                onClick={clearFiles}
                disabled={uploading || files.length === 0}
                className="rounded-full border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="mt-7 rounded-[2rem] border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-base font-semibold text-[#172033]">
                No pages selected yet.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your selected pages will appear here before becoming part of
                your archive.
              </p>
            </div>
          ) : (
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((item, index) => (
                <div
                  key={`${item.file.name}-${index}`}
                  draggable={!uploading}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`overflow-hidden rounded-[1.75rem] border bg-white transition ${
                    draggedIndex === index
                      ? 'border-[#143c73] opacity-70'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={`Page ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-slate-500">
                        Document selected
                      </div>
                    )}

                    <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#143c73] shadow-sm">
                      Page {index + 1}
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <p className="truncate text-sm font-semibold">
                      {item.file.name}
                    </p>

                    <p className="text-xs text-slate-500">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      className="w-full rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          onClick={handleSubmit}
          disabled={uploading || files.length === 0}
          className="primary-button fade-up delay-3 mt-7 w-full rounded-full px-6 py-5 text-base font-semibold disabled:opacity-50"
        >
          {uploading
            ? 'Processing your entry...'
            : files.length === 0
              ? 'Choose pages to begin'
              : `Submit ${files.length} page${files.length === 1 ? '' : 's'} as one entry`}
        </button>

        {message && (
          <p className="mt-5 rounded-2xl bg-white p-4 text-center text-sm text-slate-600 shadow-sm">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}