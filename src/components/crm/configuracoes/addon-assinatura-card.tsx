'use client'

/**
 * Card de venda do add-on "Assinatura Eletrônica" (R$49/mês) em /configuracoes
 * (spec addon-assinatura-eletronica-zapsign.md). Essa página é admin-only
 * (configuracoes/page.tsx redireciona sócio) — por isso o botão de compra
 * TAMBÉM existe no banner do Dashboard (que todos veem, inclusive sócio).
 *
 * Quando a empresa já tem o add-on: status "Ativo — R$ 49/mês" (sem botão).
 */

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { FileSignature } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { contratarAddon } from '@/app/(crm)/configuracoes/actions'
import { ADDON_ASSINATURA } from '@/lib/addons'

/**
 * Toast de retorno do Checkout (successUrl=/configuracoes?addon=ok — ver
 * contratarAddon). Isolado num componente próprio porque useSearchParams
 * exige um boundary de Suspense (mesmo padrão de src/components/analytics/ga.tsx).
 */
function AddonRetornoToast() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get('addon') === 'ok') {
      toast.success('Pagamento confirmado! A ativação pode levar alguns instantes.')
      router.replace('/configuracoes')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export function AddonAssinaturaCard({ ativo }: { ativo: boolean }) {
  const [comprando, setComprando] = useState(false)

  function ativar() {
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
    <div className="flex flex-col gap-4">
      <Suspense fallback={null}>
        <AddonRetornoToast />
      </Suspense>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h3 className="text-base font-medium text-foreground">Assinatura eletrônica</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Envie contratos para assinatura digital com validade jurídica, direto do CRM.
        </p>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        {ativo ? (
          <div className="flex items-center gap-2">
            <StatusBadge variant="ativo_generico">Ativo</StatusBadge>
            <span className="text-sm text-muted-foreground">R$ 49/mês</span>
          </div>
        ) : (
          <p className="text-sm text-foreground">
            <strong className="font-semibold">R$ 49/mês</strong> — envie contratos para assinatura
            digital, acompanhe quem já assinou e guarde tudo no lugar certo.
          </p>
        )}

        {!ativo && (
          <Button type="button" onClick={ativar} disabled={comprando}>
            {comprando ? 'Abrindo checkout…' : 'Ativar agora'}
          </Button>
        )}
      </div>
    </div>
  )
}
