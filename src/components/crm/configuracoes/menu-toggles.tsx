'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { toggleModuloVisibilidade } from '@/app/(crm)/configuracoes/actions'
import { MODULO_LABEL } from '@/lib/modulos'
import type { Modulo } from '@/lib/modulos'

interface Props {
  modulosDisponiveis: Modulo[]
  modulosOcultos: string[]
}

export function MenuToggles({ modulosDisponiveis, modulosOcultos }: Props) {
  const [ocultos, setOcultos] = useState<string[]>(modulosOcultos)
  const [isPending, startTransition] = useTransition()

  function handle(modulo: Modulo, ocultar: boolean) {
    const anterior = ocultos
    // Otimista: reflete a intenção na hora, mas reverte se o backend não confirmar.
    setOcultos(ocultar ? [...anterior, modulo] : anterior.filter((m) => m !== modulo))

    startTransition(async () => {
      try {
        const result = await toggleModuloVisibilidade(modulo, ocultar)
        if (result.error) {
          setOcultos(anterior)
          toast.error(result.error)
        }
      } catch (err) {
        setOcultos(anterior)
        console.error('[MenuToggles] falha ao atualizar visibilidade do módulo:', err)
        toast.error('Não foi possível salvar. Tente novamente.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {modulosDisponiveis.map((modulo) => {
        const oculto = ocultos.includes(modulo)
        return (
          <div
            key={modulo}
            className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
          >
            <span className={`text-sm ${oculto ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {MODULO_LABEL[modulo]}
            </span>

            <button
              type="button"
              role="switch"
              aria-checked={!oculto}
              aria-label={`${oculto ? 'Mostrar' : 'Ocultar'} ${MODULO_LABEL[modulo]}`}
              disabled={isPending}
              onClick={() => handle(modulo, !oculto)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                oculto ? 'bg-muted' : 'bg-accent'
              }`}
            >
              <span
                className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
                  oculto ? 'translate-x-0.5' : 'translate-x-[18px]'
                }`}
              />
            </button>
          </div>
        )
      })}
      {isPending && (
        <p className="text-xs text-muted-foreground">Salvando...</p>
      )}
    </div>
  )
}
