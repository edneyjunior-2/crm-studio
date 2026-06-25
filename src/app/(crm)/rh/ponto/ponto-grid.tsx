'use client'

import { useState, useTransition } from 'react'
import { Check, X, Loader2, AlertCircle, ClipboardCheck, Paperclip, FileText, Trash2 } from 'lucide-react'
import { upsertPonto, uploadDocumentoPonto, removerDocumentoPonto, gerarUrlDocumentoPonto } from './ponto-actions'
import type { Colaborador, Ponto } from '@/types/rh'

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function calcDeducao(colaborador: Colaborador, faltas: number): number {
  if (!colaborador.salario || faltas === 0) return 0
  const valorDia =
    colaborador.tipo_remuneracao === 'diaria'
      ? colaborador.salario
      : colaborador.salario / 30
  return valorDia * faltas
}

interface ColaboradorComPonto extends Colaborador {
  ponto?: Ponto
}

interface Props {
  data: string
  colaboradores: ColaboradorComPonto[]
}

type EstadoPonto = 'presente' | 'ausente' | null

interface RowState {
  estado:        EstadoPonto
  justificativa: string
  salvando:      boolean
  erro:          string | null
  documentoPath: string | null
  uploadando:    boolean
}

function estadoInicial(col: ColaboradorComPonto): EstadoPonto {
  if (!col.ponto) return null
  return col.ponto.presente ? 'presente' : 'ausente'
}

export function PontoGrid({ data, colaboradores }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {}
    for (const c of colaboradores) {
      init[c.id] = {
        estado:        estadoInicial(c),
        justificativa: c.ponto?.justificativa ?? '',
        salvando:      false,
        erro:          null,
        documentoPath: c.ponto?.documento_path ?? null,
        uploadando:    false,
      }
    }
    return init
  })

  const [, startTransition] = useTransition()

  function setRow(id: string, partial: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...partial } }))
  }

  async function marcar(colaboradorId: string, presente: boolean) {
    const row = rows[colaboradorId]
    if (!row) return
    const novoEstado: EstadoPonto = presente ? 'presente' : 'ausente'
    if (row.estado === novoEstado) return

    setRow(colaboradorId, { salvando: true, erro: null })
    startTransition(async () => {
      const res = await upsertPonto(
        colaboradorId,
        data,
        presente,
        presente ? null : row.justificativa,
      )
      if (res.error) {
        setRow(colaboradorId, { salvando: false, erro: res.error })
      } else {
        setRow(colaboradorId, { salvando: false, estado: novoEstado })
      }
    })
  }

  async function salvarJustificativa(colaboradorId: string) {
    const row = rows[colaboradorId]
    if (!row || row.estado !== 'ausente') return
    setRow(colaboradorId, { salvando: true, erro: null })
    startTransition(async () => {
      const res = await upsertPonto(colaboradorId, data, false, row.justificativa)
      if (res.error) {
        setRow(colaboradorId, { salvando: false, erro: res.error })
      } else {
        setRow(colaboradorId, { salvando: false })
      }
    })
  }

  function handleUpload(colaboradorId: string, file: File) {
    setRow(colaboradorId, { uploadando: true, erro: null })
    const formData = new FormData()
    formData.append('colaborador_id', colaboradorId)
    formData.append('data', data)
    formData.append('file', file)
    startTransition(async () => {
      const res = await uploadDocumentoPonto(formData)
      if (res.error) {
        setRow(colaboradorId, { uploadando: false, erro: res.error })
      } else {
        setRow(colaboradorId, { uploadando: false, documentoPath: res.path ?? null })
      }
    })
  }

  function handleVerDoc(colaboradorId: string) {
    startTransition(async () => {
      const res = await gerarUrlDocumentoPonto(colaboradorId, data)
      if (res.url) {
        window.open(res.url, '_blank', 'noopener')
      } else {
        setRow(colaboradorId, { erro: res.error ?? 'Erro ao abrir documento.' })
      }
    })
  }

  function handleRemoverDoc(colaboradorId: string) {
    if (!confirm('Remover o documento anexado?')) return
    setRow(colaboradorId, { uploadando: true, erro: null })
    startTransition(async () => {
      const res = await removerDocumentoPonto(colaboradorId, data)
      if (res.error) {
        setRow(colaboradorId, { uploadando: false, erro: res.error })
      } else {
        setRow(colaboradorId, { uploadando: false, documentoPath: null })
      }
    })
  }

  const presentes    = Object.values(rows).filter((r) => r.estado === 'presente').length
  const ausentes     = Object.values(rows).filter((r) => r.estado === 'ausente').length
  const naoMarcados  = Object.values(rows).filter((r) => r.estado === null).length

  const totalDeducoes = colaboradores.reduce((acc, c) => {
    const row = rows[c.id]
    if (row?.estado === 'ausente') acc += calcDeducao(c, 1)
    return acc
  }, 0)

  if (colaboradores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <ClipboardCheck className="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nenhum colaborador ativo cadastrado.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 rounded-xl border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 text-center">
          <span className="text-xs font-medium text-green-700 dark:text-green-400">Presentes</span>
          <span className="text-2xl font-bold text-green-700 dark:text-green-400">{presentes}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-center">
          <span className="text-xs font-medium text-red-700 dark:text-red-400">Ausentes</span>
          <span className="text-2xl font-bold text-red-700 dark:text-red-400">{ausentes}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
          <span className="text-xs font-medium text-muted-foreground">Não marcados</span>
          <span className="text-2xl font-bold text-foreground">{naoMarcados}</span>
        </div>
      </div>

      {/* Lista de colaboradores */}
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
        {colaboradores.map((col) => {
          const row = rows[col.id]
          if (!row) return null
          const deducao = row.estado === 'ausente' ? calcDeducao(col, 1) : 0

          return (
            <div
              key={col.id}
              className={`flex flex-col gap-2 px-4 py-3 transition-colors ${
                row.estado === 'presente'
                  ? 'bg-green-50/50 dark:bg-green-950/10'
                  : row.estado === 'ausente'
                    ? 'bg-red-50/50 dark:bg-red-950/10'
                    : 'bg-card'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{col.nome}</p>
                  {(col.cargo || col.departamento) && (
                    <p className="text-xs text-muted-foreground">
                      {[col.cargo, col.departamento].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {col.salario && (
                    <p className="text-xs text-muted-foreground">
                      {col.tipo_remuneracao === 'diaria'
                        ? `Diária: ${brl(col.salario)}`
                        : `Mensal: ${brl(col.salario)} (diária ≈ ${brl(col.salario / 30)})`}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {row.salvando && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

                  <button
                    type="button"
                    onClick={() => marcar(col.id, true)}
                    disabled={row.salvando}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      row.estado === 'presente'
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-border bg-card text-muted-foreground hover:border-green-400 hover:text-green-600'
                    }`}
                  >
                    <Check className="size-3.5" />
                    Presente
                  </button>

                  <button
                    type="button"
                    onClick={() => marcar(col.id, false)}
                    disabled={row.salvando}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      row.estado === 'ausente'
                        ? 'border-red-500 bg-red-500 text-white'
                        : 'border-border bg-card text-muted-foreground hover:border-red-400 hover:text-red-600'
                    }`}
                  >
                    <X className="size-3.5" />
                    Ausente
                  </button>
                </div>
              </div>

              {/* Justificativa + documento (só quando ausente) */}
              {row.estado === 'ausente' && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={row.justificativa}
                      onChange={(e) => setRow(col.id, { justificativa: e.target.value })}
                      onBlur={() => salvarJustificativa(col.id)}
                      placeholder="Justificativa (opcional) — ex: atestado médico"
                      className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground/40"
                    />
                    {deducao > 0 && (
                      <span className="shrink-0 text-xs font-semibold text-red-600">
                        −{brl(deducao)}
                      </span>
                    )}
                  </div>

                  {/* Anexo de atestado */}
                  <div className="flex items-center gap-2">
                    {row.uploadando ? (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        Enviando documento…
                      </span>
                    ) : row.documentoPath ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleVerDoc(col.id)}
                          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          <FileText className="size-3.5 text-blue-600" />
                          Ver atestado
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoverDoc(col.id)}
                          disabled={row.salvando}
                          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="size-3" />
                          Remover
                        </button>
                      </>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground">
                        <Paperclip className="size-3.5" />
                        Anexar atestado
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUpload(col.id, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    )}
                  </div>
                </>
              )}

              {row.erro && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  {row.erro}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Total de deduções */}
      {ausentes > 0 && totalDeducoes > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 px-4 py-3">
          <span className="text-sm font-medium text-red-700 dark:text-red-400">
            Total de deduções do dia
          </span>
          <span className="text-base font-bold text-red-700 dark:text-red-400">
            −{brl(totalDeducoes)}
          </span>
        </div>
      )}
    </div>
  )
}
