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
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl)
        }
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
      const itemToRemove = prev[index]

      if (itemToRemove?.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl)
      }

      return prev.filter((_, i) => i !== index)
    })
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
    <main className="atmosphere min-h-screen p-6 text-stone-900">
      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-stone-500">
              Introspective Pathway
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Hi {firstName}, bring today’s pages into the room.
            </h1>
          </div>

          <a
            href="/profile"
            className="rounded-full border border-stone-300 bg-white/70 px-5 py-2 text-sm shadow-sm backdrop-blur hover:bg-white"
          >
            Profile / Downloads
          </a>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="glass-card rounded-[2rem] p-7">
            <p className="text-sm font-medium text-stone-500">
              One entry, many pages.
            </p>

            <h2 className="mt-3 text-2xl font-semibold leading-tight">
              Add the pages from one journal session and arrange them in the
              order they should be read.
            </h2>

            <p className="mt-4 text-sm leading-7 text-stone-600">
              The images stay here first. Nothing is submitted until you decide.
              Use the preview cards to confirm what you selected, drag pages
              into order, reverse them if your camera roll came backwards, and
              then submit the full entry.
            </p>

            <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-white/60 p-6">
              <label className="block text-sm font-semibold">
                Choose journal pages
              </label>

              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleAddFiles}
                disabled={uploading}
                className="mt-4 block w-full text-sm"
              />

              <p className="mt-4 text-xs leading-5 text-stone-500">
                You can add more files later. They will be appended to the
                current list.
              </p>
            </div>

            <div className="mt-6 rounded-3xl bg-stone-900 p-6 text-white">
              <p className="text-sm uppercase tracking-[0.25em] text-stone-400">
                Before submitting
              </p>

              <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-200">
                <li>1. Make sure every page belongs to the same entry.</li>
                <li>2. Check the image previews.</li>
                <li>3. Drag or reverse the order if needed.</li>
                <li>4. Submit only when the sequence feels right.</li>
              </ul>
            </div>

            {message && (
              <p className="mt-5 rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white">
                {message}
              </p>
            )}
          </div>

          <div className="paper-card rounded-[2rem] p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-stone-500">
                  Selected pages
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  Reading order
                </h2>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reverseFiles}
                  disabled={uploading || files.length < 2}
                  className="rounded-full border px-4 py-2 text-sm hover:bg-stone-50 disabled:opacity-40"
                >
                  Reverse order
                </button>

                <button
                  type="button"
                  onClick={() => setFiles([])}
                  disabled={uploading || files.length === 0}
                  className="rounded-full border px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  Clear all
                </button>
              </div>
            </div>

            {files.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed p-10 text-center">
                <p className="text-sm font-medium text-stone-600">
                  No pages selected yet.
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  Once you choose images, they will appear here as preview cards.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {files.map((item, index) => (
                  <div
                    key={`${item.file.name}-${index}`}
                    draggable={!uploading}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`group overflow-hidden rounded-3xl border transition ${
                      draggedIndex === index
                        ? 'border-stone-900 bg-amber-50 opacity-70'
                        : 'border-stone-200 bg-white hover:-translate-y-0.5 hover:shadow-md'
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-stone-100">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={`Page ${index + 1} preview`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-stone-500">
                          PDF / document preview unavailable
                        </div>
                      )}

                      <div className="absolute left-3 top-3 rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white shadow">
                        Page {index + 1}
                      </div>

                      <div className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1 text-xs text-stone-700 shadow backdrop-blur">
                        Drag
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <div>
                        <p className="truncate text-sm font-semibold">
                          {item.file.name}
                        </p>

                        <p className="mt-1 text-xs text-stone-500">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        disabled={uploading}
                        className="w-full rounded-full border px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove page
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <button
          onClick={handleSubmit}
          disabled={uploading || files.length === 0}
          className="w-full rounded-3xl bg-stone-900 px-5 py-5 text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-50"
        >
          {uploading
            ? 'Processing your entry...'
            : files.length === 0
              ? 'Add pages to begin'
              : `Submit ${files.length} page${files.length === 1 ? '' : 's'} as one journal entry`}
        </button>
      </div>
    </main>
  )
}