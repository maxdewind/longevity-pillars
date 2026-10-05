import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const PUBLIC_PATHS = ['/', '/demo', '/login', '/signup']
  const isPublic = PUBLIC_PATHS.includes(path)
  if (!user && !isPublic) return NextResponse.redirect(new URL('/login', request.url))
  if (user && path === '/') return NextResponse.redirect(new URL('/app', request.url))
  if (user && (path === '/login' || path === '/signup')) return NextResponse.redirect(new URL('/app', request.url))
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon.svg|apple-touch-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] }
