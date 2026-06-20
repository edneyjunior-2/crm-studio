'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, ChevronRight, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ProcessoImportRow } from '@/app/api/processos/importar/route'

// ---------------------------------------------------------------------------
// Mapeamento de nomes de colunas → campos internos
// ---------------------------------------------------------------------------
const COL_MAP: Record<string, keyof ProcessoImportRow> = {
  // numero_processo
  'número do processo': 'numero_processo',
  'numero do processo': 'numero_processo',
  'nº processo': 'numero_processo',
  'no processo': 'numero_processo',
  'processo': 'numero_processo',
  'num processo': 'numero_processo',
  'numero_processo': 'numero_processo',
  // cliente
  'cliente': 'cliente_nome',
  'parte': 'cliente_nome',
  'polo ativo': 'cliente_nome',
  'cliente_nome': 'cliente_nome',
  'razao social': 'cliente_nome',
  'razão social': 'cliente_nome',
  // advogado
  'advogado': 'advogado_nome',
  'responsável': 'advogado_nome',
  'responsavel': 'advogado_nome',
  'advogado_nome': 'advogado_nome',
  // assunto
  'assunto': 'assunto',
  'objeto': 'assunto',
  'matéria': 'assunto',
  'materia': 'assunto',
  // vara
  'vara': 'vara',
  'vara judicial': 'vara',
  // comarca
  'comarca': 'comarca',
  'cidade': 'comarca',
  // area
  'área': 'area',
  'area': 'area',
  'área do direito': 'area',
  'area do direito': 'area',
  'ramo': 'area',
  // valor_causa
  'valor da causa': 'valor_causa',
  'valor causa': 'valor_causa',
  'valor': 'valor_causa',
  'valor_causa': 'valor_causa',
  // honorarios_tipo
  'tipo de honorários': 'honorarios_tipo',
  'tipo de honorarios': 'honorarios_tipo',
  'honorários tipo': 'honorarios_tipo',
  'honorarios tipo': 'honorarios_tipo',
  'honorarios_tipo': 'honorarios_tipo',
  // honorarios_valor
  'valor dos honorários': 'honorarios_valor',
  'valor dos honorarios': 'honorarios_valor',
  'honorários valor': 'honorarios_valor',
  'honorarios valor': 'honorarios_valor',
  'honorarios_valor': 'honorarios_valor',
}

const FIELD_LABELS: Record<keyof ProcessoImportRow, string> = {
  numero_processo:  'Número do processo',
  cliente_nome:     'Cliente',
  advogado_nome:    'Advogado',
  assunto:          'Assunto',
  vara:             'Vara',
  comarca:          'Comarca',
  area:             'Área do direito',
  valor_causa:      'Valor da causa',
  honorarios_tipo:  'Tipo de honorários',
  honorarios_valor: 'Valor dos honorários',
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function detectField(header: string): keyof ProcessoImportRow | null {
  const n = normalizeHeader(header)
  return COL_MAP[n] ?? null
}

type Step = 'upload' | 'preview' | 'done'

interface ImportResult {
  total: number
  criados: number
  atualizados: number
  erros: { numero: string; motivo: string }[]
  semDataJud: { numero: string; motivo: string }[]
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function ImportarExcelDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, keyof ProcessoImportRow | ''>>({})
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload')
    setHeaders([])
    setMapping({})
    setRows([])
    setResult(null)
  }

  function handleClose(v: boolean) {
    if (!loading) {
      setOpen(v)
      if (!v) setTimeout(reset, 300)
    }
  }

  async function parseFile(file: File) {
    const { read, utils } = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
    if (!data.length) {
      toast.error('Planilha vazia ou sem dados reconhecíveis.')
      return
    }
    const hdrs = Object.keys(data[0])
    const autoMap: Record<string, keyof ProcessoImportRow | ''> = {}
    for (const h of hdrs) {
      autoMap[h] = detectField(h) ?? ''
    }
    setHeaders(hdrs)
    setMapping(autoMap)
    setRows(data)
    setStep('preview')
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }, [])

  const mappedRows: ProcessoImportRow[] = rows.map((row) => {
    const out: Partial<ProcessoImportRow> = {}
    for (const [col, field] of Object.entries(mapping)) {
      if (field && row[col] !== undefined) {
        (out as Record<string, string>)[field] = String(row[col])
      }
    }
    return out as ProcessoImportRow
  }).filter((r) => r.numero_processo?.trim())

  async function handleImport() {
    if (!mappedRows.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/processos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mappedRows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido.')
      setResult(data)
      setStep('done')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na importação.')
    } finally {
      setLoading(false)
    }
  }

  const unmappedRequired = !Object.values(mapping).includes('numero_processo')

  return (
    <>
      <Button variant="outline" onClick={() => { reset(); setOpen(true) }}>
        <Upload className="size-4" />
        Importar Excel
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-accent" />
              Importar processos via Excel
            </DialogTitle>
          </DialogHeader>

          {/* ── STEP 1: Upload ── */}
          {step === 'upload' && (
            <div
              className={`mt-2 flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                dragging ? 'border-accent bg-accent/5' : 'border-border'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
                <Upload className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">Arraste o arquivo aqui</p>
                <p className="mt-1 text-sm text-muted-foreground">ou clique para selecionar (.xlsx, .xls, .csv)</p>
              </div>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                Selecionar arquivo
              </Button>
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
              <p className="text-xs text-muted-foreground">
                A primeira linha deve conter os cabeçalhos das colunas.
              </p>
            </div>
          )}

          {/* ── STEP 2: Preview e mapeamento ── */}
          {step === 'preview' && (
            <div className="mt-2 flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{rows.length}</span> linha(s) detectada(s) ·{' '}
                <span className="font-semibold text-foreground">{mappedRows.length}</span> com número de processo válido
              </div>

              {/* Mapeamento de colunas */}
              <div>
                <p className="mb-2 text-sm font-semibold">Mapeamento de colunas</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Coluna do Excel</th>
                        <th className="px-3 py-2 text-left font-medium">
                          <ChevronRight className="inline size-3" /> Campo no CRM
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {headers.map((h) => (
                        <tr key={h} className={mapping[h] === 'numero_processo' ? 'bg-accent/5' : ''}>
                          <td className="px-3 py-2 font-mono text-xs">{h}</td>
                          <td className="px-3 py-2">
                            <select
                              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                              value={mapping[h] ?? ''}
                              onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as keyof ProcessoImportRow | '' }))}
                            >
                              <option value="">— ignorar —</option>
                              {(Object.keys(FIELD_LABELS) as (keyof ProcessoImportRow)[]).map((f) => (
                                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preview das primeiras linhas */}
              {mappedRows.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Prévia (primeiras 3 linhas)</p>
                  <div className="max-h-36 overflow-auto rounded-lg border border-border">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-secondary text-muted-foreground">
                        <tr>
                          {(Object.keys(FIELD_LABELS) as (keyof ProcessoImportRow)[])
                            .filter((f) => Object.values(mapping).includes(f))
                            .map((f) => (
                              <th key={f} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                                {FIELD_LABELS[f]}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {mappedRows.slice(0, 3).map((r, i) => (
                          <tr key={i}>
                            {(Object.keys(FIELD_LABELS) as (keyof ProcessoImportRow)[])
                              .filter((f) => Object.values(mapping).includes(f))
                              .map((f) => (
                                <td key={f} className="px-2 py-1.5 text-muted-foreground whitespace-nowrap max-w-[160px] truncate">
                                  {r[f] ?? '—'}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {unmappedRequired && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  Mapeie a coluna "Número do processo" para continuar.
                </div>
              )}

              <div className="flex justify-between gap-3 border-t border-border pt-4">
                <Button variant="outline" onClick={reset} disabled={loading}>
                  <X className="size-4" />
                  Trocar arquivo
                </Button>
                <Button onClick={handleImport} disabled={loading || unmappedRequired || mappedRows.length === 0}>
                  {loading
                    ? 'Importando...'
                    : `Importar ${mappedRows.length} processo${mappedRows.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Resultado ── */}
          {step === 'done' && result && (
            <div className="mt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-7 shrink-0 text-green-500" />
                  <div>
                    <p className="font-semibold">Importação concluída</p>
                    <p className="text-sm text-muted-foreground">
                      {result.total} processo(s) processado(s)
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-lg bg-secondary/50 p-4 text-center text-sm">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{result.criados}</p>
                    <p className="text-muted-foreground">Criados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{result.atualizados}</p>
                    <p className="text-muted-foreground">Atualizados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{result.erros.length}</p>
                    <p className="text-muted-foreground">Erros</p>
                  </div>
                </div>
                {result.criados > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Os processos criados serão sincronizados com o DataJud automaticamente em segundo plano.
                  </p>
                )}
              </div>

              {/* Erros de formato/banco */}
              {result.erros.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-destructive">
                    <AlertCircle className="size-4" />
                    Processos com erro ({result.erros.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5">
                    {result.erros.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 border-b border-border/50 px-3 py-2 last:border-0">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        <div className="text-xs">
                          <span className="font-mono font-semibold">{e.numero}</span>
                          <span className="ml-2 text-muted-foreground">{e.motivo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avisos DataJud */}
              {result.semDataJud.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                    <TriangleAlert className="size-4" />
                    Processos sem dados no DataJud ({result.semDataJud.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
                    {result.semDataJud.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 border-b border-amber-100 px-3 py-2 last:border-0 dark:border-amber-900/30">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                        <div className="text-xs">
                          <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">{e.numero}</span>
                          <span className="ml-2 text-amber-600 dark:text-amber-500">{e.motivo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Esses processos foram salvos. Você pode atualizar manualmente abrindo cada processo.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <Button variant="outline" onClick={reset}>
                  Importar outro arquivo
                </Button>
                <Button onClick={() => { handleClose(false); window.location.reload() }}>
                  Ver processos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
