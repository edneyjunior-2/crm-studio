'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { atualizarFotoWhatsApp } from '@/app/(crm)/configuracoes/actions'

interface FotoWhatsappSectionProps {
  /** URL da foto atual do perfil comercial (null = número sem foto). */
  fotoUrl: string | null
  /** false quando as credenciais da integração não estão configuradas. */
  integracaoOk: boolean
}

const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024
const MIME_PERMITIDOS = ['image/jpeg', 'image/png']

/**
 * Foto do perfil comercial do WhatsApp — a foto que o CLIENTE vê quando
 * conversa com a empresa no app dele. Mesmo padrão de upload do
 * avatar-form.tsx (validação client-side + toast + loading).
 */
export function FotoWhatsappSection({ fotoUrl, integracaoOk }: FotoWhatsappSectionProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!MIME_PERMITIDOS.includes(file.type)) {
      toast.error('Formato não suportado. Envie a foto em JPEG ou PNG.')
      e.target.value = ''
      return
    }
    if (file.size > TAMANHO_MAXIMO_BYTES) {
      toast.error('Arquivo muito grande. A Meta aceita fotos de até 5 MB.')
      e.target.value = ''
      return
    }

    setEnviando(true)
    const formData = new FormData()
    formData.append('file', file)
    const resultado = await atualizarFotoWhatsApp(formData)
    setEnviando(false)
    e.target.value = ''

    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao trocar a foto do WhatsApp.')
      return
    }
    toast.success('Foto do WhatsApp atualizada. Pode levar alguns minutos para aparecer para os clientes.')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h3 className="text-base font-medium text-foreground">Foto do WhatsApp</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        A foto que seus clientes veem quando conversam com a sua empresa no WhatsApp.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa da Meta, não é um asset estático
            <img src={fotoUrl} alt="Foto do perfil da empresa no WhatsApp" className="size-full object-cover" />
          ) : (
            <MessageCircle className="size-6 text-muted-foreground" />
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando || !integracaoOk}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            {enviando ? 'Enviando…' : 'Alterar foto'}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            {integracaoOk
              ? 'JPEG ou PNG, de preferência quadrada — tamanho máximo de 5 MB.'
              : 'A integração com o WhatsApp ainda não está configurada para a sua conta — fale com o suporte do CRM Studio.'}
          </p>
        </div>
      </div>
    </div>
  )
}
