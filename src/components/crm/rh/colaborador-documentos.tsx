'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Upload,
  FileText,
  Download,
  Trash2,
  ShieldAlert,
  Loader2,
  FolderOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  uploadDocumento,
  listarDocumentos,
  gerarUrlDownload,
  excluirDocumento,
} from '@/app/(crm)/rh/documentos-actions'
import type { ColaboradorDocumento, TipoDocumento } from '@/types/rh'
import { TIPO_DOCUMENTO_LABEL, TIPOS_SENSIVEIS } from '@/types/rh'

// ============================================================================
// Helpers
// ============================================================================

function formatarTamanho(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatarDataHora(iso: string): string {
  const d = new Date(iso)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} ${h}:${m}`
}

const TIPOS_DOCUMENTO_LISTA = Object.keys(TIPO_DOCUMENTO_LABEL) as TipoDocumento[]

// ============================================================================
// Linha de documento
// ============================================================================

interface DocumentoRowProps {
  documento: ColaboradorDocumento
  onDelete: (id: string) => void
  isDeleting: boolean
}

function DocumentoRow({ documento, onDelete, isDeleting }: DocumentoRowProps) {
  const [isDownloading, startDownloadTransition] = useTransition()

  function handleDownload() {
    startDownloadTransition(async () => {
      const result = await gerarUrlDownload(documento.id)
      if (result.error) {
        toast.error(`Erro ao baixar: ${result.error}`)
        return
      }
      if (result.url) {
        // Abre a URL assinada numa aba nova (validade: 60 s)
        window.open(result.url, '_blank', 'noopener,noreferrer')
      }
    })
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      {/* Ícone */}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileText className="size-4 text-muted-foreground" />
      </div>

      {/* Informações */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {documento.nome_original}
          </span>
          {documento.sensivel && (
            <Badge
              variant="destructive"
              className="flex shrink-0 items-center gap-1 text-xs"
            >
              <ShieldAlert className="size-3" />
              Sensível
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{TIPO_DOCUMENTO_LABEL[documento.tipo]}</span>
          <span>·</span>
          <span>{formatarTamanho(documento.tamanho_bytes)}</span>
          <span>·</span>
          <span>{formatarDataHora(documento.created_at)}</span>
        </div>
      </div>

      {/* Ações */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDownload}
          disabled={isDownloading}
          title="Baixar documento"
        >
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          <span className="sr-only">Baixar</span>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isDeleting}
                title="Excluir documento"
              />
            }
          >
            {isDeleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            <span className="sr-only">Excluir</span>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir documento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir{' '}
                <strong>{documento.nome_original}</strong>? Esta ação não pode ser desfeita.
                {documento.sensivel && (
                  <span className="mt-2 block rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    Este documento contém dados pessoais sensíveis (LGPD Art. 11).
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => onDelete(documento.id)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

// ============================================================================
// Zona de upload (drag & drop)
// ============================================================================

interface UploadZoneProps {
  colaboradorId: string
  onSuccess: () => void
}

function UploadZone({ colaboradorId, onSuccess }: UploadZoneProps) {
  const [tipo, setTipo] = useState<TipoDocumento | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Detecta se o tipo selecionado é sensível (marcação automática LGPD)
  const isSensivelAuto =
    tipo !== '' && TIPOS_SENSIVEIS.includes(tipo as TipoDocumento)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleSubmit = useCallback(() => {
    if (!tipo) {
      toast.error('Selecione o tipo do documento.')
      return
    }
    if (!file) {
      toast.error('Selecione um arquivo.')
      return
    }

    const formData = new FormData()
    formData.set('colaborador_id', colaboradorId)
    formData.set('tipo', tipo)
    formData.set('sensivel', String(isSensivelAuto))
    formData.set('file', file)

    startTransition(async () => {
      const result = await uploadDocumento(formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Documento enviado com sucesso.')
      setFile(null)
      setTipo('')
      if (inputRef.current) inputRef.current.value = ''
      onSuccess()
    })
  }, [tipo, file, colaboradorId, isSensivelAuto, onSuccess])

  return (
    <div className="flex flex-col gap-3">
      {/* Tipo do documento */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tipo-doc">Tipo de documento</Label>
        {/* Label manual no trigger — convenção Base UI Select */}
        <Select
          value={tipo || undefined}
          onValueChange={(v) => setTipo(v as TipoDocumento)}
        >
          <SelectTrigger id="tipo-doc" className="w-full max-w-xs">
            {tipo ? (
              <span className="flex flex-1 text-left">
                {TIPO_DOCUMENTO_LABEL[tipo as TipoDocumento]}
              </span>
            ) : (
              <SelectValue placeholder="Selecione o tipo..." />
            )}
          </SelectTrigger>
          <SelectContent>
            {TIPOS_DOCUMENTO_LISTA.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_DOCUMENTO_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Aviso LGPD para tipos sensíveis */}
      {isSensivelAuto && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Documento de saúde — dado pessoal sensível (LGPD Art. 11). Acesso restrito
            a administradores e registrado em log de auditoria.
          </span>
        </div>
      )}

      {/* Zona de drag & drop */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-primary/5',
        ].join(' ')}
      >
        <Upload className="size-6" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {file ? file.name : 'Clique ou arraste um arquivo aqui'}
          </span>
          <span className="text-xs">
            {file
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
              : 'PDF, imagem, Word — máx. 50 MB'}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={handleFileChange}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isPending || !file || !tipo}
        size="sm"
        className="self-start"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Upload className="size-4" />
            Enviar documento
          </>
        )}
      </Button>
    </div>
  )
}

// ============================================================================
// Componente principal: ColaboradorDocumentos (AC5)
// ============================================================================

interface ColaboradorDocumentosProps {
  colaboradorId: string
  documentosIniciais: ColaboradorDocumento[]
}

export function ColaboradorDocumentos({
  colaboradorId,
  documentosIniciais,
}: ColaboradorDocumentosProps) {
  const [documentos, setDocumentos] = useState<ColaboradorDocumento[]>(documentosIniciais)
  const [isReloading, startReloadTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  /** Recarrega a lista do servidor após alteração */
  function recarregar() {
    startReloadTransition(async () => {
      const result = await listarDocumentos(colaboradorId)
      if (result.error) {
        toast.error(`Erro ao atualizar lista: ${result.error}`)
        return
      }
      setDocumentos(result.data ?? [])
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startDeleteTransition(async () => {
      const result = await excluirDocumento(id)
      if (result.error) {
        toast.error(result.error)
        setDeletingId(null)
        return
      }
      toast.success('Documento excluído.')
      setDeletingId(null)
      recarregar()
    })
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h4 className="text-sm font-semibold text-foreground">Documentos</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Documentos admissionais e do vínculo. Acesso restrito a administradores
          e registrado em log de auditoria (LGPD Art. 6º).
        </p>
      </div>

      {/* Upload */}
      <UploadZone colaboradorId={colaboradorId} onSuccess={recarregar} />

      {/* Lista de documentos */}
      <div className="flex flex-col gap-2">
        {isReloading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Atualizando...
          </div>
        ) : documentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-10 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/8">
              <FolderOpen className="size-6 text-primary/60" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Nenhum documento enviado ainda
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Utilize o formulário acima para enviar o primeiro documento deste colaborador.
            </p>
          </div>
        ) : (
          documentos.map((doc) => (
            <DocumentoRow
              key={doc.id}
              documento={doc}
              onDelete={handleDelete}
              isDeleting={isDeleting && deletingId === doc.id}
            />
          ))
        )}
      </div>
    </section>
  )
}
