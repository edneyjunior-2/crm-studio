import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas — marketing, acessíveis sem login
const PUBLIC_ROUTES = ['/', '/produto', '/precos', '/contato', '/cadastro', '/termos', '/contrato-operador', '/privacidade']

// Rotas que só fazem sentido no site de marketing (www)
const MARKETING_ONLY = ['/', '/precos', '/produto', '/contato', '/termos', '/contrato-operador', '/privacidade']

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const pathname = request.nextUrl.pathname

  const isWww   = hostname === 'www.crmstudio.com.br'
  const isApp   = hostname === 'app.crmstudio.com.br'
  const isAdmin = hostname === 'admin.crmstudio.com.br'

  // ── Roteamento por domínio (só em produção) ───────────────────────────────

  if (isWww) {
    // No www: rotas do CRM redirecionam para app
    if (!isPublicRoute(pathname) && !pathname.startsWith('/api')) {
      return NextResponse.redirect(
        new URL(`https://app.crmstudio.com.br${pathname}${request.nextUrl.search}`)
      )
    }
    // Rotas de marketing passam sem checar auth
    return NextResponse.next({ request })
  }

  if (isAdmin) {
    // No admin: só rotas /admin/** são válidas
    // Raiz e qualquer rota fora de /admin → redireciona para /admin
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/api') && !pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    // Cai na lógica de auth abaixo (getUser + redirect para /login se não autenticado)
  }

  if (isApp) {
    // Raiz → login (middleware de auth redireciona para /dashboard se já logado)
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Outras rotas de marketing puro redirecionam para www
    const marketingOtherThanRoot = MARKETING_ONLY.filter((r) => r !== '/')
    if (marketingOtherThanRoot.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
      return NextResponse.redirect(
        new URL(`https://www.crmstudio.com.br${pathname}${request.nextUrl.search}`)
      )
    }
    // /login no app: tudo certo, continua para a lógica de auth abaixo
  }

  // ── Lógica de auth (localhost, app.* e URL do Vercel) ────────────────────

  if (isPublicRoute(pathname)) {
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
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
            })
          )
        },
      },
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
      },
    }
  )

  // getSession() lê o JWT do cookie sem round-trip de rede (~0ms vs ~500ms do getUser).
  // Segurança real é garantida por getUser() nos Server Components via React.cache + RLS no banco.
  const { data: { session } } = await supabase.auth.getSession()

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/esqueci-senha') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/api')

  if (!session && !isAuthRoute) {
    const loginUrl = isApp
      ? new URL(`https://app.crmstudio.com.br/login`)
      : request.nextUrl.clone()
    if (!isApp) loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (session && pathname === '/login') {
    const dashUrl = isApp
      ? new URL(`https://app.crmstudio.com.br/dashboard`)
      : request.nextUrl.clone()
    if (!isApp) dashUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)',
    // O matcher geral exclui .html; esta entrada extra força o middleware a rodar
    // em /contratos/* (gerador estático da Aurum, contém PII) p/ exigir login.
    // ponytail: fecha o acesso anônimo (o furo real). Tenant-scoping fino (só
    // Aurum) fica pro gerador white-label por tenant — upgrade path documentado.
    '/contratos/:path*',
  ],
}
