'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function ReviewPage() {
  const params = useParams()
  const entryId = params.id as string

  const [text, setText] = useState('')
  const [message, setMessage] = useState('Loading...')

  useEffect(() => {
    const loadTranscript = async () => {
      const res = await fetch(`/api/transcript/${entryId}`)
      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Could not load transcript.')
        return
      }

      const row = data.transcript
      setText(row.confirmed_text || row.raw_ocr_text || '')
      setMessage('')
    }

    if (entryId) loadTranscript()
  }, [entryId])

  const handleConfirm = async () => {
    console.log('CLICKED')

    const { error } = await supabase
      .from('journal_transcripts')
      .update({
        confirmed_text: text,
        is_confirmed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('entry_id', entryId)

    console.log('UPDATE RESULT:', error)

    if (error) {
      setMessage(error.message)
      return
    }

    console.log('GOING TO REFLECT')

    setMessage('Generating reflection...')

    const res = await fetch('/api/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId }),
    })

    console.log('REFLECT STATUS:', res.status)

    const data = await res.json()

    console.log('REFLECT DATA:', data)

    if (!res.ok) {
      setMessage(data.error || 'Reflection failed.')
      return
    }

    window.location.href = `/reflection/${entryId}`
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Review transcript</h1>
        <p className="text-sm text-stone-600">
          Edit anything the AI read incorrectly, then confirm.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full min-h-[400px] rounded-lg border p-4"
        />

        <button
          onClick={handleConfirm}
          className="rounded-lg bg-stone-900 px-4 py-3 text-white"
        >
          Confirm transcript
        </button>

        {message && <p>{message}</p>}
      </div>
    </main>
  )
}
