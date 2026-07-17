'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, AlertTriangle, Upload } from 'lucide-react'
import { criarMotorista } from '../actions'
import { preVisualizarCnh, processarUploadCnh } from '../[id]/cnh-actions'

const CATEGORIAS = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']

const VINCULOS = [
  { value: 'autonomo', label: 'Autônomo' },
  { value: 'clt',      label: 'CLT' },
]

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const labelClass = 'text-sm font-medium text-foreground'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50'
const btnSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted'

export function NovoMotoristaForm() {
  const [state, action, isPending] = useActionState(criarMotorista, null)
  const router = useRouter()

  const nomeRef = useRef<HTMLInputElement>(null)
  const cpfRef = useRef<HTMLInputElement>(null)
  const cnhNumeroRef = useRef<HTMLInputElement>(null)
  const cnhCategoriaRef = useRef<HTMLSelectElement>(null)
  const cnhValidadeRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Guarda o arquivo selecionado — o motorista ainda não existe no banco
  // quando a foto é lida (a leitura roda via preVisualizarCnh, sem persistir
  // nada), então o upload de verdade (com storage + registro do documento)
  // só acontece DEPOIS que criarMotorista devolver o id, no useEffect abaixo.
  const [arquivoCnh, setArquivoCnh] = useState<File | null>(null)
  const [lendo, startLeitura] = useTransition()
  const [avisoLeitura, setAvisoLeitura] = useState<string | null>(null)
  const [salvandoDocumento, setSalvandoDocumento] = useState(false)

  function handleArquivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAvisoLeitura(null)
    setArquivoCnh(file)

    const fd = new FormData()
    fd.append('file', file)

    startLeitura(async () => {
      const res = await preVisualizarCnh(fd)

      if (!res.sucesso || !res.dados) {
        setAvisoLeitura(res.erro ?? 'Não foi possível ler a CNH automaticamente. Preencha os dados manualmente.')
        return
      }

      const d = res.dados
      if (d.nome && nomeRef.current) nomeRef.current.value = d.nome
      if (d.cpf && cpfRef.current) cpfRef.current.value = d.cpf
      if (d.cnhNumero && cnhNumeroRef.current) cnhNumeroRef.current.value = d.cnhNumero
      if (d.cnhCategoria && cnhCategoriaRef.current) cnhCategoriaRef.current.value = d.cnhCategoria
      if (d.cnhValidade && cnhValidadeRef.current) cnhValidadeRef.current.value = d.cnhValidade

      setAvisoLeitura(
        d.confianca === 'baixa'
          ? 'Não conseguimos identificar boa parte dos campos automaticamente — complete manualmente antes de salvar.'
          : 'CNH lida. Confira os campos abaixo antes de salvar — a leitura automática pode conter erros.'
      )
    })
  }

  // Depois que o motorista é criado, se uma foto de CNH foi selecionada,
  // salva o documento de verdade (storage + frete_motoristas_documentos)
  // vinculado ao id recém-criado — só então redireciona.
  useEffect(() => {
    if (!state?.id) return

    if (!arquivoCnh) {
      router.push(`/frete/motoristas/${state.id}`)
      return
    }

    setSalvandoDocumento(true)
    const fd = new FormData()
    fd.append('file', arquivoCnh)
    processarUploadCnh(state.id, fd).finally(() => {
      router.push(`/frete/motoristas/${state.id}`)
    })
  }, [state?.id, arquivoCnh, router])

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Leitura automática de CNH — pré-preenche os campos abaixo antes de
          salvar. O arquivo em si só é persistido depois que o motorista for
          criado (ver useEffect). */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Leitura automática de CNH</p>
          <p className="text-xs text-muted-foreground">Envie uma foto da CNH para pré-preencher os campos abaixo.</p>
        </div>
        <label
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 ${
            lendo ? 'pointer-events-none opacity-60' : 'cursor-pointer'
          }`}
        >
          {lendo ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {lendo ? 'Lendo…' : 'Ler CNH'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleArquivoChange}
            disabled={lendo}
            className="hidden"
          />
        </label>
      </div>

      {avisoLeitura && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{avisoLeitura}</span>
        </div>
      )}

      {/* Nome */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="nome">Nome *</label>
        <input id="nome" name="nome" ref={nomeRef} required placeholder="Nome completo" className={inputClass} />
      </div>

      {/* CPF */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="cpf">CPF</label>
        <input id="cpf" name="cpf" ref={cpfRef} placeholder="000.000.000-00" className={inputClass} maxLength={14} />
      </div>

      {/* CNH número + categoria */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cnh_numero">Número da CNH</label>
          <input id="cnh_numero" name="cnh_numero" ref={cnhNumeroRef} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cnh_categoria">Categoria</label>
          <select id="cnh_categoria" name="cnh_categoria" ref={cnhCategoriaRef} className={inputClass} defaultValue="">
            <option value="">Selecione…</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Validade CNH + Vínculo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="cnh_validade">Validade da CNH</label>
          <input id="cnh_validade" name="cnh_validade" ref={cnhValidadeRef} type="date" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="vinculo">Vínculo *</label>
          <select id="vinculo" name="vinculo" required className={inputClass} defaultValue="autonomo">
            {VINCULOS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* RNTRC */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="rntrc">RNTRC</label>
        <input id="rntrc" name="rntrc" placeholder="Opcional (autônomo)" className={inputClass} />
      </div>

      {/* Observações */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          placeholder="Detalhes adicionais sobre o motorista…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={isPending || salvandoDocumento} className={btnPrimary}>
          {(isPending || salvandoDocumento) && <Loader2 className="size-4 animate-spin" />}
          {salvandoDocumento ? 'Salvando CNH…' : 'Salvar motorista'}
        </button>
        <Link href="/frete/motoristas" className={btnSecondary}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
