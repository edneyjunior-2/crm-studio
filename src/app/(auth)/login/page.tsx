import Link from 'next/link'
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginPageProps {
  searchParams: Promise<{ error?: string; cadastro?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, cadastro } = await searchParams

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
            CRM Studio<span className="text-accent">.</span>
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
