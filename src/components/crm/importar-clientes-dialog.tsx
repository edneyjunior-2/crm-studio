'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Upload, Download, FileText, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { importarClientes, type LinhaImportacao } from '@/app/(crm)/clientes/actions'
import { toCsv } from '@/lib/csv'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const LIMITE_LINHAS = 1000

const COLUNAS_MODELO = {
  razao_social: 'Razão Social',
  cnpj: 'CNPJ',
  contato_nome: 'Contato (nome)',
  contato_email: 'E-mail',
  contato_telefone: 'Telefone',
  segmento: 'Segmento',
  observacoes: 'Observações',
} as const

const LINHA_EXEMPLO = {
  razao_social: 'Empresa Exemplo Ltda',
  cnpj: '12.345.678/0001-90',
  contato_nome: 'João Silva',
  contato_email: 'joao@exemplo.com.br',
  contato_telefone: '(11) 99999-0000',
  segmento: 'Tecnologia',
  observacoes: 'Cliente potencial para 2026',
}

// ---------------------------------------------------------------------------
// Helpers de normalização de cabeçalhos
// ---------------------------------------------------------------------------

/** Remove acentos e converte para minúsculas */
function normalizeKey(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Mapa de cabeçalho normalizado → chave do banco */
const HEADER_MAP: Record<string, keyof LinhaImportacao> = {
  'razao social': 'razao_social',
  'razaosocial': 'razao_social',
  'razao_social': 'razao_social',
  'empresa': 'razao_social',
  'nome da empresa': 'razao_social',
  'cnpj': 'cnpj',
  'contato (nome)': 'contato_nome',
  'contato nome': 'contato_nome',
  'contato_nome': 'contato_nome',
  'nome do contato': 'contato_nome',
  'contato': 'contato_nome',
  'e-mail': 'contato_email',
  'email': 'contato_email',
  'contato_email': 'contato_email',
  'e mail': 'contato_email',
  'telefone': 'contato_telefone',
  'contato_telefone': 'contato_telefone',
  'fone': 'contato_telefone',
  'celular': 'contato_telefone',
  'segmento': 'segmento',
  'setor': 'segmento',
  'observacoes': 'observacoes',
  'observações': 'observacoes',
  'obs': 'observacoes',
  'notas': 'observacoes',
}

function mapearCabecalhos(rawHeaders: string[]): Map<string, keyof LinhaImportacao> {
  const mapa = new Map<string, keyof LinhaImportacao>()
  for (const h of rawHeaders) {
    const norm = normalizeKey(h)
    const campo = HEADER_MAP[norm]
    if (campo) mapa.set(h, campo)
  }
  return mapa
}

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

type StatusLinha = 'ok' | 'erro' | 'duplicado_arquivo'

interface LinhaPreview {
  numero: number
  razao_social: string
  cnpj: string
  contato_nome: string
  contato_email: string
  contato_telefone: string
  segmento: string
  observacoes: string
  status: StatusLinha
  motivo?: string
}

interface ImportarClientesDialogProps {
  trigger: React.ReactNode
}

// ---------------------------------------------------------------------------
// Validações no cliente (espelhadas no servidor)
// ---------------------------------------------------------------------------

function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validarLinha(
  linha: LinhaPreview,
  cnpjsVistos: Set<string>
): { status: StatusLinha; motivo?: string } {
  if (!linha.razao_social.trim()) {
    return { status: 'erro', motivo: 'Razão Social obrigatória' }
  }
  if (linha.contato_email && !validarEmail(linha.contato_email)) {
    return { status: 'erro', motivo: 'E-mail inválido' }
  }
  if (linha.cnpj) {
    const cnpjNorm = linha.cnpj.trim()
    if (cnpjsVistos.has(cnpjNorm)) {
      return { status: 'duplicado_arquivo', motivo: 'CNPJ duplicado no arquivo' }
    }
    cnpjsVistos.add(cnpjNorm)
  }
  return { status: 'ok' }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ImportarClientesDialog({ trigger }: ImportarClientesDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isLendo, setIsLendo] = useState(false)

  const [linhas, setLinhas] = useState<LinhaPreview[]>([])
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [avisoLimite, setAvisoLimite] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // --------------------------------------------------------------------------
  // Download do modelo
  // --------------------------------------------------------------------------

  function baixarModelo() {
    const csv = toCsv(COLUNAS_MODELO, [LINHA_EXEMPLO])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-importacao-clientes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // --------------------------------------------------------------------------
  // Leitura do arquivo
  // --------------------------------------------------------------------------

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Resetar estado
    setLinhas([])
    setErroArquivo(null)
    setAvisoLimite(false)

    // Verificar extensão
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErroArquivo('Apenas arquivos .csv são aceitos. Por favor, escolha um arquivo CSV.')
      return
    }

    setIsLendo(true)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        setIsLendo(false)

        const rawHeaders: string[] = results.meta.fields ?? []

        // Verificar cabeçalho com Razão Social
        const temRazaoSocial = rawHeaders.some(
          (h) => HEADER_MAP[normalizeKey(h)] === 'razao_social'
        )
        if (!temRazaoSocial) {
          setErroArquivo(
            `Coluna "Razão Social" não encontrada no arquivo. Baixe o modelo para ver o formato correto. Cabeçalhos encontrados: ${rawHeaders.join(', ') || '(nenhum)'}`
          )
          return
        }

        const dados = results.data
        if (dados.length === 0) {
          setErroArquivo('A planilha está vazia. Adicione ao menos uma linha de dados.')
          return
        }

        const excedeu = dados.length > LIMITE_LINHAS
        if (excedeu) setAvisoLimite(true)

        const dadosLimitados = excedeu ? dados.slice(0, LIMITE_LINHAS) : dados

        const mapa = mapearCabecalhos(rawHeaders)
        const cnpjsVistos = new Set<string>()

        const linhasProcessadas: LinhaPreview[] = dadosLimitados.map((row, i) => {
          // Mapear colunas tolerando acento/maiúscula
          const get = (campo: keyof LinhaImportacao): string => {
            for (const [rawHeader, key] of mapa.entries()) {
              if (key === campo) return (row[rawHeader] ?? '').trim()
            }
            return ''
          }

          const preview: LinhaPreview = {
            numero: i + 1,
            razao_social: get('razao_social'),
            cnpj: get('cnpj'),
            contato_nome: get('contato_nome'),
            contato_email: get('contato_email'),
            contato_telefone: get('contato_telefone'),
            segmento: get('segmento'),
            observacoes: get('observacoes'),
            status: 'ok',
          }

          const validacao = validarLinha(preview, cnpjsVistos)
          preview.status = validacao.status
          preview.motivo = validacao.motivo

          return preview
        })

        setLinhas(linhasProcessadas)
      },
      error(err) {
        setIsLendo(false)
        setErroArquivo(`Erro ao ler o arquivo: ${err.message}`)
      },
    })

    // Limpar input para permitir re-seleção do mesmo arquivo
    e.target.value = ''
  }, [])

  // --------------------------------------------------------------------------
  // Importação
  // --------------------------------------------------------------------------

  const linhasOk = linhas.filter((l) => l.status === 'ok')
  const linhasPuladas = linhas.filter((l) => l.status !== 'ok')

  function handleImportar() {
    if (linhasOk.length === 0) return

    const payload: LinhaImportacao[] = linhasOk.map((l) => ({
      razao_social: l.razao_social,
      cnpj: l.cnpj || null,
      contato_nome: l.contato_nome || null,
      contato_email: l.contato_email || null,
      contato_telefone: l.contato_telefone || null,
      segmento: l.segmento || null,
      observacoes: l.observacoes || null,
    }))

    startTransition(async () => {
      const resultado = await importarClientes(payload)

      if (resultado.erro) {
        toast.error(`Erro na importação: ${resultado.erro}`)
        return
      }

      const totalPulados = linhasPuladas.length + resultado.pulados.length
      const msg =
        resultado.importados > 0
          ? `${resultado.importados} ${resultado.importados === 1 ? 'cliente importado' : 'clientes importados'}${totalPulados > 0 ? `, ${totalPulados} pulados` : ''}.`
          : `Nenhum cliente importado. ${totalPulados} pulados.`

      if (resultado.importados > 0) {
        toast.success(msg)
      } else {
        toast.warning(msg)
      }

      // Fechar e resetar
      setOpen(false)
      setLinhas([])
      setErroArquivo(null)
      setAvisoLimite(false)
    })
  }

  // --------------------------------------------------------------------------
  // Resetar ao fechar
  // --------------------------------------------------------------------------

  function handleOpenChange(next: boolean) {
    if (!isPending && !isLendo) {
      setOpen(next)
      if (!next) {
        setLinhas([])
        setErroArquivo(null)
        setAvisoLimite(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const temPreview = linhas.length > 0
  const temErro = !!erroArquivo

  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar clientes por planilha</DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1 pb-1">

            {/* Instruções */}
            {!temPreview && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">Como funciona</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Baixe o modelo CSV com o formato correto.</li>
                  <li>Preencha com seus clientes (salve em UTF-8).</li>
                  <li>Faça o upload do arquivo aqui e confira a pré-visualização.</li>
                  <li>Clique em &ldquo;Importar&rdquo; para adicionar os clientes válidos.</li>
                </ol>
                <p className="mt-2 text-xs">Limite: {LIMITE_LINHAS} linhas por importação. Apenas arquivos .csv em UTF-8.</p>
              </div>
            )}

            {/* Botão baixar modelo */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={baixarModelo}
                className="gap-2"
              >
                <Download className="size-3.5" />
                Baixar modelo (CSV)
              </Button>

              {/* Input de arquivo */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  id="csv-upload"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isPending || isLendo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 cursor-pointer"
                  disabled={isPending || isLendo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isLendo ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Lendo arquivo...
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5" />
                      {temPreview ? 'Trocar arquivo' : 'Selecionar arquivo .csv'}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Aviso de limite excedido */}
            {avisoLimite && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-amber-800">
                  Seu arquivo tem mais de {LIMITE_LINHAS} linhas. Apenas as primeiras {LIMITE_LINHAS} serão importadas. Importe o restante depois.
                </p>
              </div>
            )}

            {/* Erro de arquivo */}
            {temErro && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Arquivo inválido</p>
                  <p className="text-destructive/80">{erroArquivo}</p>
                </div>
              </div>
            )}

            {/* Resumo + pré-visualização */}
            {temPreview && (
              <>
                {/* Resumo */}
                <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                  <span className="flex items-center gap-1.5 text-green-700">
                    <CheckCircle2 className="size-4" />
                    <strong>{linhasOk.length}</strong> pronto{linhasOk.length !== 1 ? 's' : ''} para importar
                  </span>
                  {linhasPuladas.length > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <AlertCircle className="size-4" />
                      <strong>{linhasPuladas.length}</strong> {linhasPuladas.length === 1 ? 'será pulado' : 'serão pulados'}
                    </span>
                  )}
                </div>

                {/* Tabela de pré-visualização */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">#</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-40">Razão Social</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-32">CNPJ</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-28">E-mail</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-28">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {linhas.map((linha) => (
                          <tr
                            key={linha.numero}
                            className={
                              linha.status === 'ok'
                                ? 'bg-background'
                                : 'bg-amber-50/60'
                            }
                          >
                            <td className="px-3 py-2 text-muted-foreground">{linha.numero}</td>
                            <td className="px-3 py-2 font-medium truncate max-w-40" title={linha.razao_social}>
                              {linha.razao_social || <span className="italic text-muted-foreground">(vazio)</span>}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{linha.cnpj || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate max-w-28" title={linha.contato_email}>
                              {linha.contato_email || '—'}
                            </td>
                            <td className="px-3 py-2">
                              {linha.status === 'ok' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                  <CheckCircle2 className="size-3" />
                                  OK
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                                  title={linha.motivo}
                                >
                                  <X className="size-3" />
                                  {linha.motivo ?? 'inválido'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Legenda de erros se houver linhas puladas */}
                {linhasPuladas.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Motivos para linhas puladas:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {Array.from(new Set(linhasPuladas.map((l) => l.motivo ?? 'inválido'))).map((motivo) => (
                        <li key={motivo}>{motivo}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {linhasOk.length === 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-amber-800">
                      Nenhuma linha válida para importar. Corrija os erros no arquivo e tente novamente.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Estado vazio (sem arquivo selecionado) */}
            {!temPreview && !temErro && !isLendo && (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-10 text-center">
                <FileText className="size-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum arquivo selecionado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Clique em &ldquo;Selecionar arquivo .csv&rdquo; acima</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" disabled={isPending || isLendo} />}>
              Cancelar
            </DialogClose>
            <Button
              type="button"
              onClick={handleImportar}
              disabled={isPending || isLendo || linhasOk.length === 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Importando...
                </>
              ) : (
                `Importar ${linhasOk.length > 0 ? `${linhasOk.length} cliente${linhasOk.length !== 1 ? 's' : ''}` : 'clientes'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
