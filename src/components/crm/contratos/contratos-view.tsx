'use client'

import { useEffect, useState, useTransition } from 'react'
import { FileText, History, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { salvarParceiroDoContrato } from '@/app/(crm)/parceiros/actions'

interface HistEntry {
  nome: string
  tipo: 'PJ' | 'PF'
  data: string
}

interface ParceiroPendente {
  mode: 'pf' | 'pj'
  fields: Record<string, string>
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

export function ContratosView({ templateUrl }: { templateUrl?: string | null }) {
  const [historico, setHistorico] = useState<HistEntry[]>([])
  const [pendente, setPendente] = useState<ParceiroPendente | null>(null)
  const [activeTab, setActiveTab] = useState<'gerador' | 'historico'>('gerador')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setHistorico(readHist())
  }, [])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'aurum_contrato_gerado') return
      if (e.data?.entry) setHistorico(readHist())
      const p = e.data?.parceiro
      if (p?.mode && p?.fields) setPendente({ mode: p.mode, fields: p.fields })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === HIST_KEY) setHistorico(readHist())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Sem template configurado para esta empresa → "Em breve"
  if (!templateUrl) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <FileText className="size-7" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-[-0.01em]">Gerador de contratos em retrabalho</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Estamos reconstruindo o gerador de contratos para ser white-label: com a sua marca, os seus
          modelos e os seus dados. Em breve por aqui.
        </p>
        <span className="mt-5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          Em breve
        </span>
      </div>
    )
  }

  const pf = pendente?.mode === 'pf'
  const nomeExib = pendente ? (pf ? pendente.fields.PF_NOME : pendente.fields.REP_NOME) : ''
  const empresaExib = pendente && !pf ? pendente.fields.PARCEIRO_RAZAO : ''
  const docExib = pendente ? (pf ? pendente.fields.PF_CPF : pendente.fields.PARCEIRO_CNPJ) : ''

  function limparHistorico() {
    try { localStorage.removeItem(HIST_KEY) } catch {}
    setHistorico([])
  }

  function confirmarParceiro() {
    if (!pendente) return
    startTransition(async () => {
      const res = await salvarParceiroDoContrato({ mode: pendente.mode, fields: pendente.fields })
      if (res.error) { toast.error(res.error); return }
      toast.success(
        res.created
          ? `Parceiro "${res.nome}" adicionado aos Parceiros`
          : `Parceiro "${res.nome}" já existia — dados atualizados`
      )
      setPendente(null)
    })
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

      {/* Confirmação: adicionar parceiro ao CRM */}
      {pendente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-1 flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              <h3 className="font-semibold">Adicionar parceiro ao CRM?</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              O contrato foi exportado. Deseja cadastrar este parceiro na aba Parceiros?
            </p>
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-medium">{pf ? 'Pessoa Física' : 'Pessoa Jurídica'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span className="min-w-0 break-words text-right font-medium">{nomeExib || '—'}</span></div>
              {empresaExib && <div className="flex justify-between"><span className="text-muted-foreground">Empresa</span><span className="min-w-0 break-words text-right font-medium">{empresaExib}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">{pf ? 'CPF' : 'CNPJ'}</span><span className="font-medium">{docExib || '—'}</span></div>
            </div>
            {!docExib && <p className="mb-4 text-xs text-amber-600">Sem {pf ? 'CPF' : 'CNPJ'} — não dá pra evitar duplicação por documento.</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendente(null)} disabled={isPending}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Agora não</button>
              <button type="button" onClick={confirmarParceiro} disabled={isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {isPending ? 'Salvando...' : 'Adicionar aos Parceiros'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
