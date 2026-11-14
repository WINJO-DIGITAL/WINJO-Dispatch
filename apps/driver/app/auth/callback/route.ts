import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { BASE_PATH, withBase } from '@/lib/base-path'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${withBase(next)}`)
    }
  }

  return NextResponse.redirect(`${origin}${BASE_PATH}/login?error=auth`)
}
