'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileWarning } from 'lucide-react'
import { analisarFolhaPonto, confirmarImportacaoPonto } from './importar-actions'
import type {
  ColaboradorAnalisado,
  AcaoColaboradorImportacao,
  PayloadConfirmarImportacao,
} from '@/types/importador-ponto'

type Etapa = 'upload' | 'revisao' | 'concluido'

interface LinhaRevisao extends ColaboradorAnalisado {
  acao: AcaoColaboradorImportacao
}

function resumoDias(dias: ColaboradorAnalisado['dias']) {
  const trabalhados = dias.filter((d) => d.tipo === 'normal').length
  const faltas = dias.filter((d) => d.tipo === 'falta').length
  const atestados = dias.filter((d) => d.tipo === 'atestado').length
  const folgasBH = dias.filter((d) => d.tipo === 'folga_banco_horas').length
  return { trabalhados, faltas, atestados, folgasBH, total: dias.length }
}

export function ImportarWizard() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<{ inicio: string | null; fim: string | null }>({ inicio: null, fim: null })
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([])
  const [importados, setImportados] = useState(0)
  // useTransition's isPending só atualiza no próximo render — um duplo-clique
  // muito rápido pode disparar a action duas vezes antes do botão desabilitar.
  // Esse ref é síncrono e bloqueia o segundo clique imediatamente.
  const enviandoRef = useRef(false)

  function handleAnalisar(formData: FormData) {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setErro(null)
    startTransition(async () => {
      try {
        const res = await analisarFolhaPonto(formData)
        if (res.error || !res.resultado) {
          setErro(res.error ?? 'Erro ao analisar o arquivo.')
          return
        }
        setPeriodo({ inicio: res.resultado.periodoInicio, fim: res.resultado.periodoFim })
        setLinhas(
          res.resultado.colaboradores.map((c) => ({
            ...c,
            acao: c.colaboradorId ? 'atualizar' : 'ignorar',
          })),
        )
        setEtapa('revisao')
      } finally {
        enviandoRef.current = false
      }
    })
  }

  function setAcao(pagina: number, acao: AcaoColaboradorImportacao) {
    setLinhas((prev) => prev.map((l) => (l.pagina === pagina ? { ...l, acao } : l)))
  }

  function handleConfirmar() {
    if (enviandoRef.current) return
    enviandoRef.current = true
    setErro(null)
    const payload: PayloadConfirmarImportacao = {
      colaboradores: linhas
        .filter((l) => l.acao !== 'ignorar')
        .map((l) => ({
          pagina: l.pagina,
          cpf: l.cpf,
          nomeNaFolha: l.nomeNaFolha,
          admissao: l.admissao,
          funcao: l.funcao,
          colaboradorId: l.colaboradorId,
          acao: l.acao,
          dias: l.dias,
        })),
    }
    startTransition(async () => {
      try {
        const res = await confirmarImportacaoPonto(payload)
        if (res.error) {
          setErro(res.error)
          return
        }
        setImportados(res.importados ?? 0)
        setEtapa('concluido')
        toast.success('Importação concluída.')
      } finally {
        enviandoRef.current = false
      }
    })
  }

  if (etapa === 'concluido') {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 py-16 text-center dark:border-green-900 dark:bg-green-950/20">
        <CheckCircle2 className="size-12 text-green-600" />
        <div>
          <p className="text-lg font-semibold text-foreground">Importação concluída</p>
          <p className="text-sm text-muted-foreground">{importados} registros de ponto gravados.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/rh/ponto/cartao')}
          className="rounded-lg border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Ver Cartão de Ponto
        </button>
      </div>
    )
  }

  if (etapa === 'revisao') {
    const totalCasados = linhas.filter((l) => l.colaboradorId).length
    const totalNovos = linhas.filter((l) => !l.colaboradorId).length

    return (
      <div className="flex flex-col gap-4">
        {periodo.inicio && periodo.fim && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
            Período detectado: <strong>{periodo.inicio.split('-').reverse().join('/')}</strong> até{' '}
            <strong>{periodo.fim.split('-').reverse().join('/')}</strong> — {linhas.length} colaboradores
            encontrados no PDF ({totalCasados} já cadastrados, {totalNovos} novos)
          </div>
        )}

        <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
          {linhas.map((l) => {
            const resumo = resumoDias(l.dias)
            const casado = !!l.colaboradorId
            return (
              <div key={l.pagina} className="flex flex-col gap-2 bg-card px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {l.nomeNaFolha ?? `Página ${l.pagina} (nome não identificado)`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.cpf ?? 'CPF não identificado'} {l.funcao ? `· ${l.funcao}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {casado ? (
                      <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
                        Já cadastrado — {l.colaboradorNomeAtual}
                      </span>
                    ) : (
                      <select
                        value={l.acao}
                        onChange={(e) => setAcao(l.pagina, e.target.value as AcaoColaboradorImportacao)}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 outline-none dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                      >
                        <option value="ignorar">Não encontrado — ignorar</option>
                        <option value="cadastrar_ativo">Cadastrar como ativo</option>
                        <option value="cadastrar_desligado">Cadastrar como desligado</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="text-green-700 dark:text-green-400">{resumo.trabalhados} trabalhados</span>
                  <span className="text-red-700 dark:text-red-400">{resumo.faltas} faltas</span>
                  <span className="text-blue-700 dark:text-blue-400">{resumo.atestados} atestados</span>
                  <span className="text-purple-700 dark:text-purple-400">{resumo.folgasBH} folgas (BH)</span>
                </div>

                {l.avisos.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <FileWarning className="mt-0.5 size-3.5 shrink-0" />
                    <span>{l.avisos.join(' ')}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {erro}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setEtapa('upload')}
            disabled={isPending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Confirmar importação
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      action={handleAnalisar}
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center"
    >
      <Upload className="size-10 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium text-foreground">Selecione o PDF do Cartão Ponto (Secullum)</p>
        <p className="text-xs text-muted-foreground">Máx. 4 MB — o período é detectado automaticamente</p>
      </div>
      <input
        type="file"
        name="file"
        accept="application/pdf"
        required
        className="text-sm text-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
      />
      {erro && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {erro}
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Analisar PDF
      </button>
    </form>
  )
}
