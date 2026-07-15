'use client'

/**
 * Card de venda do add-on "Bloco de +10 usuários" (R$50/mês, empilhável) em
 * /configuracoes (spec addon-bloco-10-usuarios.md). Mesmo padrão de compra de
 * AddonAssinaturaCard (contratarAddon → redireciona pro checkoutUrl), mas
 * SEMPRE mostra o botão de comprar (mesmo já tendo blocos ativos): este add-on
 * é quantitativo — comprar de novo empilha mais 10 usuários, não é "já ativo".
 *
 * Toast de retorno do Checkout (?addon=ok): AddonAssinaturaCard já renderiza
 * AddonRetornoToast nesta mesma página, e esse toast dispara pra QUALQUER
 * retorno de add-on (não checa slug) — não duplicado aqui de propósito.
 *
 * Sem limite de quantos blocos comprar pela UI — contratarAddon já valida
 * tudo no servidor (inclusive bloquear empresa Business/interno).
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { contratarAddon } from '@/app/(crm)/configuracoes/actions'
import { ADDON_BLOCO_USUARIOS } from '@/lib/addons'

export function BlocoUsuariosCard({
  blocosComprados,
  podeComprar,
}: {
  blocosComprados: number
  podeComprar: boolean
}) {
  const [comprando, setComprando] = useState(false)

  function comprar() {
    setComprando(true)
    contratarAddon(ADDON_BLOCO_USUARIOS).then((res) => {
      if (res.error) {
        toast.error(res.error)
        setComprando(false)
        return
      }
      if (res.checkoutUrl) window.location.href = res.checkoutUrl
    })
  }

  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm text-foreground">
            Cada bloco adiciona <strong className="font-semibold">10 usuários</strong> —{' '}
            <strong className="font-semibold">R$ 50/mês</strong>.
          </p>
          {blocosComprados > 0 && (
            <p className="text-sm text-muted-foreground">
              Você tem {blocosComprados} {blocosComprados === 1 ? 'bloco contratado' : 'blocos contratados'}.
            </p>
          )}
        </div>
      </div>

      {podeComprar && (
        <Button type="button" onClick={comprar} disabled={comprando}>
          {comprando ? 'Abrindo checkout…' : 'Comprar bloco de +10 usuários'}
        </Button>
      )}
    </div>
  )
}
