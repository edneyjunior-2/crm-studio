'use client'

import Link from 'next/link'
import { useState } from 'react'
import { enviarRecuperacaoSenha } from './actions'
import { AuthBrandHeader } from '@/components/auth/brand-header'

export default function EsqueciSenhaPage() {
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)

    const result = await enviarRecuperacaoSenha(formData)

    if (result.error) {
      setError(result.error)
    } else if (result.success) {
      setSuccess(true)
    }

    setPending(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Fundo decorativo sutil */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/4 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <AuthBrandHeader subtitle="Plataforma modular para PMEs brasileiras" />

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {success ? (
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
                <p className="font-semibold text-foreground">E-mail enviado!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                </p>
              </div>
              <Link
                href="/login"
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-center text-base font-semibold text-foreground">
                  Recuperar acesso
                </h2>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Digite seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form action={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="seu@email.com"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/20"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-1 h-10 w-full rounded-lg bg-primary text-sm font-semibold tracking-wide text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending ? 'Enviando...' : 'Enviar link'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  href="/login"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Voltar para o login
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/70">
          Acesso restrito a usuários autorizados
        </p>
      </div>
    </div>
  )
}
