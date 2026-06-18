'use client'

import Link from 'next/link'
import { Scale, Calendar, User, Building2 } from 'lucide-react'

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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ativo:     { label: 'Ativo',     className: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  encerrado: { label: 'Encerrado', className: 'bg-muted text-muted-foreground' },
  suspenso:  { label: 'Suspenso',  className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  arquivado: { label: 'Arquivado', className: 'bg-muted text-muted-foreground' },
}

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
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ativo

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
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        </div>
        {qtdNaoLidos > 0 && (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-white">
            {qtdNaoLidos} nova{qtdNaoLidos > 1 ? 's' : ''}
          </span>
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

      {/* Rodapé: cliente + advogado + data */}
      <div className="flex flex-col gap-1.5">
        {clienteNome && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">{clienteNome}</span>
          </div>
        )}
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
