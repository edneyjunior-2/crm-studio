'use client'

import { Newspaper } from 'lucide-react'
import { PublicacoesTimeline } from './publicacoes-timeline'
import { SincronizarDjenButton } from '../sincronizar-djen-button'

interface PublicacaoItem {
  id:       string
  tribunal: string
  tipo:     string
  texto:    string
  data:     string
  link:     string | null
}
interface Grupo {
  mes:   string
  itens: PublicacaoItem[]
}

interface Props {
  processoId: string
  grupos:     Grupo[]
}

export function PublicacoesSection({ processoId, grupos }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <SincronizarDjenButton processoId={processoId} />
      </div>

      {grupos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Newspaper className="size-4 shrink-0" />
            Nenhuma publicação encontrada ainda.
          </div>
          <p className="text-xs text-muted-foreground">
            O sistema busca automaticamente publicações deste processo no Diário de Justiça
            Eletrônico Nacional (DJEN). Para verificar agora, use o botão acima.
          </p>
        </div>
      ) : (
        <PublicacoesTimeline grupos={grupos} />
      )}
    </div>
  )
}
