'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TEN_MINUTES = 10 * 60 * 1000

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('Checking session...')

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const lastLogin = localStorage.getItem('last_login_at')
      const now = Date.now()

      if (session && lastLogin) {
        const elapsed = now - Number(lastLogin)

        if (elapsed < TEN_MINUTES) {
          window.location.href = '/upload'
          return
        }

        await supabase.auth.signOut()
        localStorage.removeItem('last_login_at')
        setMessage('Session expired. Please sign in again.')
        return
      }

      if (session && !lastLogin) {
        localStorage.setItem('last_login_at', String(now))
        window.location.href = '/upload'
        return
      }

      setMessage('')
    }

    checkSession()
  }, [])

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    localStorage.setItem('last_login_at', String(Date.now()))
    setMessage('Account created. Now sign in.')
  }

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    localStorage.setItem('last_login_at', String(Date.now()))
    window.location.href = '/upload'
  }

  return (
    <main className="soft-room min-h-screen px-6 py-8 text-stone-900">
      <div className="soft-light left-[-8rem] top-[-8rem]" />
      <div className="soft-light bottom-[-10rem] right-[-8rem]" />

      <div className="rain-thread left-[12%]" />
      <div className="rain-thread left-[33%] delay-1" />
      <div className="rain-thread left-[61%] delay-2" />
      <div className="rain-thread left-[84%] delay-3" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="flex flex-col justify-center">
            <p className="fade-down text-xs uppercase tracking-[0.32em] text-stone-500">
              Introspective Pathway
            </p>

            <h1 className="fade-down delay-1 mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-stone-950 md:text-6xl">
              A quiet place to meet what you have been carrying.
            </h1>

            <p className="fade-up delay-2 mt-6 max-w-2xl text-base leading-8 text-stone-650">
              Get a notebook, a pen, or the pages you already wrote. This space
              is not here to judge your thoughts or turn them into perfect
              answers. It is here to help you preserve them, sit with them, and
              slowly understand what keeps returning.
            </p>

            <div className="fade-up delay-3 mt-8 max-w-xl rounded-3xl border border-stone-200 bg-white/62 p-5 text-sm leading-7 text-stone-600">
              Today is about you. Write about personal experiences, memories,
              contradictions, ambitions, fears, ideas, or the strange little
              things that seem to follow you. The point is not performance. The
              point is attention.
            </div>
          </section>

          <section className="quiet-card fade-up delay-2 rounded-[2rem] p-7">
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
              Enter
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Continue your journal.
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              Sign in to upload your pages, build your archive, and continue
              the conversation with yourself.
            </p>

            <div className="mt-6 space-y-4">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-stone-700"
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-stone-700"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={signUp}
                  className="rounded-2xl border border-stone-300 bg-white px-4 py-4 text-sm font-medium transition hover:bg-stone-50"
                >
                  Sign up
                </button>

                <button
                  onClick={signIn}
                  className="rounded-2xl bg-stone-900 px-4 py-4 text-sm font-medium text-white transition hover:bg-stone-800"
                >
                  Sign in
                </button>
              </div>

              {message && (
                <p className="rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                  {message}
                </p>
              )}
            </div>

            <p className="mt-6 border-t border-stone-200 pt-5 text-xs leading-6 text-stone-500">
              Your archive becomes more useful with time. Every entry adds one
              more piece to the larger conversation.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}