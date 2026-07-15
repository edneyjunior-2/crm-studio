'use client'

/**
 * Banner de venda do add-on "Assinatura Eletrônica" (R$49/mês) — topo do
 * Dashboard, para TODOS os usuários do tenant que ainda não têm o add-on
 * (spec addon-assinatura-eletronica-zapsign.md). A decisão de renderizar ou
 * não (temAddon + plano !== 'interno') é do server component (dashboard/page.tsx)
 * — este componente só cuida de mostrar/dispensar/comprar.
 *
 * Dispensável via localStorage, reaparecendo depois de 7 dias — pressão sem
 * virar propaganda infinita. Estado inicial SEMPRE `false` (oculto): olhar
 * localStorage síncrono no primeiro render causaria mismatch de hidratação
 * (o servidor não tem acesso a localStorage) — por isso a checagem real roda
 * num useEffect (mesmo padrão de tour-boas-vindas.tsx).
 */

import { useEffect, useState } from 'react'
import { X, FileSignature } from 'lucide-react'
import { toast } from 'sonner'
import { contratarAddon } from '@/app/(crm)/configuracoes/actions'
import { ADDON_ASSINATURA } from '@/lib/addons'

const DISMISS_KEY = 'crmstudio_addon_assinatura_dispensado_em'
const REAPPEAR_MS = 7 * 24 * 60 * 60 * 1000

function foiDispensadoRecentemente(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const dispensadoEm = Number(raw)
    if (!Number.isFinite(dispensadoEm)) return false
    return Date.now() - dispensadoEm < REAPPEAR_MS
  } catch {
    return false
  }
}

function marcarDispensado(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // localStorage indisponível — degrada sem erro (banner só reaparece na próxima visita)
  }
}

export function AddonAssinaturaBanner({ podeComprar }: { podeComprar: boolean }) {
  const [visivel, setVisivel] = useState(false)
  const [comprando, setComprando] = useState(false)

  useEffect(() => {
    setVisivel(!foiDispensadoRecentemente())
  }, [])

  if (!visivel) return null

  function dispensar() {
    marcarDispensado()
    setVisivel(false)
  }

  function ativarAgora() {
    setComprando(true)
    contratarAddon(ADDON_ASSINATURA).then((res) => {
      if (res.error) {
        toast.error(res.error)
        setComprando(false)
        return
      }
      if (res.checkoutUrl) window.location.href = res.checkoutUrl
    })
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <FileSignature className="size-4" />
        </div>
        <p className="text-sm text-foreground">
          <strong className="font-semibold">Seus contratos, assinados sem sair do CRM.</strong>{' '}
          Envie para assinatura digital com validade jurídica, acompanhe quem já assinou e guarde
          tudo no lugar certo. <strong className="font-semibold">R$ 49/mês.</strong>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
        {podeComprar ? (
          <button
            type="button"
            onClick={ativarAgora}
            disabled={comprando}
            className="whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {comprando ? 'Abrindo checkout…' : 'Ativar agora'}
          </button>
        ) : (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            Fale com o administrador da conta
          </span>
        )}
        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar"
          title="Dispensar por 7 dias"
          className="rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
