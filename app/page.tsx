'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Account created. Now sign in.')
    }
  }

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Signed in successfully.')
      window.location.href = '/upload'
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">AI Journaling Tool</h1>
        <p className="text-sm text-stone-600">
          Create an account or sign in.
        </p>

        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border p-3"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border p-3"
        />

        <div className="flex gap-3">
          <button
            onClick={signUp}
            className="flex-1 rounded-lg border px-4 py-3"
          >
            Sign up
          </button>

          <button
            onClick={signIn}
            className="flex-1 rounded-lg bg-stone-900 px-4 py-3 text-white"
          >
            Sign in
          </button>
        </div>

        {message && <p className="text-sm text-stone-600">{message}</p>}
      </div>
    </main>
  )
}