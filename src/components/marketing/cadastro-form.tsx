'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cadastrar } from '@/app/(marketing)/cadastro/actions'
import { PLANOS_VENDAVEIS, PLANO_LABEL, PLANO_TAGLINE, PRECO_POR_PLANO, type PlanoVendavel } from '@/lib/planos'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CadastroFormProps {
  /** Plano pré-selecionado (de ?plano= no /cadastro, já validado no servidor). */
  plano: PlanoVendavel
}

export function CadastroForm({ plano }: CadastroFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoVendavel>(plano)
  const [isPending, startTransition] = useTransition()

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await cadastrar(formData)
      if (result?.error) {
        setServerError(result.error)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full max-w-sm">
      {/* Branding */}
      <div className="mb-8 text-center">
        <Link href="/" className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
          CRM Studio<span className="text-accent">.</span>
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">Crie sua conta gratuitamente</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        {/* Server error */}
        {serverError && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Seletor de plano — cada radio já carrega name="plano" pro FormData,
              sem precisar de input hidden (spec planos-verticais-no-checkout.md). */}
          <div className="flex flex-col gap-1.5">
            <Label>Plano</Label>
            <div className="flex flex-col gap-2">
              {PLANOS_VENDAVEIS.map((slug) => (
                <label
                  key={slug}
                  className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    planoSelecionado === slug
                      ? 'border-foreground bg-secondary'
                      : 'border-border hover:bg-secondary/50'
                  }`}
                >
                  <span className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="plano"
                      value={slug}
                      defaultChecked={slug === plano}
                      onChange={() => setPlanoSelecionado(slug)}
                      className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
                    />
                    <span className="flex flex-col">
                      <span className="font-medium text-foreground">{PLANO_LABEL[slug]}</span>
                      <span className="text-xs text-muted-foreground">{PLANO_TAGLINE[slug]}</span>
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-semibold text-foreground">
                    {BRL.format(PRECO_POR_PLANO[slug])}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Você contratará o <strong className="text-foreground">{PLANO_LABEL[planoSelecionado]}</strong> por{' '}
              <strong className="text-foreground">{BRL.format(PRECO_POR_PLANO[planoSelecionado])}/mês</strong>, cobrado
              a partir do 15º dia.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">
              E-mail <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="voce@empresa.com.br"
              autoComplete="email"
            />
          </div>

          {/* Aceite */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="aceite_termo"
              name="aceite_termo"
              type="checkbox"
              required
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
            />
            <label htmlFor="aceite_termo" className="text-xs leading-relaxed text-muted-foreground">
              Li e aceito os{' '}
              <Link
                href="/termos"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Termos de Uso
              </Link>{' '}
              e o{' '}
              <Link
                href="/contrato-operador"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Contrato de Operador (DPA)
              </Link>
            </label>
          </div>

          <Button type="submit" disabled={isPending} className="mt-2 w-full">
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Continuando...
              </>
            ) : (
              'Continuar para o pagamento'
            )}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
