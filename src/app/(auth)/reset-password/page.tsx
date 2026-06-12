'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = 'loading' | 'invalid' | 'form' | 'success' | 'error'

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) {
      setStatus('invalid')
      return
    }

    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (type !== 'recovery' || !accessToken || !refreshToken) {
      setStatus('invalid')
      return
    }

    // Estabelecer sessão com o token de recuperação
    const supabase = createClient()
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setStatus('invalid')
        } else {
          setStatus('form')
        }
      })
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const nova = (form.elements.namedItem('nova_senha') as HTMLInputElement).value
    const confirmar = (form.elements.namedItem('confirmar_senha') as HTMLInputElement).value

    if (nova.length < 8) {
      setErrorMsg('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (nova !== confirmar) {
      setErrorMsg('As senhas não coincidem.')
      return
    }

    setPending(true)
    setErrorMsg(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: nova })

    if (error) {
      setErrorMsg('Erro ao redefinir senha. O link pode ter expirado. Solicite um novo.')
      setPending(false)
    } else {
      setStatus('success')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Fundo decorativo sutil */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/4 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Cabeçalho da marca */}
        <div className="mb-10 text-center">
          <div className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <span className="text-2xl font-bold text-primary-foreground font-[family-name:var(--font-heading)] italic">
              A
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
            CRM Aurum
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Consultoria Tributária
          </p>

          <div className="mx-auto mt-4 h-px w-16 bg-accent/60" />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Verificando link...</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-6 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-foreground">Link inválido ou expirado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Este link de recuperação não é mais válido. Solicite um novo.
                </p>
              </div>
              <Link
                href="/esqueci-senha"
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Solicitar novo link
              </Link>
            </div>
          )}

          {status === 'form' && (
            <>
              <div className="mb-6">
                <h2 className="text-center text-base font-semibold text-foreground">
                  Redefinir senha
                </h2>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Escolha uma nova senha com no mínimo 8 caracteres.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="nova_senha"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Nova senha
                  </label>
                  <input
                    id="nova_senha"
                    name="nova_senha"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="confirmar_senha"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    Confirmar senha
                  </label>
                  <input
                    id="confirmar_senha"
                    name="confirmar_senha"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Repita a nova senha"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-1 h-10 w-full rounded-lg bg-primary text-sm font-semibold tracking-wide text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>
            </>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-6 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-foreground">Senha redefinida com sucesso!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você já pode entrar com sua nova senha.
                </p>
              </div>
              <Link
                href="/login"
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Ir para o login
              </Link>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/70">
          Acesso restrito a membros da equipe Aurum
        </p>
      </div>
    </div>
  )
}
