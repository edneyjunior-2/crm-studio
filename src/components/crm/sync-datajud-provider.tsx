'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { RefreshCw, X, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface SyncCtx {
  running:  boolean
  iniciar:  () => void
}

const Ctx = createContext<SyncCtx | null>(null)

export function useSyncDataJud() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSyncDataJud fora do SyncDataJudProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SyncResult {
  sincronizados:       number
  novas_movimentacoes: number
  erros:               string[]
  tem_mais:            boolean
  proximo:             number
  total:               number
  error?:              string
}

// ---------------------------------------------------------------------------
// Provider + Painel flutuante
// ---------------------------------------------------------------------------
export function SyncDataJudProvider({ children }: { children: ReactNode }) {
  const [running,    setRunning]    = useState(false)
  const [showPanel,  setShowPanel]  = useState(false)
  const [collapsed,  setCollapsed]  = useState(false)
  const [done,       setDone]       = useState(false)
  const [progresso,  setProgresso]  = useState(0)
  const [totalProc,  setTotalProc]  = useState(0)
  const [feitos,     setFeitos]     = useState(0)
  const [totalNovas, setTotalNovas] = useState(0)
  const [erroFatal,  setErroFatal]  = useState<string | null>(null)

  function reset() {
    setRunning(false); setDone(false); setProgresso(0)
    setTotalProc(0); setFeitos(0); setTotalNovas(0); setErroFatal(null)
    setCollapsed(false)
  }

  const iniciar = useCallback(async () => {
    reset()
    setRunning(true)
    setShowPanel(true)

    let offset    = 0
    let total: number | undefined
    let acumNovas = 0

    try {
      while (true) {
        const res  = await fetch('/api/processos/sincronizar', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ offset, total }),
        })
        const data = await res.json() as SyncResult

        if (!res.ok || data.error) {
          setErroFatal(data.error ?? 'Erro ao sincronizar. Tente novamente.')
          break
        }

        total = data.total
        setTotalProc(data.total)
        acumNovas += data.novas_movimentacoes
        setFeitos(Math.min(data.proximo, data.total))
        setTotalNovas(acumNovas)
        setProgresso(Math.round((Math.min(data.proximo, data.total) / data.total) * 100))

        if (!data.tem_mais) break
        offset = data.proximo

        await new Promise<void>((r) => setTimeout(r, 300))
      }
    } catch {
      setErroFatal('A requisição demorou demais. Clique em "Continuar" para retomar de onde parou.')
    }

    setRunning(false)
    setDone(true)
  }, [])

  return (
    <Ctx.Provider value={{ running, iniciar }}>
      {children}

      {/* ── Painel flutuante (persiste entre navegações) ── */}
      {showPanel && (
        <div className="fixed bottom-5 right-5 z-50 w-80 rounded-2xl border border-border bg-background shadow-xl">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <RefreshCw
                className={[
                  'size-4 shrink-0',
                  running       ? 'animate-spin text-primary'
                  : done && !erroFatal ? 'text-green-500'
                  : 'text-muted-foreground',
                ].join(' ')}
              />
              <span className="text-sm font-semibold text-foreground">Sincronizar DataJud</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={collapsed ? 'Expandir' : 'Minimizar'}
              >
                {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {!running && (
                <button
                  type="button"
                  onClick={() => { setShowPanel(false); reset() }}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* Corpo */}
          {!collapsed && (
            <div className="flex flex-col gap-3 p-4">

              {/* Em progresso */}
              {running && !erroFatal && (
                <>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    {totalProc === 0 ? (
                      <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-primary/60 animate-pulse" />
                    ) : (
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${progresso}%` }}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    {totalProc === 0 ? (
                      <span>Iniciando…</span>
                    ) : (
                      <>
                        <span>{feitos} de {totalProc} processos</span>
                        <span className="tabular-nums">{progresso}%</span>
                      </>
                    )}
                  </div>
                  {totalNovas > 0 && (
                    <p className="text-xs font-medium text-primary">
                      {totalNovas} nova{totalNovas !== 1 ? 's' : ''} movimentaç{totalNovas !== 1 ? 'ões' : 'ão'} encontrada{totalNovas !== 1 ? 's' : ''}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Você pode navegar normalmente — a sincronização continua aqui.
                  </p>
                </>
              )}

              {/* Concluído */}
              {done && !erroFatal && (
                <div className="flex flex-col items-center gap-2 py-1 text-center">
                  <CheckCircle2 className="size-8 text-green-500" />
                  <p className="text-sm font-semibold text-foreground">Concluído!</p>
                  <p className="text-xs text-muted-foreground">
                    {feitos} processo{feitos !== 1 ? 's' : ''} verificado{feitos !== 1 ? 's' : ''}
                    {totalNovas > 0
                      ? ` · ${totalNovas} nova${totalNovas !== 1 ? 's' : ''} movimentaç${totalNovas !== 1 ? 'ões' : 'ão'}`
                      : ' · Nenhuma novidade'}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowPanel(false); reset(); window.location.reload() }}
                    className="mt-1 h-8 w-full rounded-lg bg-foreground text-xs font-semibold text-background transition-colors hover:bg-foreground/90"
                  >
                    Atualizar página
                  </button>
                </div>
              )}

              {/* Erro */}
              {erroFatal && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    {erroFatal}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowPanel(false); reset() }}
                      className="h-8 flex-1 rounded-lg border border-border text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      Fechar
                    </button>
                    <button
                      type="button"
                      onClick={iniciar}
                      className="h-8 flex-1 rounded-lg bg-foreground text-xs font-semibold text-background transition-colors hover:bg-foreground/90"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
