import { NextResponse } from 'next/server'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { supabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('journal_entries')
      .select('id, created_at, title')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    const entryIds = (entries || []).map((entry) => entry.id)

    const { data: transcripts, error: transcriptsError } = await supabaseAdmin
      .from('journal_transcripts')
      .select('entry_id, raw_ocr_text, confirmed_text, created_at')
      .in('entry_id', entryIds)

    if (transcriptsError) {
      return NextResponse.json({ error: transcriptsError.message }, { status: 500 })
    }

    const children: Paragraph[] = [
      new Paragraph({
        text: 'Raw Journal Archive',
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Generated for: ${user.email || user.id}`,
          }),
        ],
      }),
      new Paragraph({
        text: `Generated at: ${new Date().toLocaleString()}`,
      }),
      new Paragraph({ text: '' }),
    ]

    for (let i = 0; i < (entries || []).length; i++) {
      const entry = entries![i]
      const transcript = transcripts?.find((t) => t.entry_id === entry.id)
      const text =
        transcript?.confirmed_text ||
        transcript?.raw_ocr_text ||
        '[No transcript found]'

      children.push(
        new Paragraph({
          text: `Entry ${i + 1}`,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: `Date: ${new Date(entry.created_at).toLocaleString()}`,
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          children: [new TextRun(text)],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '---' }),
        new Paragraph({ text: '' })
      )
    }

    const doc = new Document({
      sections: [{ children }],
    })

    const buffer = await Packer.toBuffer(doc)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="raw-journal-archive.docx"',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}