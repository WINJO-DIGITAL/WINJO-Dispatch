import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { stripBase, withBase } from '@/lib/base-path'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = stripBase(request.nextUrl.pathname)
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // The app's pages sit under /driver, so redirect targets get the prefix.
  const go = (to: string) => {
    const url = request.nextUrl.clone()
    url.pathname = withBase(to)
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (!user && !isPublic) {
    return go('/login')
  }

  if (user && pathname === '/login') {
    return go('/dashboard')
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/driver/((?!_next/static|_next/image|favicon.ico|logo.png|logo.jpg|icons|manifest.json|sw.js|fonts).*)', '/driver'],
}
