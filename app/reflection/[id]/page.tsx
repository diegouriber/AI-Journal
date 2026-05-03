'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type ChatMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export default function ReflectionPage() {
  const params = useParams()
  const entryId = params.id as string

  const [openingReflection, setOpeningReflection] = useState(
    'Loading reflection...'
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const loadReflection = async () => {
      const res = await fetch(`/api/reflection/${entryId}`)
      const data = await res.json()

      if (!res.ok) {
        setOpeningReflection(data.error || 'Could not load reflection.')
        return
      }

      setOpeningReflection(data.content || 'No reflection content found.')
    }

    const loadMessages = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setStatus('You must be signed in to continue the discussion.')
        return
      }

      const res = await fetch(`/api/chat-reflection?entryId=${entryId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus(data.error || 'Could not load discussion.')
        return
      }

      setMessages(data.messages || [])
    }

    if (entryId) {
      loadReflection()
      loadMessages()
    }
  }, [entryId])

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')
    setSending(true)
    setStatus('Thinking with you...')

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
      },
    ])

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setStatus('You must be signed in first.')
      setSending(false)
      return
    }

    const res = await fetch('/api/chat-reflection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        entryId,
        message: userMessage,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setStatus(data.error || 'Could not continue reflection.')
      setSending(false)
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: data.assistantMessage,
      },
    ])

    setStatus('')
    setSending(false)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50 to-stone-100 p-6 text-stone-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-stone-200 bg-white/85 p-8 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-stone-500">
                Reflection
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Continue the conversation with yourself.
              </h1>
            </div>

            <a
              href="/profile"
              className="rounded-full border px-5 py-2 text-sm hover:bg-stone-50"
            >
              Profile / Downloads
            </a>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            This starts from the entry you just confirmed. The point is not to
            get a perfect answer, but to stay with the ideas, tensions, and
            questions that appeared in your writing.
          </p>
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm backdrop-blur">
          <p className="text-sm font-medium text-stone-500">
            Opening reflection
          </p>

          <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-stone-50 p-5 text-sm leading-7 text-stone-800">
            {openingReflection}
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white/85 p-7 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Go deeper</h2>

            <a href="/upload" className="text-sm underline">
              Upload another entry
            </a>
          </div>

          <div className="mt-5 space-y-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed p-5 text-sm leading-7 text-stone-600">
                Start anywhere. Push back, clarify, ask what this says about
                you, or tell the system which part feels most true.
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`rounded-2xl p-4 text-sm leading-7 ${
                  message.role === 'user'
                    ? 'ml-auto max-w-[85%] bg-stone-900 text-white'
                    : 'mr-auto max-w-[85%] bg-amber-50 text-stone-900'
                }`}
              >
                <p className="mb-2 text-xs uppercase tracking-[0.2em] opacity-60">
                  {message.role === 'user' ? 'You' : 'Reflection'}
                </p>

                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Respond freely. What feels true, uncomfortable, unfinished, or worth exploring?"
              className="min-h-[120px] w-full rounded-2xl border p-4 text-sm leading-6"
              disabled={sending}
            />

            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="w-full rounded-2xl bg-stone-900 px-5 py-4 text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {sending ? 'Thinking...' : 'Continue reflection'}
            </button>

            {status && (
              <p className="rounded-2xl bg-stone-100 p-3 text-sm text-stone-700">
                {status}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}