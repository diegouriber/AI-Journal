'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type UploadFile = {
  file: File
  previewUrl: string | null
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

      if (user?.email) {
        const name = user.email.split('@')[0].split('.')[0]
        setFirstName(name.charAt(0).toUpperCase() + name.slice(1))
      }
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
    <main className="white-room min-h-screen bg-[#fbfaf7] p-6 text-stone-900">
      <div className="soft-glow left-[-10rem] top-[-10rem]" />
      <div className="soft-glow bottom-[-12rem] right-[-10rem]" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-7">
        <header className="fade-down flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              Today’s Session
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              Let’s begin quietly, {firstName}.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
              Add the pages for one entry. Arrange them in the order they should
              be read. When it feels right, submit the session.
            </p>
          </div>

          <a
            href="/profile"
            className="rounded-full border border-stone-300 bg-white/75 px-5 py-2 text-sm shadow-sm backdrop-blur hover:bg-white"
          >
            Profile
          </a>
        </header>

        <section className="soft-card fade-up rounded-[2rem] p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Bring in your pages</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Images, PDFs, or Word files. Handwritten images will be read
                with OCR; digital text files can later be processed more
                directly.
              </p>
            </div>

            <label className="cursor-pointer rounded-full bg-stone-900 px-5 py-3 text-sm text-white hover:bg-stone-800">
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

        <section className="paper-card fade-up delay-1 rounded-[2rem] p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Reading order</h2>
              <p className="mt-1 text-sm text-stone-500">
                Drag, reverse, or remove before submitting.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reverseFiles}
                disabled={uploading || files.length < 2}
                className="rounded-full border px-4 py-2 text-sm hover:bg-stone-50 disabled:opacity-40"
              >
                Reverse
              </button>

              <button
                type="button"
                onClick={clearFiles}
                disabled={uploading || files.length === 0}
                className="rounded-full border px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-white/70 p-10 text-center">
              <p className="text-sm font-medium text-stone-700">
                No pages selected yet.
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Your selected pages will appear here before becoming part of
                your archive.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((item, index) => (
                <div
                  key={`${item.file.name}-${index}`}
                  draggable={!uploading}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`overflow-hidden rounded-[1.5rem] border bg-white transition ${
                    draggedIndex === index
                      ? 'border-stone-900 opacity-60'
                      : 'border-stone-200 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-stone-100">
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={`Page ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-stone-500">
                        Document selected
                      </div>
                    )}

                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium shadow-sm">
                      Page {index + 1}
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <p className="truncate text-sm font-medium">
                      {item.file.name}
                    </p>

                    <p className="text-xs text-stone-500">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      className="w-full rounded-full border px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
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
          className="fade-up delay-2 w-full rounded-full bg-stone-900 px-5 py-4 text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
        >
          {uploading
            ? 'Processing your entry...'
            : files.length === 0
              ? 'Choose pages to begin'
              : `Submit ${files.length} page${files.length === 1 ? '' : 's'} as one entry`}
        </button>

        {message && (
          <p className="rounded-2xl bg-white/80 p-4 text-center text-sm text-stone-600 shadow-sm">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}