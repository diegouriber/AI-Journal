import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase-admin'

export async function DELETE(req: Request) {
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
      .select('id')
      .eq('user_id', user.id)

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    const entryIds = (entries || []).map((entry) => entry.id)

    if (entryIds.length > 0) {
      await supabaseAdmin.from('journal_reflections').delete().in('entry_id', entryIds)
      await supabaseAdmin.from('journal_transcripts').delete().in('entry_id', entryIds)
      await supabaseAdmin.from('journal_uploads').delete().in('entry_id', entryIds)
      await supabaseAdmin.from('journal_entries').delete().in('id', entryIds)
    }

    await supabaseAdmin.from('profile_signals').delete().eq('user_id', user.id)
    await supabaseAdmin.from('decision_principles').delete().eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      message: 'Archive and principles deleted.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
