import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const entryId = params.id

    const { data, error } = await supabaseAdmin
      .from('journal_reflections')
      .select('content, created_at')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No reflection found' }, { status: 404 })
    }

    return NextResponse.json({
      content: data[0].content,
      created_at: data[0].created_at,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}