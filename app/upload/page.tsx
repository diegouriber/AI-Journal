'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function UploadPage() {
  const [message, setMessage] = useState('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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

    const filePath = `${user.id}/${entry.id}/${Date.now()}-${file.name}`

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
        page_order: 1,
        mime_type: file.type,
      })

    if (uploadRowError) {
      setMessage(uploadRowError.message)
      return
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
        <input type="file" accept="image/*,application/pdf" onChange={handleUpload} />
        {message && <p>{message}</p>}
      </div>
    </main>
  )
}
