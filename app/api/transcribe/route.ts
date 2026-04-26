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

    const { data: uploads, error: uploadsError } = await supabaseAdmin
      .from('journal_uploads')
      .select('file_path, page_order')
      .eq('entry_id', entryId)
      .order('page_order', { ascending: true })

    if (uploadsError) {
      return NextResponse.json({ error: uploadsError.message }, { status: 500 })
    }

    if (!uploads || uploads.length === 0) {
      return NextResponse.json({ error: 'No uploads found for this entry' }, { status: 404 })
    }

    const content: any[] = [
      {
        type: 'input_text',
        text: 'Transcribe these handwritten journal pages faithfully. Preserve paragraph breaks and page order. Do not summarize. If something is unclear, write [unclear]. Return only the transcript.',
      },
    ]

    for (const upload of uploads) {
      const { data } = supabaseAdmin.storage
        .from('journal-uploads')
        .getPublicUrl(upload.file_path)

      content.push({
        type: 'input_image',
        image_url: data.publicUrl,
      })
    }

    const response = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content,
        },
      ],
    })

    const text = response.output_text?.trim()

    if (!text) {
      return NextResponse.json({ error: 'No transcript returned' }, { status: 500 })
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('journal_transcripts')
      .select('id')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true })

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existingRows && existingRows.length > 0) {
      const firstId = existingRows[0].id

      await supabaseAdmin
        .from('journal_transcripts')
        .update({
          raw_ocr_text: text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', firstId)

      if (existingRows.length > 1) {
        const duplicateIds = existingRows.slice(1).map((row) => row.id)

        await supabaseAdmin
          .from('journal_transcripts')
          .delete()
          .in('id', duplicateIds)
      }
    } else {
      await supabaseAdmin
        .from('journal_transcripts')
        .insert({
          entry_id: entryId,
          raw_ocr_text: text,
          is_confirmed: false,
        })
    }

    await supabaseAdmin
      .from('journal_entries')
      .update({ status: 'transcribed' })
      .eq('id', entryId)

    return NextResponse.json({ text })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
