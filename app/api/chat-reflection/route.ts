import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) return null

  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token)

  return user
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const entryId = searchParams.get('entryId')

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    const { data: entry } = await supabaseAdmin
      .from('journal_entries')
      .select('id, user_id')
      .eq('id', entryId)
      .single()

    if (!entry || entry.user_id !== user.id) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const { data: messages, error } = await supabaseAdmin
      .from('reflection_messages')
      .select('id, role, content, created_at')
      .eq('entry_id', entryId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { entryId, message } = await req.json()

    if (!entryId || !message) {
      return NextResponse.json(
        { error: 'Missing entryId or message' },
        { status: 400 }
      )
    }

    const { data: entry } = await supabaseAdmin
      .from('journal_entries')
      .select('id, user_id, created_at')
      .eq('id', entryId)
      .single()

    if (!entry || entry.user_id !== user.id) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const { data: transcriptRows } = await supabaseAdmin
      .from('journal_transcripts')
      .select('confirmed_text, raw_ocr_text')
      .eq('entry_id', entryId)
      .limit(1)

    const transcript =
      transcriptRows?.[0]?.confirmed_text ||
      transcriptRows?.[0]?.raw_ocr_text ||
      ''

    const { data: reflectionRows } = await supabaseAdmin
      .from('journal_reflections')
      .select('content')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false })
      .limit(1)

    const openingReflection = reflectionRows?.[0]?.content || ''

    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select(
        'display_name, birthday, values_text, life_direction, self_understanding_goal'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: previousMessages } = await supabaseAdmin
      .from('reflection_messages')
      .select('role, content, created_at')
      .eq('entry_id', entryId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(30)

    const { data: profileSignals } = await supabaseAdmin
      .from('profile_signals')
      .select('signal_type, signal_text, strength')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const { data: principles } = await supabaseAdmin
      .from('decision_principles')
      .select('principle, source_type, evidence, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    await supabaseAdmin.from('reflection_messages').insert({
      entry_id: entryId,
      user_id: user.id,
      role: 'user',
      content: message,
    })

    const conversationHistory = (previousMessages || [])
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: `
You are not writing a report.
You are having an introspective conversation with the user.

Your role is to help the user understand their own writing more deeply.
You have access to:
- the new journal entry
- the opening reflection
- the user's self-described profile
- previous profile signals
- previous decision principles
- this reflection's conversation history

Do not diagnose.
Do not overclaim.
Do not sound clinical.
Do not flatter.
Do not turn everything into bullet points.
Do not summarize mechanically.

Be thoughtful, direct, human, and quietly provocative when useful.
Ask one strong question when it helps.
Push gently when there is a contradiction.
Connect the current entry to previous patterns only when relevant.

The goal is not to summarize the entry.
The goal is to help the user meet the part of themselves that wrote it.

User-provided profile context:
${JSON.stringify(userProfile || {}, null, 2)}

Current journal entry:
${transcript}

Opening reflection already given:
${openingReflection}

Existing user profile signals:
${JSON.stringify(profileSignals || [], null, 2)}

Existing decision principles:
${JSON.stringify(principles || [], null, 2)}

Previous conversation in this reflection:
${conversationHistory || '[No previous messages yet]'}

User just said:
${message}

Reply as a thoughtful reflective companion. Keep it conversational. Avoid long essays unless the user asks for depth.
      `,
    })

    const assistantText =
      response.output_text?.trim() ||
      'I’m not sure how to respond yet, but there is something here worth staying with.'

    await supabaseAdmin.from('reflection_messages').insert({
      entry_id: entryId,
      user_id: user.id,
      role: 'assistant',
      content: assistantText,
    })

    return NextResponse.json({
      assistantMessage: assistantText,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}