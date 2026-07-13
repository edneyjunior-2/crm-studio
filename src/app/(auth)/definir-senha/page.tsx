'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthBrandHeader } from '@/components/auth/brand-header'
import { completarPrimeiroAcesso } from './actions'

// Trava de completar 1º acesso (spec onboarding-senha-pos-pagamento, Parte
// C+D) — para quem chega com sessão JÁ AUTENTICADA (voltou direto do
// /cadastro/pagamento/sucesso, sessão original ainda viva). Reaproveita a
// maior parte do JSX/lógica de reset-password/page.tsx (formulário de nova
// senha + confirmar + validação de 8 caracteres + updateUser), mas SEM a
// etapa de ler hash da URL / setSession — já tem sessão válida, não precisa
// disso. O caso de e-mail (sessão perdida/outro dispositivo) continua
// passando por /reset-password sem nenhuma mudança.
type Status = 'form' | 'success'

export default function DefinirSenhaPage() {
  const [status, setStatus] = useState<Status>('form')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

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
      setErrorMsg('Não foi possível definir sua senha. Tente novamente.')
      setPending(false)
      return
    }

    setStatus('success')

    // completarPrimeiroAcesso seta senha_temporaria=false e redireciona pro
    // /dashboard (redirect() dentro da Server Action) — mesmo padrão já usado
    // em cadastrar() (src/app/(marketing)/cadastro/actions.ts): chamamos e só
    // tratamos o retorno se ele NÃO redirecionar (erro).
    const result = await completarPrimeiroAcesso()
    if (result?.error) {
      setErrorMsg(result.error)
      setPending(false)
      setStatus('form')
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
        <AuthBrandHeader subtitle="Plataforma modular para PMEs brasileiras" />

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {status === 'form' && (
            <>
              <div className="mb-6">
                <h2 className="text-center text-base font-semibold text-foreground">
                  Defina sua senha de acesso
                </h2>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  Seu cartão foi confirmado! Escolha uma senha com no mínimo 8 caracteres para continuar.
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
                  {pending ? 'Salvando...' : 'Definir senha e acessar'}
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
                <p className="font-semibold text-foreground">Senha definida com sucesso!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entrando no CRM...
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/70">
          Acesso restrito a usuários autorizados
        </p>
      </div>
    </div>
  )
}
