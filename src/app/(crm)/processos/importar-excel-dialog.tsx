'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, TriangleAlert, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface ProcessoImportRow {
  numero_processo:   string
  cliente_nome?:     string
  advogado_nome?:    string
  assunto?:          string
  vara?:             string
  comarca?:          string
  area?:             string
  valor_causa?:      string
  honorarios_tipo?:  string
  honorarios_valor?: string
  providencia?:      string
  status_interno?:   string
  indicacao?:        string
}

interface AbaPreview {
  nome:      string
  area:      string
  areaLabel: string
  processos: ProcessoImportRow[]
  ignorada:  boolean
  motivo?:   string
}

interface ImportResult {
  total:       number
  criados:     number
  atualizados: number
  erros:       { numero: string; motivo: string }[]
  semDataJud:  { numero: string; motivo: string }[]
}

// ---------------------------------------------------------------------------
// Mapeamento aba → área do direito
// ---------------------------------------------------------------------------
const ABA_AREA: [RegExp, string][] = [
  [/itiv/i,                    'tributario'],
  [/previdenci/i,              'previdenciario'],
  [/precatório|precatorio/i,   'precatorio'],
  [/faz\s*pub|fazenda/i,       'fazenda_publica'],
  [/trabalhist/i,              'trabalhista'],
  [/criminal|penal/i,          'criminal'],
  [/famil/i,                   'familia'],
  [/sefaz|admin/i,             '__admin__'],
  [/diversos|diversas/i,       'civel'],
]

const AREA_LABEL: Record<string, string> = {
  tributario:      'Tributário',
  civel:           'Cível',
  previdenciario:  'Previdenciário',
  precatorio:      'Precatório',
  fazenda_publica: 'Fazenda Pública',
  trabalhista:     'Trabalhista',
  criminal:        'Criminal',
  familia:         'Família',
}

function areaFromTabName(nome: string): string {
  for (const [re, area] of ABA_AREA) {
    if (re.test(nome)) return area
  }
  return 'civel'
}

// ---------------------------------------------------------------------------
// Normalização e mapeamento de cabeçalhos
// ---------------------------------------------------------------------------
function norm(s: string) {
  return String(s).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const COL_FIELD: [RegExp, keyof ProcessoImportRow][] = [
  [/num.*processo|numero jud|n[uú]mero$/i,  'numero_processo'],
  [/^n[uú]m\.?$|^num\.?$|^n\.?$/i,         'numero_processo'],
  [/parte interessada|parte contraria/i,     'cliente_nome'],
  [/advogado|responsavel/i,                  'advogado_nome'],
  [/assunto|objeto|beneficio|tipo de acao/i, 'assunto'],
  [/ju[ií]zo|vara judicial|^vara$/i,         'vara'],
  [/comarca|cidade/i,                        'comarca'],
  [/[aá]rea|ramo/i,                          'area'],
  [/valor da causa|^valor$/i,                'valor_causa'],
  [/tipo.*honorarios|honorarios.*tipo/i,     'honorarios_tipo'],
  [/valor.*honorarios|honorarios.*valor/i,   'honorarios_valor'],
  [/provid[eê]ncia|situa[cç][aã]o atual|observa[cç][oõ]es/i, 'providencia'],
  [/^status$/i,                              'status_interno'],
  [/indica[cç][aã]o|parceiro/i,              'indicacao'],
]

function detectField(header: string): keyof ProcessoImportRow | null {
  const n = norm(header)
  for (const [re, field] of COL_FIELD) {
    if (re.test(n)) return field
  }
  return null
}

// ---------------------------------------------------------------------------
// Detectar linha de cabeçalho (≥2 hits em colunas conhecidas)
// ---------------------------------------------------------------------------
function detectHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const hits = (rows[i] as string[]).filter((c) => c && detectField(String(c))).length
    if (hits >= 2) return i
  }
  return 2
}

// ---------------------------------------------------------------------------
// Regex CNJ
// ---------------------------------------------------------------------------
const CNJ_RE = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/

function isCNJ(v: string) {
  return CNJ_RE.test(v.replace(/\s/g, ''))
}

// ---------------------------------------------------------------------------
// Parsear uma aba
// ---------------------------------------------------------------------------
function parseAba(sheetName: string, rawRows: unknown[][]): AbaPreview {
  const area = areaFromTabName(sheetName)

  if (area === '__admin__') {
    return {
      nome: sheetName, area: '__admin__', areaLabel: 'Administrativo',
      processos: [], ignorada: true,
      motivo: 'Processos administrativos — número fora do padrão CNJ',
    }
  }

  const headerIdx = detectHeaderRow(rawRows)
  const headers   = (rawRows[headerIdx] as string[]).map(String)
  const fieldMap  = headers.map((h) => detectField(h))
  const areaLabel = AREA_LABEL[area] ?? sheetName

  const processos: ProcessoImportRow[] = []

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[]
    const obj: Partial<ProcessoImportRow> = {}

    for (let c = 0; c < headers.length; c++) {
      const field = fieldMap[c]
      if (!field) continue
      const raw = row[c]
      if (raw === undefined || raw === null || raw === '') continue
      const val = String(raw).trim()
      if (!val || val === '-' || val === '—') continue
      if (!(field in obj)) (obj as Record<string, string>)[field] = val
    }

    if (obj.numero_processo) {
      obj.numero_processo = obj.numero_processo.replace(/\s/g, '')
    }

    if (!obj.numero_processo || !isCNJ(obj.numero_processo)) continue

    obj.area = areaLabel
    processos.push(obj as ProcessoImportRow)
  }

  return { nome: sheetName, area, areaLabel, processos, ignorada: false }
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
type Step = 'upload' | 'preview' | 'importing' | 'done'

export function ImportarExcelDialog() {
  const [open, setOpen]           = useState(false)
  const [step, setStep]           = useState<Step>('upload')
  const [dragging, setDragging]   = useState(false)
  const [abas, setAbas]           = useState<AbaPreview[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [result, setResult]       = useState<ImportResult | null>(null)
  const fileRef                   = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload'); setAbas([]); setSelecionadas(new Set()); setResult(null)
  }

  function handleClose(v: boolean) {
    if (step === 'importing') return
    setOpen(v)
    if (!v) setTimeout(reset, 300)
  }

  async function parseFile(file: File) {
    try {
      const { read, utils } = await import('xlsx')
      const buf  = await file.arrayBuffer()
      const wb   = read(buf, { type: 'array' })

      const parsed = wb.SheetNames.map((name) => {
        const ws      = wb.Sheets[name]
        const rawRows = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
        return parseAba(name, rawRows)
      })

      const comProcessos = parsed.filter((a) => !a.ignorada && a.processos.length > 0)
      if (!comProcessos.length) {
        toast.error('Nenhum processo com número CNJ válido encontrado. Verifique o arquivo.')
        return
      }

      setAbas(parsed)
      setSelecionadas(new Set(comProcessos.map((a) => a.nome)))
      setStep('preview')
    } catch {
      toast.error('Não foi possível ler o arquivo. Verifique se é .xlsx, .xls ou .csv.')
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleAba(nome: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      next.has(nome) ? next.delete(nome) : next.add(nome)
      return next
    })
  }

  const processosParaImportar = abas
    .filter((a) => selecionadas.has(a.nome))
    .flatMap((a) => a.processos)

  // Detecta duplicatas entre abas (mesmo CNJ em mais de uma aba)
  const cnjCount = new Map<string, number>()
  for (const p of processosParaImportar) {
    cnjCount.set(p.numero_processo, (cnjCount.get(p.numero_processo) ?? 0) + 1)
  }
  const totalUnicos     = cnjCount.size
  const totalDuplicatas = processosParaImportar.length - totalUnicos

  async function handleImport() {
    if (!processosParaImportar.length) return
    setStep('importing')
    try {
      const res = await fetch('/api/processos/importar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows: processosParaImportar }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido.')
      setResult(data)
      setStep('done')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na importação.')
      setStep('preview')
    }
  }

  const total = processosParaImportar.length

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

          {/* ── Upload ── */}
          {step === 'upload' && (
            <div
              className={`mt-2 flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-14 text-center transition-colors ${dragging ? 'border-accent bg-accent/5' : 'border-border'}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
                <Upload className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">Arraste o arquivo aqui</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Suporta .xlsx, .xls e .csv — detecta colunas e abas automaticamente
                </p>
              </div>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                Selecionar arquivo
              </Button>
              <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
            </div>
          )}

          {/* ── Preview por aba ── */}
          {step === 'preview' && (
            <div className="mt-2 flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                Selecione as abas que deseja importar. Os campos foram detectados automaticamente.
              </div>

              <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
                {abas.map((aba) => {
                  if (aba.ignorada) {
                    return (
                      <div key={aba.nome} className="flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 px-4 py-3 opacity-60">
                        <TriangleAlert className="size-4 shrink-0 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium">{aba.nome}</p>
                          <p className="text-xs text-muted-foreground">{aba.motivo}</p>
                        </div>
                      </div>
                    )
                  }

                  const ativa = selecionadas.has(aba.nome)

                  return (
                    <div key={aba.nome} className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${ativa ? 'border-accent/40 bg-accent/5' : 'border-border'}`}>
                      {/* Cabeçalho da aba */}
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={ativa}
                          onChange={() => toggleAba(aba.nome)}
                          className="size-4 rounded accent-amber-500"
                        />
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <p className="font-semibold">{aba.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {aba.areaLabel} · {aba.processos.length} processo{aba.processos.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ativa ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-foreground'}`}>
                            {aba.processos.length}
                          </span>
                        </div>
                      </label>

                      {/* Preview das primeiras linhas */}
                      {ativa && aba.processos.length > 0 && (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-secondary text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Número CNJ</th>
                                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                                {aba.processos.some((p) => p.providencia) && (
                                  <th className="px-3 py-2 text-left font-medium">Providência</th>
                                )}
                                {aba.processos.some((p) => p.status_interno) && (
                                  <th className="px-3 py-2 text-left font-medium">Status</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {aba.processos.slice(0, 3).map((p, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-2 font-mono">{p.numero_processo}</td>
                                  <td className="max-w-[180px] truncate px-3 py-2 text-muted-foreground">{p.cliente_nome ?? '—'}</td>
                                  {aba.processos.some((x) => x.providencia) && (
                                    <td className="max-w-[160px] truncate px-3 py-2 text-muted-foreground">{p.providencia ?? '—'}</td>
                                  )}
                                  {aba.processos.some((x) => x.status_interno) && (
                                    <td className="px-3 py-2 text-muted-foreground">{p.status_interno ?? '—'}</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {aba.processos.length > 3 && (
                            <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                              + {aba.processos.length - 3} processo{aba.processos.length - 3 !== 1 ? 's' : ''} a mais…
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {totalDuplicatas > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
                  <TriangleAlert className="size-3.5 shrink-0" />
                  {totalDuplicatas} CNJ{totalDuplicatas !== 1 ? 's' : ''} repetido{totalDuplicatas !== 1 ? 's' : ''} entre abas — serão mesclados.
                  Serão criados <strong>{totalUnicos}</strong> processos únicos.
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <Button variant="outline" onClick={reset}>
                  <X className="size-4" /> Trocar arquivo
                </Button>
                <Button onClick={handleImport} disabled={total === 0}>
                  <ChevronRight className="size-4" />
                  Importar {totalUnicos} processo{totalUnicos !== 1 ? 's' : ''} únicos
                </Button>
              </div>
            </div>
          )}

          {/* ── Importando ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="size-12 animate-spin rounded-full border-4 border-border border-t-accent" />
              <div>
                <p className="font-semibold">Importando {total} processo{total !== 1 ? 's' : ''}…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Consultando o DataJud em paralelo. Pode levar alguns segundos.
                </p>
              </div>
            </div>
          )}

          {/* ── Resultado ── */}
          {step === 'done' && result && (
            <div className="mt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-xl border border-border p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-7 shrink-0 text-green-500" />
                  <div>
                    <p className="font-semibold">Importação concluída</p>
                    <p className="text-sm text-muted-foreground">{result.total} processo(s) processado(s)</p>
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
              </div>

              {result.erros.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-destructive">
                    <AlertCircle className="size-4" /> Processos com erro ({result.erros.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5">
                    {result.erros.map((e, i) => (
                      <div key={i} className="flex gap-2 border-b border-border/50 px-3 py-2 last:border-0 text-xs">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        <span className="font-mono font-semibold">{e.numero}</span>
                        <span className="text-muted-foreground">{e.motivo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.semDataJud.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                    <TriangleAlert className="size-4" /> Sem dados no DataJud ({result.semDataJud.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
                    {result.semDataJud.map((e, i) => (
                      <div key={i} className="flex gap-2 border-b border-amber-100 px-3 py-2 last:border-0 text-xs dark:border-amber-900/30">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                        <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">{e.numero}</span>
                        <span className="text-amber-600 dark:text-amber-500">{e.motivo}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Salvos com os dados da planilha. Atualize manualmente abrindo cada processo.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <Button variant="outline" onClick={reset}>Importar outro arquivo</Button>
                <Button onClick={() => { handleClose(false); window.location.reload() }}>Ver processos</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
