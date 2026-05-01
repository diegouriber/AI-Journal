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
    <main className="min-h-screen p-8">
      <div className="max-w-xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Upload Journal</h1>
        <p className="text-sm text-stone-600">
          Upload one or more images from the same journal entry.
        </p>

        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={handleUpload}
        />

        {message && <p>{message}</p>}
      </div>
    </main>
  )
}
