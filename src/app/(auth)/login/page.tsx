import Link from 'next/link'
import { headers } from 'next/headers'
import { login } from './actions'
import { GoogleLoginButton } from './google-login-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; cadastro?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, cadastro, next } = await searchParams
  // Área admin (admin.crmstudio.com.br): só e-mail/senha — sem "Entrar com
  // Google", que sempre autentica na conta pessoal e não deve valer pra lá.
  const host = (await headers()).get('host') ?? ''
  const isAdminHost = host === 'admin.crmstudio.com.br'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <img
              src="/brand/CRM-Studio-wordmark.svg"
              alt="CRM Studio"
              className="h-7 w-auto"
            />
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">Acesse a sua conta</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {cadastro === 'ok' && (
            <div className="mb-5 rounded-lg border border-chart-5/30 bg-chart-5/5 px-3 py-2.5 text-sm text-chart-5">
              Conta criada com sucesso. Faça login para entrar.
            </div>
          )}
          {error && (
            <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action={login} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com.br" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link href="/esqueci-senha" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                  Esqueci minha senha
                </Link>
              </div>
              <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
            </div>
            <Button type="submit" className="mt-2 w-full">
              Entrar
            </Button>
          </form>

          {!isAdminHost && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <GoogleLoginButton next={next} />
            </>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{' '}
          <Link href="/contato" className="font-medium text-foreground underline-offset-4 hover:underline">
            Fale com a gente
          </Link>
        </p>
      </div>
    </div>
  )
}
