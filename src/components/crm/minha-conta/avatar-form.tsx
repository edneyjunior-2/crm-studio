'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { atualizarAvatar } from '@/app/(crm)/minha-conta/avatar-actions'

interface AvatarFormProps {
  avatarUrl: string | null
  nome: string
}

function getIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return partes.slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

const TAMANHO_MAXIMO_BYTES = 3 * 1024 * 1024
const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

export function AvatarForm({ avatarUrl, nome }: AvatarFormProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(avatarUrl)
  const [enviando, setEnviando] = useState(false)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!MIME_PERMITIDOS.includes(file.type)) {
      toast.error('Formato não suportado. Envie uma foto em JPEG, PNG ou WEBP.')
      e.target.value = ''
      return
    }
    if (file.size > TAMANHO_MAXIMO_BYTES) {
      toast.error('Arquivo muito grande. Limite de 3 MB.')
      e.target.value = ''
      return
    }

    const previewAnterior = preview
    const previewLocal = URL.createObjectURL(file)
    setPreview(previewLocal)
    setEnviando(true)

    const formData = new FormData()
    formData.append('file', file)
    const resultado = await atualizarAvatar(formData)

    setEnviando(false)
    URL.revokeObjectURL(previewLocal)
    e.target.value = ''

    if (!resultado.sucesso) {
      toast.error(resultado.erro ?? 'Erro ao trocar a foto.')
      setPreview(previewAnterior)
      return
    }

    setPreview(resultado.avatarUrl ?? null)
    toast.success('Foto de perfil atualizada.')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary ring-2 ring-border">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL do Storage, não é um asset estático
          <img src={preview} alt="Sua foto de perfil" className="size-full object-cover" />
        ) : (
          getIniciais(nome)
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          {enviando ? 'Enviando…' : 'Alterar foto'}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          JPEG, PNG ou WEBP — tamanho máximo de 3 MB.
        </p>
      </div>
    </div>
  )
}
