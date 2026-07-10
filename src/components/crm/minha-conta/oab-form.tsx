'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateOwnOab } from '@/app/(crm)/minha-conta/actions'

interface OabFormProps {
  oabNumero: string | null
  oabUf: string | null
}

export function OabForm({ oabNumero, oabUf }: OabFormProps) {
  const [numero, setNumero] = useState(oabNumero ?? '')
  const [uf, setUf] = useState(oabUf ?? '')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  async function handleBlur() {
    const numeroTrimmed = numero.trim()
    const ufTrimmed = uf.trim().toUpperCase()

    // Campos em branco: OAB é opcional até o usuário preencher os dois — não
    // salva e não mostra erro (caso de borda previsto na spec).
    if (!numeroTrimmed || !ufTrimmed) return

    const numeroSalvo = (oabNumero ?? '').trim()
    const ufSalvo = (oabUf ?? '').trim().toUpperCase()
    if (numeroTrimmed === numeroSalvo && ufTrimmed === ufSalvo) return

    setSalvando(true)
    const result = await updateOwnOab(numeroTrimmed, ufTrimmed)
    setSalvando(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setUf(ufTrimmed)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="oab-numero"
            className="text-xs text-muted-foreground uppercase tracking-wide font-medium"
          >
            Número da OAB
          </label>
          <input
            id="oab-numero"
            value={numero}
            onChange={(e) => { setNumero(e.target.value); setSalvo(false) }}
            onBlur={handleBlur}
            placeholder="Ex: 123456"
            className="mt-1 h-9 w-40 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40"
          />
        </div>
        <div>
          <label
            htmlFor="oab-uf"
            className="text-xs text-muted-foreground uppercase tracking-wide font-medium"
          >
            UF
          </label>
          <input
            id="oab-uf"
            value={uf}
            onChange={(e) => { setUf(e.target.value); setSalvo(false) }}
            onBlur={handleBlur}
            placeholder="SP"
            maxLength={2}
            className="mt-1 h-9 w-16 rounded-lg border border-border bg-background px-2.5 text-sm font-medium uppercase text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40"
          />
        </div>
        <div className="flex h-9 items-center">
          {salvando && <span className="text-[10px] text-muted-foreground">salvando…</span>}
          {salvo    && <span className="text-[10px] text-chart-5">✓ salvo</span>}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Usado para buscar automaticamente as publicações do Diário de Justiça (DJEN) nos seus processos.
      </p>
    </div>
  )
}
