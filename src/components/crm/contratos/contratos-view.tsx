'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { FileText, History, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { salvarParceiroDoContrato } from '@/app/(crm)/parceiros/actions'

interface HistEntry {
  nome: string
  tipo: 'PJ' | 'PF'
  data: string
}

const HIST_KEY = 'aurum_contratos_hist_v2'

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} às ${hh}:${min}`
}

function readHist(): HistEntry[] {
  try {
    const raw = localStorage.getItem(HIST_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list.map((e: { mode?: string; ts?: string; fields?: Record<string, string> }) => ({
      nome: e?.mode === 'pf' ? e?.fields?.PF_NOME || '—' : e?.fields?.PARCEIRO_RAZAO || '—',
      tipo: (e?.mode === 'pf' ? 'PF' : 'PJ') as 'PF' | 'PJ',
      data: e?.ts ?? '',
    }))
  } catch {
    return []
  }
}

export function ContratosView({
  templateUrl,
  emRevisao = false,
}: {
  templateUrl?: string | null
  emRevisao?: boolean
}) {
  const [historico, setHistorico] = useState<HistEntry[]>([])
  const [activeTab, setActiveTab] = useState<'gerador' | 'historico'>('gerador')
  const [, startTransition] = useTransition()
  // Evita cadastrar o mesmo contrato duas vezes se o iframe disparar a mensagem repetida
  const ultimoDoc = useRef<string | null>(null)

  useEffect(() => {
    setHistorico(readHist())
  }, [])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'aurum_contrato_gerado') return
      if (e.data?.entry) setHistorico(readHist())
      const p = e.data?.parceiro
      if (!p?.mode || !p?.fields) return

      // Cadastro AUTOMÁTICO do parceiro a partir do contrato gerado.
      const doc = p.mode === 'pf' ? p.fields.PF_CPF : p.fields.PARCEIRO_CNPJ
      const chave = `${p.mode}:${doc || p.fields.PF_NOME || p.fields.PARCEIRO_RAZAO || ''}`
      if (chave === ultimoDoc.current) return // dedup de mensagem repetida
      ultimoDoc.current = chave

      startTransition(async () => {
        const res = await salvarParceiroDoContrato({ mode: p.mode, fields: p.fields })
        if (res.error) {
          toast.error(`Não foi possível cadastrar o parceiro: ${res.error}`)
          return
        }
        toast.success(
          res.created
            ? `Parceiro "${res.nome}" cadastrado automaticamente nos Parceiros`
            : `Parceiro "${res.nome}" atualizado a partir do contrato`,
        )
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [startTransition])

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === HIST_KEY) setHistorico(readHist())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Sem template configurado para esta empresa → estado vazio
  if (!templateUrl) {
    const titulo = emRevisao
      ? 'Modelo em revisão'
      : 'Gerador de contratos em retrabalho'
    const descricao = emRevisao
      ? 'Seu modelo de contrato foi recebido e está sendo conferido. Em breve ele será liberado e aparecerá aqui.'
      : 'Estamos reconstruindo o gerador de contratos para ser white-label: com a sua marca, os seus modelos e os seus dados. Em breve por aqui.'
    const badge = emRevisao ? 'Em revisão' : 'Em breve'

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <FileText className="size-7" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-[-0.01em]">{titulo}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {descricao}
        </p>
        <span className="mt-5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          {badge}
        </span>
      </div>
    )
  }

  function limparHistorico() {
    try { localStorage.removeItem(HIST_KEY) } catch {}
    setHistorico([])
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-56px)] flex-col">
      {/* Tabs */}
      <div className="shrink-0 border-b border-border bg-background px-6 pt-3">
        <div className="flex gap-1">
          {(['gerador', 'historico'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'gerador' ? <FileText className="size-3.5" /> : <History className="size-3.5" />}
              {tab === 'gerador' ? 'Gerador' : `Histórico${historico.length > 0 ? ` (${historico.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* Gerador */}
      {activeTab === 'gerador' && (
        <iframe
          src={`${templateUrl}?v=20260626`}
          className="h-full w-full flex-1 border-0"
          title="Gerador de Contratos"
        />
      )}

      {/* Histórico */}
      {activeTab === 'historico' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Histórico de contratos gerados</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Registros salvos neste navegador</p>
              </div>
              {historico.length > 0 && (
                <button
                  type="button"
                  onClick={limparHistorico}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <Trash2 className="size-3.5" /> Limpar
                </button>
              )}
            </div>

            {historico.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <History className="mb-3 size-10 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">Nenhum contrato gerado ainda</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {historico.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{entry.nome}</span>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-2.5">
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">{entry.tipo}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(entry.data)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
