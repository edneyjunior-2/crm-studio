'use client'

import { useState, useRef, useTransition } from 'react'
import { FileText, Upload, Trash2, File, Loader2 } from 'lucide-react'
import { uploadDocumento, excluirDocumento, type DocItem } from './doc-actions'

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function formatData(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso))
}

interface Props {
  processoId: string
  documentos: DocItem[]
}

export function DocumentosSection({ processoId, documentos: inicial }: Props) {
  const [docs, setDocs]             = useState(inicial)
  const [erro, setErro]             = useState<string | null>(null)
  const [uploading, startUpload]    = useTransition()
  const [deleting, startDelete]     = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('processoId', processoId)
    startUpload(async () => {
      const res = await uploadDocumento(fd)
      if (res.error) { setErro(res.error); return }
      if (res.documento) setDocs((d) => [res.documento!, ...d])
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleDelete(docId: string, storagePath: string) {
    if (!confirm('Excluir este documento? Esta ação não pode ser desfeita.')) return
    setErro(null)
    startDelete(async () => {
      const res = await excluirDocumento(docId, storagePath)
      if (res.error) { setErro(res.error); return }
      setDocs((d) => d.filter((x) => x.id !== docId))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {docs.length === 0
            ? 'Nenhum documento'
            : `${docs.length} documento${docs.length !== 1 ? 's' : ''}`}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/90">
          {uploading
            ? <Loader2 className="size-3.5 animate-spin" />
            : <Upload className="size-3.5" />}
          {uploading ? 'Enviando…' : 'Adicionar documento'}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {erro && <p className="rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">{erro}</p>}

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <File className="size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum documento anexado</p>
          <p className="text-xs text-muted-foreground">PDF, Word, Excel e imagens até 10 MB</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(doc.tamanho)} · {formatData(doc.created_at)}
                  {doc.autor_nome ? ` · ${doc.autor_nome}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id, doc.storage_path)}
                disabled={deleting}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                title="Excluir documento"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
