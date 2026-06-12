'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, Upload, Trash2, Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { uploadContrato, removeContrato, getContratoUrl } from '@/app/(crm)/parceiros/[id]/actions'

interface ContratoUploadProps {
  parceiroId: string
  contratoUrl: string | null
  contratoNome: string | null
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export function ContratoUpload({ parceiroId, contratoUrl, contratoNome }: ContratoUploadProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isPendingUpload, startUpload] = useTransition()
  const [isPendingRemove, startRemove] = useTransition()
  const [isPendingView, startView] = useTransition()

  function handleFileSelect(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Envie PDF, DOC ou DOCX.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 10 MB.')
      return
    }

    const formData = new FormData()
    formData.set('contrato', file)

    startUpload(async () => {
      const result = await uploadContrato(parceiroId, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Contrato enviado com sucesso.')
      router.refresh()
    })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleRemove() {
    startRemove(async () => {
      const result = await removeContrato(parceiroId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Contrato removido.')
      router.refresh()
    })
  }

  function handleView() {
    startView(async () => {
      const result = await getContratoUrl(parceiroId)
      if (result.error || !result.url) {
        toast.error(result.error ?? 'Erro ao abrir o contrato.')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    })
  }

  if (contratoUrl && contratoNome) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="size-5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm text-foreground">{contratoNome}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleView}
            disabled={isPendingView}
          >
            {isPendingView ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Eye className="size-3.5" />
            )}
            Visualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isPendingUpload}
          >
            {isPendingUpload ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Substituir
          </Button>

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={isPendingRemove}
                />
              }
            >
              {isPendingRemove ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover contrato?</AlertDialogTitle>
                <AlertDialogDescription>
                  O arquivo será excluído permanentemente. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleRemove}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    )
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !isPendingUpload && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      } ${isPendingUpload ? 'pointer-events-none opacity-60' : ''}`}
    >
      {isPendingUpload ? (
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      ) : (
        <Upload className="size-8 text-muted-foreground/50" />
      )}
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {isPendingUpload ? 'Enviando contrato...' : 'Arraste o arquivo ou clique para selecionar'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/60">
          PDF, DOC ou DOCX — máximo 10 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
