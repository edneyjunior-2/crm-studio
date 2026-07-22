'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, MessageSquarePlus, Paperclip, FileText, Trash2, X } from 'lucide-react'
import {
  salvarJustificativaPonto,
  removerJustificativaPonto,
  uploadDocumentoPonto,
  gerarUrlDocumentoPonto,
} from '../ponto-actions'
import { formatarMinutos, formatarDelta } from './ponto-utils'
import { TIPO_JUSTIFICATIVA_PONTO_LABEL } from '@/types/rh'
import type { TipoJustificativaPonto } from '@/types/rh'

export type SituacaoDia = 'normal' | 'falta' | 'atestado' | 'folga_banco_horas' | 'folga' | 'feriado' | 'sem_registro'

export interface DiaPontoView {
  data: string
  dataExibicao: string
  diaSemanaLabel: string
  situacao: SituacaoDia
  entrada_1: string | null
  saida_1: string | null
  entrada_2: string | null
  saida_2: string | null
  minutosTrabalhados: number
  minutosEsperados: number | null
  delta: number | null
  batidaManual: boolean
  justificativa: string | null
  tipoJustificativa: TipoJustificativaPonto | null
  temDocumento: boolean
  temPonto: boolean
}

const SITUACAO_CONFIG: Record<SituacaoDia, { label: string; badge: string }> = {
  normal:             { label: 'Trabalhou',              badge: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400' },
  falta:              { label: 'Faltou',                 badge: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400' },
  atestado:           { label: 'Atestado médico',        badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400' },
  folga_banco_horas:  { label: 'Folga (banco de horas)', badge: 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-400' },
  folga:              { label: 'Folga',                  badge: 'border-border bg-muted/40 text-muted-foreground' },
  feriado:            { label: 'Feriado',                badge: 'border-border bg-muted/40 text-muted-foreground' },
  sem_registro:       { label: 'Sem registro',            badge: 'border-dashed border-border text-muted-foreground/70' },
}

const TIPOS_JUSTIFICATIVA = Object.keys(TIPO_JUSTIFICATIVA_PONTO_LABEL) as TipoJustificativaPonto[]

interface Props {
  colaboradorId: string
  dias: DiaPontoView[]
}

export function DiasPonto({ colaboradorId, dias }: Props) {
  const [diaAberto, setDiaAberto] = useState<string | null>(null)

  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
      {dias.map((d) => (
        <LinhaDia
          key={d.data}
          colaboradorId={colaboradorId}
          dia={d}
          aberto={diaAberto === d.data}
          onToggle={() => setDiaAberto((atual) => (atual === d.data ? null : d.data))}
        />
      ))}
    </div>
  )
}

function LinhaDia({
  colaboradorId,
  dia: d,
  aberto,
  onToggle,
}: {
  colaboradorId: string
  dia: DiaPontoView
  aberto: boolean
  onToggle: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [tipo, setTipo] = useState<TipoJustificativaPonto>(d.tipoJustificativa ?? 'outro')
  const [texto, setTexto] = useState(d.justificativa ?? '')

  const config = SITUACAO_CONFIG[d.situacao]
  const temHorario = d.entrada_1 || d.saida_1 || d.entrada_2 || d.saida_2
  const justificado = !!d.tipoJustificativa
  const podeJustificar = d.temPonto // só dias com registro de ponto podem ser justificados

  function salvar() {
    startTransition(async () => {
      const res = await salvarJustificativaPonto(colaboradorId, d.data, tipo, texto)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Justificativa salva.')
    })
  }

  function remover() {
    if (!confirm('Remover a justificativa (e o anexo, se houver) deste dia?')) return
    startTransition(async () => {
      const res = await removerJustificativaPonto(colaboradorId, d.data)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setTexto('')
      toast.success('Justificativa removida.')
    })
  }

  function handleUpload(file: File) {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('colaborador_id', colaboradorId)
      formData.append('data', d.data)
      formData.append('file', file)
      const res = await uploadDocumentoPonto(formData)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Anexo enviado.')
    })
  }

  function handleVerDoc() {
    startTransition(async () => {
      const res = await gerarUrlDocumentoPonto(colaboradorId, d.data)
      if (res.url) {
        window.open(res.url, '_blank', 'noopener')
      } else {
        toast.error(res.error ?? 'Erro ao abrir documento.')
      }
    })
  }

  return (
    <div className="flex flex-col bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex min-w-[9rem] flex-col">
          <span className="text-sm font-medium text-foreground">{d.dataExibicao}</span>
          <span className="text-xs text-muted-foreground">{d.diaSemanaLabel}</span>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          {temHorario && (
            <span className="text-xs text-muted-foreground">
              {d.entrada_1 ?? '—'}–{d.saida_1 ?? '—'}
              {(d.entrada_2 || d.saida_2) && ` / ${d.entrada_2 ?? '—'}–${d.saida_2 ?? '—'}`}
              {d.batidaManual && ' (lançado manualmente)'}
            </span>
          )}
          {d.minutosTrabalhados > 0 && (
            <span className="text-xs font-medium text-foreground">{formatarMinutos(d.minutosTrabalhados)}</span>
          )}
          {d.delta !== null && d.delta !== 0 && (
            <span className={`text-xs font-semibold ${d.delta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {formatarDelta(d.delta)}
            </span>
          )}
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.badge}`}>
            {config.label}
          </span>
          {justificado && (
            <span className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-400">
              Justificado
            </span>
          )}
          {podeJustificar && (
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {aberto ? <X className="size-3.5" /> : <MessageSquarePlus className="size-3.5" />}
              {justificado ? 'Editar justificativa' : 'Justificar'}
            </button>
          )}
        </div>
      </div>

      {aberto && podeJustificar && (
        <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-4 py-3">
          {justificado && (
            <p className="text-xs text-teal-700 dark:text-teal-400">
              Justificado como <strong>{TIPO_JUSTIFICATIVA_PONTO_LABEL[d.tipoJustificativa!]}</strong> — isso já foi
              descontado do banco de horas deste dia.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoJustificativaPonto)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-foreground/40"
            >
              {TIPOS_JUSTIFICATIVA.map((t) => (
                <option key={t} value={t}>
                  {TIPO_JUSTIFICATIVA_PONTO_LABEL[t]}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Detalhe (opcional) — ex: liberado às 14h pelo encarregado"
              className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground/40"
            />

            <button
              type="button"
              onClick={salvar}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors disabled:opacity-50"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Salvar
            </button>

            {justificado && (
              <button
                type="button"
                onClick={remover}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                Remover
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {d.temDocumento ? (
              <button
                type="button"
                onClick={handleVerDoc}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <FileText className="size-3.5 text-blue-600" />
                Ver anexo
              </button>
            ) : (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                <Paperclip className="size-3.5" />
                Anexar atestado/comprovante
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
