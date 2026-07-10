'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface SyncCtx {
  running: boolean
  iniciar: (processoId: string) => void
}

const Ctx = createContext<SyncCtx | null>(null)

export function useSyncDjen() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSyncDjen fora do SyncDjenProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
// Contrato real de POST /api/processos/[id]/publicacoes/sincronizar:
// `novas` é o total inserido para o advogado (pode incluir outros processos
// dele); `novas_neste_processo` é escopado a este processo — é o que a
// timeline (recarregada via router.refresh()) de fato exibe, então é o que
// o toast deve reportar para ficar coerente com a tela.
interface SyncResult {
  novas?: number
  novas_neste_processo?: number
  error?: string
}

// ---------------------------------------------------------------------------
// Provider — sincronização é por processo (não cross-processo como o
// DataJud), então não precisa do painel flutuante persistente entre
// navegações: um toast de sucesso/erro (sonner) + router.refresh() bastam.
// ---------------------------------------------------------------------------
export function SyncDjenProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  const iniciar = useCallback((processoId: string) => {
    setRunning(true)
    void (async () => {
      try {
        const res = await fetch(`/api/processos/${processoId}/publicacoes/sincronizar`, {
          method: 'POST',
        })
        const data = (await res.json().catch(() => ({}))) as SyncResult

        if (!res.ok || data.error) {
          toast.error(data.error ?? 'Erro ao sincronizar publicações do DJEN. Tente novamente.')
        } else {
          const novas = data.novas_neste_processo ?? data.novas ?? 0
          toast.success(
            novas > 0
              ? `${novas} nova${novas !== 1 ? 's' : ''} publicaç${novas !== 1 ? 'ões' : 'ão'} encontrada${novas !== 1 ? 's' : ''} no DJEN.`
              : 'Sincronização concluída. Nenhuma publicação nova.',
          )
          router.refresh()
        }
      } catch {
        toast.error('Não foi possível conectar ao DJEN. Tente novamente.')
      } finally {
        setRunning(false)
      }
    })()
  }, [router])

  return <Ctx.Provider value={{ running, iniciar }}>{children}</Ctx.Provider>
}
