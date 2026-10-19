// Server-side Apple Health bridge pull.
//
// The Google Sheet gviz endpoint does not send CORS headers, so the browser
// cannot fetch it directly. This route fetches it server-to-server and
// upserts the rows as the calling user (their bearer token is forwarded, so
// RLS applies exactly as if they wrote the rows themselves).
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SHEET_ID, fetchSheetRows } from '@/lib/sheetSync'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Sign-in required.' }, { status: 401 })
    }
    if (!SHEET_ID) {
      return NextResponse.json({ error: 'Apple Health sync is not connected yet.' }, { status: 400 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: auth } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign-in required.' }, { status: 401 })
    }
    const rows = await fetchSheetRows(SHEET_ID)
    const payload = rows.map((r) => ({
      user_id: user.id,
      entry_date: r.date,
      metric_key: r.metric_key,
      value: r.value,
      source: 'apple_health',
    }))
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase
        .from('metric_entries')
        .upsert(payload.slice(i, i + 200), { onConflict: 'user_id,entry_date,metric_key,source' })
      if (error) throw error
    }
    return NextResponse.json({ ok: true, rows: rows.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync failed.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
