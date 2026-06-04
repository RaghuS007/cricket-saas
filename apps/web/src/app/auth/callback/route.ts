import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncProfile } from '@/lib/api'

// Handles Supabase OAuth redirects and email confirmation links.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      await syncProfile(data.session.access_token)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
