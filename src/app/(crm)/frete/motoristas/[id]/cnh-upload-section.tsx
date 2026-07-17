'use client'

/**
 * cnh-upload-section.tsx — Leitura automática de CNH (upload + OCR + confirmação)
 *
 * Spec: .claude/specs/frete-03-ocr-cnh.md
 *
 * Componente standalone: não é importado por nenhum outro arquivo desta spec
 * (wiring em motoristas/[id]/page.tsx fica pro Opus, depois que os streams
 * de UI e de OCR convergirem).
 *
 * OCR não garante autenticidade — o usuário sempre confere/edita os campos
 * antes de salvar (aviso explícito abaixo). Sem bloquear o fluxo quando a
 * leitura falha ou tem baixa confiança: os campos ficam vazios pra
 * preenchimento manual.
 */

import { useRef, useState, useTransition } from 'react'
import { AlertTriangle, Check, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { processarUploadCnh, aplicarDadosCnhAoMotorista } from './cnh-actions'
import type { CnhDadosExtraidos } from '@/lib/frete/cnh-ocr-parser'

interface Props {
  motoristaId: string
}

interface FormularioCnh {
  nome: string
  cpf: string
  cnhNumero: string
  cnhCategoria: string
  cnhValidade: string
}

const FORM_VAZIO: FormularioCnh = { nome: '', cpf: '', cnhNumero: '', cnhCategoria: '', cnhValidade: '' }

function paraFormulario(dados?: Partial<CnhDadosExtraidos>): FormularioCnh {
  return {
    nome: dados?.nome ?? '',
    cpf: dados?.cpf ?? '',
    cnhNumero: dados?.cnhNumero ?? '',
    cnhCategoria: dados?.cnhCategoria ?? '',
    cnhValidade: dados?.cnhValidade ?? '',
  }
}

const inputCls =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40'

export function CnhUploadSection({ motoristaId }: Props) {
  const [lendo, startLeitura] = useTransition()
  const [salvando, startSalvar] = useTransition()
  const [form, setForm] = useState<FormularioCnh | null>(null)
  const [confiancaBaixa, setConfiancaBaixa] = useState(false)
  const [avisoLeitura, setAvisoLeitura] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setForm(null)
    setAvisoLeitura(null)
    setConfiancaBaixa(false)

    const fd = new FormData()
    fd.append('file', file)

    const toastId = toast.loading('Lendo CNH…')
    startLeitura(async () => {
      const res = await processarUploadCnh(motoristaId, fd)

      if (!res.sucesso) {
        // Erro de leitura (ex.: GOOGLE_VISION_API_KEY ausente, upload rejeitado) —
        // não bloqueia o cadastro: abre o formulário vazio pra preenchimento manual.
        toast.error(res.erro ?? 'Não foi possível ler a CNH.', { id: toastId })
        setAvisoLeitura(res.erro ?? 'Não foi possível ler a CNH automaticamente. Preencha os dados manualmente.')
        setForm(FORM_VAZIO)
        setConfiancaBaixa(true)
        return
      }

      toast.success('CNH lida. Confira os dados antes de salvar.', { id: toastId })
      setForm(paraFormulario(res.dados))
      setConfiancaBaixa(res.dados?.confianca === 'baixa')
    })

    if (fileRef.current) fileRef.current.value = ''
  }

  function handleSalvar() {
    if (!form) return
    const toastId = toast.loading('Salvando dados no cadastro…')
    startSalvar(async () => {
      const res = await aplicarDadosCnhAoMotorista(motoristaId, {
        nome: form.nome || undefined,
        cpf: form.cpf || undefined,
        cnhNumero: form.cnhNumero || undefined,
        cnhCategoria: form.cnhCategoria || undefined,
        cnhValidade: form.cnhValidade || undefined,
      })

      if (!res.sucesso) {
        toast.error(res.erro ?? 'Erro ao salvar os dados.', { id: toastId })
        return
      }

      toast.success('Dados aplicados ao cadastro do motorista.', { id: toastId })
      setForm(null)
      setAvisoLeitura(null)
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Leitura automática de CNH</p>
          <p className="text-xs text-muted-foreground">
            Envie uma foto ou PDF da CNH para pré-preencher os campos do motorista.
          </p>
        </div>
        <label
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 ${
            lendo ? 'pointer-events-none opacity-60' : 'cursor-pointer'
          }`}
        >
          {lendo ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {lendo ? 'Lendo…' : 'Ler CNH'}
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileChange}
            disabled={lendo}
            className="hidden"
          />
        </label>
      </div>

      {avisoLeitura && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{avisoLeitura}</span>
        </div>
      )}

      {form && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {confiancaBaixa
                ? 'Não conseguimos identificar boa parte dos campos automaticamente — complete manualmente antes de salvar.'
                : 'Confira os dados antes de salvar — a leitura automática pode conter erros.'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
              <input
                className={inputCls}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">CPF</label>
              <input
                className={inputCls}
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nº Registro CNH</label>
              <input
                className={inputCls}
                value={form.cnhNumero}
                onChange={(e) => setForm({ ...form, cnhNumero: e.target.value })}
                placeholder="00000000000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Categoria</label>
              <input
                className={inputCls}
                value={form.cnhCategoria}
                onChange={(e) => setForm({ ...form, cnhCategoria: e.target.value.toUpperCase() })}
                placeholder="AB"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Validade</label>
              <input
                type="date"
                className={inputCls}
                value={form.cnhValidade}
                onChange={(e) => setForm({ ...form, cnhValidade: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setForm(null)
                setAvisoLeitura(null)
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {salvando ? 'Salvando…' : 'Salvar no cadastro'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
