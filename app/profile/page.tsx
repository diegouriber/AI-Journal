'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type UserProfile = {
  display_name: string
  birthday: string
  values_text: string
  life_direction: string
  self_understanding_goal: string
  avatar_url: string
}

function getFallbackName(email?: string | null) {
  if (!email) return 'there'

  const prefix = email.split('@')[0].toLowerCase()

  if (prefix.includes('diego')) return 'Diego'

  const clean = prefix.split(/[._-]/)[0]
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export default function ProfilePage() {
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [email, setEmail] = useState('')

  const [profile, setProfile] = useState<UserProfile>({
    display_name: '',
    birthday: '',
    values_text: '',
    life_direction: '',
    self_understanding_goal: '',
    avatar_url: '',
  })

  const displayName = profile.display_name || getFallbackName(email)

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessage('You must be signed in first.')
        return
      }

      const res = await fetch('/api/user-profile', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'Could not load profile.')
        return
      }

      setEmail(data.email || '')

      if (data.profile) {
        setProfile({
          display_name: data.profile.display_name || '',
          birthday: data.profile.birthday || '',
          values_text: data.profile.values_text || '',
          life_direction: data.profile.life_direction || '',
          self_understanding_goal:
            data.profile.self_understanding_goal || '',
          avatar_url: data.profile.avatar_url || '',
        })
      }
    }

    loadProfile()
  }, [])

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true)
    setMessage('Uploading profile picture...')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      setMessage('You must be signed in first.')
      setUploadingAvatar(false)
      return
    }

    const fileExt = file.name.split('.').pop()
    const filePath = `${session.user.id}/avatar-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true,
      })

    if (uploadError) {
      setMessage(uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)

    setProfile((prev) => ({
      ...prev,
      avatar_url: data.publicUrl,
    }))

    setMessage('Profile picture uploaded. Click Save profile to keep it.')
    setUploadingAvatar(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    setMessage('Saving your profile...')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('You must be signed in first.')
      setSaving(false)
      return
    }

    const res = await fetch('/api/user-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(profile),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Could not save profile.')
      setSaving(false)
      return
    }

    setMessage('Profile saved.')
    setSaving(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('last_login_at')
    window.location.href = '/'
  }

  const downloadFile = async (url: string, filename: string) => {
    setMessage('Preparing your file...')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('You must be signed in first.')
      return
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!res.ok) {
      const data = await res.json()
      setMessage(data.error || 'Download failed.')
      return
    }

    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()

    window.URL.revokeObjectURL(downloadUrl)

    setMessage('Download ready.')
  }

  const deleteProfileData = async () => {
    const confirmed = window.confirm(
      'Are you sure? This will permanently delete your journal archive, reflections, profile signals, and decision principles.\n\nThis cannot be undone.'
    )

    if (!confirmed) return

    setDeleting(true)
    setMessage('Deleting your archive and principles...')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('You must be signed in first.')
      setDeleting(false)
      return
    }

    const res = await fetch('/api/profile/delete', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'Delete failed.')
      setDeleting(false)
      return
    }

    setMessage('Archive and principles deleted.')
    setDeleting(false)
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 text-stone-900">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-400">
            Personal Archive
          </p>

          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
                Hi {displayName}, this is where your thinking accumulates.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600">
                Your raw entries are preserved as an archive. Your principles
                are extracted as a living decision framework. This page is where
                your writing becomes something you can revisit, export, and
                build from.
              </p>
            </div>

            <div className="flex justify-center md:justify-end">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile picture"
                  className="h-28 w-28 rounded-full border border-stone-200 object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-stone-900 text-4xl font-semibold text-white shadow-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/upload"
              className="rounded-full bg-stone-900 px-5 py-3 text-sm text-white hover:bg-stone-800"
            >
              Upload new entry
            </a>

            <button
              onClick={signOut}
              className="rounded-full border border-stone-300 px-5 py-3 text-sm text-stone-700 hover:bg-stone-100"
            >
              Sign out
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
          <p className="text-sm font-medium text-stone-500">
            Tell me more about yourself
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            Give the reflections better context.
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
            These details help the system reflect with more precision. Keep them
            simple. You can change them anytime.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Name</span>
              <input
                value={profile.display_name}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
                placeholder="Diego"
                className="w-full rounded-2xl border border-stone-200 bg-white p-4 text-sm outline-none focus:border-stone-700"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Birthday</span>
              <input
                type="date"
                value={profile.birthday}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    birthday: e.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-stone-200 bg-white p-4 text-sm outline-none focus:border-stone-700"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">
                What do you value most?
              </span>
              <textarea
                value={profile.values_text}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    values_text: e.target.value,
                  }))
                }
                placeholder="Example: clarity, family, courage, freedom, impact..."
                className="min-h-[100px] w-full rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 outline-none focus:border-stone-700"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">
                What kind of life are you trying to build?
              </span>
              <textarea
                value={profile.life_direction}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    life_direction: e.target.value,
                  }))
                }
                placeholder="A short description of the direction you want your life to move toward."
                className="min-h-[100px] w-full rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 outline-none focus:border-stone-700"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">
                What do you want this journal to help you understand?
              </span>
              <textarea
                value={profile.self_understanding_goal}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    self_understanding_goal: e.target.value,
                  }))
                }
                placeholder="Example: my recurring patterns, what I actually want, why I avoid certain decisions..."
                className="min-h-[100px] w-full rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 outline-none focus:border-stone-700"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">Profile picture</span>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadAvatar(file)
                }}
                className="w-full rounded-2xl border border-stone-200 bg-white p-4 text-sm outline-none focus:border-stone-700"
              />

              {uploadingAvatar && (
                <p className="text-sm text-stone-500">Uploading...</p>
              )}

              {profile.avatar_url && (
                <p className="text-sm text-stone-500">
                  Profile picture ready. Click Save profile to keep it.
                </p>
              )}
            </label>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="mt-6 rounded-full bg-stone-900 px-5 py-3 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-800">
              W
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Raw Journal Archive
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              Download the full raw archive of your journal entries as a Word
              document. This is the source material: your actual writing,
              preserved chronologically.
            </p>

            <button
              onClick={() =>
                downloadFile('/api/export/archive', 'raw-journal-archive.docx')
              }
              className="mt-6 w-full rounded-2xl bg-stone-900 px-4 py-3 text-white hover:bg-stone-800"
            >
              Download Word Archive
            </button>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-800">
              X
            </div>

            <h2 className="mt-5 text-xl font-semibold">
              Decision Principles
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              Download the principles extracted from your entries as an Excel
              file. These are the values, rules, tensions, and decision patterns
              that begin to form your personal framework.
            </p>

            <button
              onClick={() =>
                downloadFile(
                  '/api/export/principles',
                  'decision-principles.xlsx'
                )
              }
              className="mt-6 w-full rounded-2xl border px-4 py-3 hover:bg-stone-50"
            >
              Download Principles Excel
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-900">Danger zone</h2>

          <p className="mt-2 text-sm leading-6 text-red-800">
            Delete your saved journal archive, reflections, profile signals, and
            decision principles. This action cannot be undone.
          </p>

          <button
            onClick={deleteProfileData}
            disabled={deleting}
            className="mt-5 rounded-2xl bg-red-700 px-5 py-3 text-white hover:bg-red-800 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Archive and Principles'}
          </button>
        </section>

        {message && (
          <p className="rounded-2xl bg-white p-4 text-sm text-stone-700 shadow-sm">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}