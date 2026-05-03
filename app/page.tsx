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
    <main className="atmosphere min-h-screen px-6 py-8 text-stone-900">
      <div className="rain-line left-[8%]" />
      <div className="rain-line left-[22%] animation-delay-200" />
      <div className="rain-line left-[41%]" />
      <div className="rain-line left-[67%]" />
      <div className="rain-line left-[86%]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col justify-center">
            <p className="text-sm uppercase tracking-[0.35em] text-stone-500">
              AI Journaling Tool
            </p>

            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              A quieter way to meet your own thoughts.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-700">
              Upload your handwritten pages, preserve the raw archive, and let
              the system help you notice the ideas, frictions, values, and
              principles slowly forming underneath the surface.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-stone-600 sm:grid-cols-3">
              <div className="paper-card rounded-2xl p-4">
                <p className="font-semibold text-stone-900">Write freely</p>
                <p className="mt-2 leading-6">
                  No templates. No forced prompts. Just your own words.
                </p>
              </div>

              <div className="paper-card rounded-2xl p-4">
                <p className="font-semibold text-stone-900">Reflect slowly</p>
                <p className="mt-2 leading-6">
                  Turn entries into conversations, not summaries.
                </p>
              </div>

              <div className="paper-card rounded-2xl p-4">
                <p className="font-semibold text-stone-900">Build memory</p>
                <p className="mt-2 leading-6">
                  Archive entries and extract decision principles over time.
                </p>
              </div>
            </div>
          </section>

          <section className="glass-card rounded-[2rem] p-7">
            <div className="rounded-[1.5rem] bg-stone-900 p-6 text-white">
              <p className="text-sm uppercase tracking-[0.3em] text-stone-400">
                Enter the room
              </p>

              <h2 className="mt-3 text-2xl font-semibold">
                Continue your archive.
              </h2>

              <p className="mt-3 text-sm leading-7 text-stone-300">
                This is your private space for uploading entries, reviewing
                transcripts, and turning reflection into something you can
                return to.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white/80 p-4 text-sm outline-none transition focus:border-stone-900"
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white/80 p-4 text-sm outline-none transition focus:border-stone-900"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={signUp}
                  className="rounded-2xl border border-stone-300 bg-white/70 px-4 py-4 text-sm font-medium hover:bg-white"
                >
                  Sign up
                </button>

                <button
                  onClick={signIn}
                  className="rounded-2xl bg-stone-900 px-4 py-4 text-sm font-medium text-white hover:bg-stone-800"
                >
                  Sign in
                </button>
              </div>

              {message && (
                <p className="rounded-2xl bg-white/70 p-4 text-sm text-stone-600">
                  {message}
                </p>
              )}
            </div>

            <p className="mt-6 text-center text-xs leading-6 text-stone-500">
              A notebook, a few pages, and enough honesty to see what keeps
              returning.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}