'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, MessageCircle, Check } from 'lucide-react'
import { toast } from 'sonner'
import { atualizarFotoWhatsApp, atualizarPerfilWhatsApp } from '@/app/(crm)/configuracoes/actions'

interface PerfilComercial {
  about: string | null
  address: string | null
  description: string | null
  email: string | null
  websites: string[] | null
}

interface FotoWhatsappSectionProps {
  /** URL da foto atual do perfil comercial (null = número sem foto). */
  fotoUrl: string | null
  /** false quando faltam as credenciais necessárias pra TROCAR a foto (inclui WHATSAPP_APP_ID). */
  integracaoOk: boolean
  /** Campos de texto do perfil comercial (null quando a leitura falhou). */
  perfil: PerfilComercial | null
  /** false quando faltam as credenciais básicas (não exige WHATSAPP_APP_ID — só a foto exige). */
  perfilOk: boolean
}

const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024
const MIME_PERMITIDOS = ['image/jpeg', 'image/png']

/**
 * Foto + dados do perfil comercial do WhatsApp — o que o CLIENTE vê quando
 * conversa com a empresa no app dele. Mesmo padrão de upload do
 * avatar-form.tsx (validação client-side + toast + loading).
 */
export function FotoWhatsappSection({ fotoUrl, integracaoOk, perfil, perfilOk }: FotoWhatsappSectionProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [about, setAbout] = useState(perfil?.about ?? '')
  const [description, setDescription] = useState(perfil?.description ?? '')
  const [address, setAddress] = useState(perfil?.address ?? '')
  const [email, setEmail] = useState(perfil?.email ?? '')
  const [site, setSite] = useState(perfil?.websites?.[0] ?? '')

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

  async function salvarPerfil() {
    setSalvandoPerfil(true)
    const resultado = await atualizarPerfilWhatsApp({
      about: about.trim() || null,
      description: description.trim() || null,
      address: address.trim() || null,
      email: email.trim() || null,
      websites: site.trim() ? [site.trim()] : [],
    })
    setSalvandoPerfil(false)

    if (!resultado.ok) {
      toast.error(resultado.erro ?? 'Erro ao salvar o perfil do WhatsApp.')
      return
    }
    toast.success('Perfil do WhatsApp atualizado.')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h3 className="text-base font-medium text-foreground">Perfil do WhatsApp</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        O que seus clientes veem quando conversam com a sua empresa no WhatsApp.
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

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Sobre (frase curta, some abaixo do nome)
          <input
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={139}
            disabled={!perfilOk}
            placeholder="Ex.: Atendimento de segunda a sexta, 9h às 18h"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Descrição da empresa
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={!perfilOk}
            placeholder="O que a sua empresa faz"
            className="resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Endereço
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!perfilOk}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!perfilOk}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          Site
          <input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="https://"
            disabled={!perfilOk}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={salvarPerfil}
        disabled={salvandoPerfil || !perfilOk}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {salvandoPerfil ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {salvandoPerfil ? 'Salvando…' : 'Salvar perfil'}
      </button>
      {!perfilOk && (
        <p className="mt-2 text-xs text-muted-foreground">
          A integração com o WhatsApp ainda não está configurada para a sua conta — fale com o suporte do CRM Studio.
        </p>
      )}
    </div>
  )
}
