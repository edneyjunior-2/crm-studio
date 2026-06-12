'use client'

import { useEffect, useState, useTransition } from 'react'
import { FileText, History, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const HIST_KEY = 'aurum_contratos_hist'

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
    return raw ? (JSON.parse(raw) as HistEntry[]) : []
  } catch {
    return []
  }
}

export function ContratosView() {
  const [historico, setHistorico] = useState<HistEntry[]>([])
  const [pendente, setPendente] = useState<ParceiroPendente | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setHistorico(readHist())
  }, [])

  // Recebe postMessage do iframe quando um PDF é gerado
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'aurum_contrato_gerado') return
      if (e.data?.entry) setHistorico(readHist())
      const p = e.data?.parceiro
      if (p?.mode && p?.fields) {
        setPendente({ mode: p.mode, fields: p.fields })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Recebe storage event (para sincronizar entre abas)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === HIST_KEY) setHistorico(readHist())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function limparHistorico() {
    try { localStorage.removeItem(HIST_KEY) } catch {}
    setHistorico([])
  }

  const pf = pendente?.mode === 'pf'
  const nomeExib = pendente ? (pf ? pendente.fields.PF_NOME : pendente.fields.REP_NOME) : ''
  const empresaExib = pendente && !pf ? pendente.fields.PARCEIRO_RAZAO : ''
  const docExib = pendente ? (pf ? pendente.fields.PF_CPF : pendente.fields.PARCEIRO_CNPJ) : ''

  function confirmarParceiro() {
    if (!pendente) return
    startTransition(async () => {
      const res = await salvarParceiroDoContrato({ mode: pendente.mode, fields: pendente.fields })
      if (res.error) {
        toast.error(res.error)
        return
      }
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
      <Tabs defaultValue="gerador" className="flex h-full flex-col">
        {/* Barra de tabs */}
        <div className="shrink-0 border-b border-border bg-background px-6 pt-3">
          <TabsList>
            <TabsTrigger value="gerador" className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Gerador
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-1.5">
              <History className="size-3.5" />
              Histórico
              {historico.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                  {historico.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Gerador — iframe ocupa toda a altura restante */}
        <TabsContent value="gerador" className="m-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
          <iframe
            src="/contratos/index.html"
            className="h-full w-full flex-1 border-0"
            title="Gerador de Contratos Aurum"
          />
        </TabsContent>

        {/* Histórico — lista de contratos gerados */}
        <TabsContent value="historico" className="m-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Histórico de contratos gerados</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Registros salvos neste navegador
                </p>
              </div>
              {historico.length > 0 && (
                <Button variant="outline" size="sm" onClick={limparHistorico}>
                  <Trash2 className="size-3.5" />
                  Limpar
                </Button>
              )}
            </div>

            {historico.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
                <History className="mb-3 size-10 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">Nenhum contrato gerado ainda</p>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  Exporte um PDF no Gerador para que o histórico apareça aqui.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {historico.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-foreground">{entry.nome}</span>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-2.5">
                      <Badge variant="outline" className="text-xs">
                        {entry.tipo}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(entry.data)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmação: adicionar parceiro ao CRM após gerar o contrato */}
      <Dialog open={!!pendente} onOpenChange={(v) => { if (!v && !isPending) setPendente(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Adicionar parceiro ao CRM?
            </DialogTitle>
            <DialogDescription>
              O contrato foi exportado. Deseja cadastrar este parceiro na aba Parceiros?
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Tipo</span>
              <span className="font-medium">{pf ? 'Pessoa Física' : 'Pessoa Jurídica'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Nome</span>
              <span className="min-w-0 break-words text-right font-medium">{nomeExib || '—'}</span>
            </div>
            {empresaExib && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Empresa</span>
                <span className="min-w-0 break-words text-right font-medium">{empresaExib}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{pf ? 'CPF' : 'CNPJ'}</span>
              <span className="font-medium">{docExib || '—'}</span>
            </div>
          </div>

          {!docExib && (
            <p className="text-xs text-amber-600">
              Sem {pf ? 'CPF' : 'CNPJ'} preenchido — não dá pra evitar duplicação por documento.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendente(null)} disabled={isPending}>
              Agora não
            </Button>
            <Button onClick={confirmarParceiro} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Adicionar aos Parceiros'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
