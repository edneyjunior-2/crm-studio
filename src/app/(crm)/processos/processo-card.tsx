'use client'

import Link from 'next/link'
import { Scale, Calendar, User, Building2 } from 'lucide-react'
import { PROCESSO_STATUS_UI, labelStatusProcesso, type ProcessoStatus } from '@/lib/processos-status'

interface ProcessoCardProps {
  id:             string
  numeroProcesso: string
  tribunalSlug:   string
  status:         string
  clienteNome:    string | null
  advogadoNome:   string | null
  ultimoUpdate:   string | null
  assunto:        string | null
  vara:           string | null
  qtdNaoLidos:    number
}

// Fallback neutro para status legado/desconhecido (não quebra em dado antigo).
const STATUS_PILL_FALLBACK = 'bg-muted text-muted-foreground'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const h   = String(d.getHours()).padStart(2, '0')
  const m   = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} às ${h}:${m}`
}

function formatarTribunal(slug: string): string {
  return slug.toUpperCase()
}

export function ProcessoCard({
  id,
  numeroProcesso,
  tribunalSlug,
  status,
  clienteNome,
  advogadoNome,
  ultimoUpdate,
  assunto,
  vara,
  qtdNaoLidos,
}: ProcessoCardProps) {
  const pillClass = PROCESSO_STATUS_UI[status as ProcessoStatus]?.pill ?? STATUS_PILL_FALLBACK
  const statusLabel = labelStatusProcesso(status)

  return (
    <Link
      href={`/processos/${id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-[0_4px_20px_rgba(20,35,58,0.10)] hover:border-foreground/20"
    >
      {/* Linha topo: tribunal + status + badge não lidos */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-foreground">
            <Scale className="size-3" />
            {formatarTribunal(tribunalSlug)}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${pillClass}`}>
            {statusLabel}
          </span>
        </div>
        {qtdNaoLidos > 0 && (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-white">
            {qtdNaoLidos} nova{qtdNaoLidos > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Cliente — em destaque */}
      <div className="flex items-center gap-1.5">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        {clienteNome ? (
          <span className="truncate text-sm font-semibold text-foreground">{clienteNome}</span>
        ) : (
          <span className="text-sm italic text-muted-foreground">Sem cliente vinculado</span>
        )}
      </div>

      {/* Número do processo */}
      <div>
        <p className="font-mono text-[13px] font-semibold text-foreground leading-tight">
          {numeroProcesso}
        </p>
        {assunto && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{assunto}</p>
        )}
      </div>

      {/* Vara */}
      {vara && (
        <p className="text-xs text-muted-foreground line-clamp-1">
          <span className="font-medium">Vara:</span> {vara}
        </p>
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Rodapé: advogado + data */}
      <div className="flex flex-col gap-1.5">
        {advogadoNome && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3 shrink-0" />
            <span className="truncate">{advogadoNome}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3 shrink-0" />
          <span>
            {ultimoUpdate
              ? `Atualizado em ${formatarData(ultimoUpdate)}`
              : 'Ainda não atualizado via DataJud'}
          </span>
        </div>
      </div>
    </Link>
  )
}
