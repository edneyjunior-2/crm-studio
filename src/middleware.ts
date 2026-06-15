import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas — o website institucional (marketing), acessível sem login.
// Retornam antes de criar o cliente Supabase, então renderizam mesmo
// sem envs configuradas e sem custo de auth.
const PUBLIC_ROUTES = ['/', '/produto', '/precos', '/contato', '/cadastro', '/termos', '/contrato-operador', '/privacidade']

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

export async function middleware(request: NextRequest) {
  if (isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.next({ request })
  }

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

  const pathname = request.nextUrl.pathname
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/esqueci-senha') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
