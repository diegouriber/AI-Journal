'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function UploadPage() {
  const [message, setMessage] = useState('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('You must be signed in first.')
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
      return
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const filePath = `${user.id}/${entry.id}/${i + 1}-${Date.now()}-${file.name}`

      const { error: storageError } = await supabase.storage
        .from('journal-uploads')
        .upload(filePath, file)

      if (storageError) {
        setMessage(storageError.message)
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
      return
    }

    window.location.href = `/review/${entry.id}`
  }

  return (
    <main className="min-h-screen bg-stone-50 p-8 text-stone-900">
      <div className="mx-auto max-w-xl space-y-6 rounded-2xl border bg-white p-8 shadow-sm">
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
          Upload one or more images from the same journal entry. The AI will
          read them, create a transcript, and then guide you to review it before
          generating a reflection.
        </p>

        <div className="rounded-xl border border-dashed p-6">
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={handleUpload}
          />
        </div>

        {message && (
          <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-700">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}
