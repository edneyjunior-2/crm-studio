'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cadastrar } from '@/app/(marketing)/cadastro/actions'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CadastroForm() {
  const [serverError, setServerError] = useState<string | null>(null)
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
                Criando conta...
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
