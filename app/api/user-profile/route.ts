import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin'

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

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select(
        'display_name, birthday, values_text, life_direction, self_understanding_goal, avatar_url'
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      profile: data || null,
      email: user.email,
    })
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

    const {
      display_name,
      birthday,
      values_text,
      life_direction,
      self_understanding_goal,
      avatar_url,
    } = await req.json()

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: display_name || null,
          birthday: birthday || null,
          values_text: values_text || null,
          life_direction: life_direction || null,
          self_understanding_goal: self_understanding_goal || null,
          avatar_url: avatar_url || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      profile: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}