import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { entryId } = await req.json()

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    const { data: entry, error: entryError } = await supabaseAdmin
      .from('journal_entries')
      .select('id, user_id, created_at')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const { data: transcriptRows, error: transcriptError } = await supabaseAdmin
      .from('journal_transcripts')
      .select('confirmed_text, raw_ocr_text')
      .eq('entry_id', entryId)
      .limit(1)

    if (transcriptError || !transcriptRows || transcriptRows.length === 0) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
    }

    const newEntryText =
      transcriptRows[0].confirmed_text || transcriptRows[0].raw_ocr_text

    const { data: profileSignals } = await supabaseAdmin
      .from('profile_signals')
      .select('signal_type, signal_text, strength')
      .eq('user_id', entry.user_id)
      .order('created_at', { ascending: false })
      .limit(30)

    const { data: existingPrinciples } = await supabaseAdmin
      .from('decision_principles')
      .select('principle, source_type, evidence, status')
      .eq('user_id', entry.user_id)
      .order('created_at', { ascending: false })
      .limit(30)

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: `
You are an AI journaling assistant.

You are analyzing ONE new journal entry/session from a user.
The reflection should focus on this new entry, but use the user's accumulated profile and previous decision principles as background context.

Do not diagnose.
Do not overclaim.
Do not sound clinical or robotic.
Do not force a rigid report.
Keep the tone thoughtful, open-minded, and conversational.

Your job:
1. Reflect on strong ideas worth dwelling on in the new entry.
2. Notice meaningful frictions, tensions, or contradictions if they appear.
3. Mention what the entry may suggest about the user's values, personality, or way of seeing life, but carefully.
4. If the new entry connects to previous profile signals or principles, gently point that out.
5. End by opening discussion, not closing it.

Also extract:
- profile signals to add
- decision principles to add

Existing profile signals:
${JSON.stringify(profileSignals || [], null, 2)}

Existing decision principles:
${JSON.stringify(existingPrinciples || [], null, 2)}

New journal entry:
${newEntryText}

Return ONLY valid JSON in this exact shape:
{
  "reflection_text": "string",
  "profile_signals_to_add": [
    {
      "signal_type": "idea | value | tension | pattern | unresolved_question",
      "signal_text": "string",
      "strength": 0.5
    }
  ],
  "decision_principles_to_add": [
    {
      "principle": "string",
      "source_type": "explicit | inferred",
      "evidence": "string",
      "status": "emerging | recurring | core"
    }
  ]
}
      `,
    })

    const raw = response.output_text?.trim()

    if (!raw) {
      return NextResponse.json({ error: 'No reflection generated' }, { status: 500 })
    }

    const parsed = JSON.parse(raw)

    const reflectionText = parsed.reflection_text || ''

    const { error: reflectionError } = await supabaseAdmin
      .from('journal_reflections')
      .insert({
        entry_id: entryId,
        content: reflectionText,
      })

    if (reflectionError) {
      return NextResponse.json({ error: reflectionError.message }, { status: 500 })
    }

    const signals = parsed.profile_signals_to_add || []

    for (const signal of signals) {
      if (!signal.signal_text) continue

      await supabaseAdmin.from('profile_signals').insert({
        user_id: entry.user_id,
        source_entry_id: entryId,
        signal_type: signal.signal_type || 'idea',
        signal_text: signal.signal_text,
        strength: signal.strength || 0.5,
      })
    }

    const principles = parsed.decision_principles_to_add || []

    for (const principle of principles) {
      if (!principle.principle) continue

      await supabaseAdmin.from('decision_principles').insert({
        user_id: entry.user_id,
        entry_id: entryId,
        principle: principle.principle,
        source_type: principle.source_type || 'inferred',
        evidence: principle.evidence || '',
        status: principle.status || 'emerging',
      })
    }

    return NextResponse.json({
      reflection: reflectionText,
      profile_signals_added: signals.length,
      principles_added: principles.length,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}