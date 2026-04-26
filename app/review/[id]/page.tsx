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
      const { data, error } = await supabase
        .from('journal_transcripts')
        .select('id, raw_ocr_text, confirmed_text, is_confirmed, created_at')
        .eq('entry_id', entryId)
        .order('created_at', { ascending: true })
        .limit(1)

      if (error) {
        setMessage(error.message)
        return
      }

      if (!data || data.length === 0) {
        setMessage('No transcript found for this entry.')
        return
      }

      const row = data[0]
      setText(row.confirmed_text || row.raw_ocr_text || '')
      setMessage('')
    }

    if (entryId) loadTranscript()
  }, [entryId])

  const handleConfirm = async () => {
    const { error } = await supabase
      .from('journal_transcripts')
      .update({
        confirmed_text: text,
        is_confirmed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('entry_id', entryId)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Transcript confirmed and saved.')
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
