import { GoogleLoginButton } from '@/components/auth/google-login-button'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const error = params.error

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/4 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mb-6 inline-flex size-20 items-center justify-center rounded-2xl bg-primary p-3 shadow-lg shadow-primary/20">
            <img
              src="/aurum-icon.svg"
              alt="Aurum"
              className="size-full object-contain brightness-0 invert"
            />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
            CRM Aurum
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Consultoria Tributária
          </p>

          <div className="mx-auto mt-4 h-px w-16 bg-accent/60" />
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Entre com sua conta Google para continuar
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
              {decodeURIComponent(error)}
            </div>
          )}

          <GoogleLoginButton />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/70">
          Acesso restrito a membros da equipe Aurum
        </p>
      </div>
    </div>
  )
}
