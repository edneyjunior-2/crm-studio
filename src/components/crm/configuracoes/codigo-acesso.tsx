'use client'

import { useState } from 'react'
import { KeyRound, Copy, Check } from 'lucide-react'

export function CodigoAcesso({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)

  function copiar() {
    navigator.clipboard.writeText(codigo).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 marker:hidden">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <span className="text-base font-medium text-foreground">Código de acesso da empresa</span>
        </div>
        <svg
          className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <div className="flex flex-col gap-3 border-t border-border px-5 pb-5 pt-4">
        <p className="text-sm text-muted-foreground">
          Compartilhe este código com os funcionários da sua empresa para que eles possam se cadastrar no CRM Studio e ser vinculados automaticamente à conta da empresa.
        </p>

        <div className="flex items-center gap-3">
          <span className="flex-1 rounded-lg border border-border bg-muted px-4 py-2.5 font-mono text-xl font-bold tracking-widest text-foreground">
            {codigo}
          </span>
          <button
            type="button"
            onClick={copiar}
            title="Copiar código"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted transition-colors hover:bg-muted/80"
          >
            {copiado ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Copy className="size-4 text-muted-foreground" />
            )}
          </button>
        </div>

        <p className="text-xs text-muted-foreground/70">
          O funcionário cria uma conta no app.crmstudio.com.br e insere este código no primeiro acesso.
        </p>
      </div>
    </details>
  )
}
