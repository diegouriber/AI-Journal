'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])

    if (selectedFiles.length === 0) return

    setFiles((prev) => [...prev, ...selectedFiles])

    // allows selecting the same file again if needed
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const moveFileUp = (index: number) => {
    if (index === 0) return

    setFiles((prev) => {
      const newFiles = [...prev]
      const temp = newFiles[index - 1]
      newFiles[index - 1] = newFiles[index]
      newFiles[index] = temp
      return newFiles
    })
  }

  const moveFileDown = (index: number) => {
    if (index === files.length - 1) return

    setFiles((prev) => {
      const newFiles = [...prev]
      const temp = newFiles[index + 1]
      newFiles[index + 1] = newFiles[index]
      newFiles[index] = temp
      return newFiles
    })
  }

  const handleSubmit = async () => {
    if (files.length === 0) {
      setMessage('Add at least one file before submitting.')
      return
    }

    setUploading(true)
    setMessage('Creating journal entry...')

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
      const file = files[i]

      setMessage(`Uploading page ${i + 1} of ${files.length}...`)

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

    setMessage('Upload successful. Reading your journal...')

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
    <main className="min-h-screen bg-stone-50 p-8 text-stone-900">
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Upload Journal</h1>

          <a
            href="/profile"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-stone-50"
          >
            Profile / Downloads
          </a>
        </div>

        <p className="text-sm leading-6 text-stone-600">
          Add your journal pages in the order they should be read. You can add
          files one by one or select multiple at once, then review the order
          before submitting.
        </p>

        <div className="rounded-xl border border-dashed p-6">
          <label className="block text-sm font-medium">
            Choose journal pages
          </label>

          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={handleAddFiles}
            disabled={uploading}
            className="mt-3"
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold">Files uploaded in order</h2>

            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Page {index + 1}
                    </p>
                    <p className="truncate text-sm text-stone-600">
                      {file.name}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => moveFileUp(index)}
                      disabled={index === 0 || uploading}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                    >
                      Up
                    </button>

                    <button
                      type="button"
                      onClick={() => moveFileDown(index)}
                      disabled={index === files.length - 1 || uploading}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                    >
                      Down
                    </button>

                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      className="rounded border px-2 py-1 text-xs text-red-700 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={uploading || files.length === 0}
          className="w-full rounded-lg bg-stone-900 px-4 py-3 text-white disabled:opacity-50"
        >
          {uploading ? 'Processing...' : 'Submit Journal Entry'}
        </button>

        {message && (
          <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-700">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}