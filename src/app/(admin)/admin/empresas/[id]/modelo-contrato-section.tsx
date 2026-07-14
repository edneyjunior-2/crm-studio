'use client'

import { useRef, useState, useTransition } from 'react'
import { FileText, Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { salvarModeloContrato, liberarModeloContrato, salvarNivelAssinatura, salvarSignatarioEmpresa } from '../actions'

// 'sms' existe no banco/lib mas NÃO é oferecido: o gerador de contratos não
// coleta telefone de signatário em lugar nenhum, então escolher SMS faria todo
// envio falhar. Só reintroduzir junto com um campo de telefone no formulário.
const NIVEL_LABEL: Record<string, string> = {
  simples: 'Simples (nome na tela)',
  email: 'Confirmação por e-mail',
  sms: 'Confirmação por SMS',
  qualificada: 'Qualificada (ICP-Brasil)',
}

interface Props {
  empresaId: string
  /** Path no bucket, ou null se nenhum modelo foi enviado ainda. */
  templatePath: string | null
  /** true = liberado para o cliente, false/null = em revisão. */
  aprovado: boolean
  /**
   * 'simples' | 'email' | 'sms' | 'qualificada' — modalidade de assinatura
   * eletrônica (ZapSign) desta empresa. Só modalidades gratuitas + qualificada
   * (paga, deliberada) são oferecidas — nunca WhatsApp/biometria (consomem
   * crédito). Opcional: enquanto a página não repassar `empresas.config
   * .contrato_nivel_assinatura`, cai no default 'simples' (mesmo default
   * usado no backend quando a chave está ausente do jsonb).
   */
  nivelAssinatura?: string | null
  /** Quem assina os contratos em nome DESTA empresa (o CONTRATADO). */
  signatarioNome?: string | null
  signatarioEmail?: string | null
}

export function ModeloContratoSection({
  empresaId,
  templatePath,
  aprovado,
  nivelAssinatura,
  signatarioNome,
  signatarioEmail,
}: Props) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [erro, setErro]     = useState<string | null>(null)
  const [ok,   setOk]       = useState<string | null>(null)
  const [uploading, startUpload]   = useTransition()
  const [toggling,  startToggle]   = useTransition()
  const [nivel, setNivel]          = useState(nivelAssinatura ?? 'simples')
  const [savingNivel, startNivel]  = useTransition()
  const [sigNome,  setSigNome]     = useState(signatarioNome ?? '')
  const [sigEmail, setSigEmail]    = useState(signatarioEmail ?? '')
  const [savingSig, startSig]      = useTransition()

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null); setOk(null)
    const fd = new FormData(e.currentTarget)
    startUpload(async () => {
      const res = await salvarModeloContrato(empresaId, fd)
      if (res.error) { setErro(res.error); return }
      setOk('Modelo enviado com sucesso!')
      if (fileRef.current) fileRef.current.value = ''
      setTimeout(() => setOk(null), 3000)
    })
  }

  function handleToggle() {
    setErro(null); setOk(null)
    startToggle(async () => {
      const res = await liberarModeloContrato(empresaId, !aprovado)
      if (res.error) { setErro(res.error); return }
      setOk(!aprovado ? 'Modelo liberado para o cliente!' : 'Modelo marcado como em revisão.')
      setTimeout(() => setOk(null), 3000)
    })
  }

  function handleNivelChange(v: string | null) {
    if (!v || v === nivel) return
    const anterior = nivel
    setErro(null); setOk(null)
    setNivel(v)
    startNivel(async () => {
      const res = await salvarNivelAssinatura(empresaId, v as 'simples' | 'email' | 'sms' | 'qualificada')
      if (res.error) { setErro(res.error); setNivel(anterior); return }
      setOk('Nível de assinatura atualizado!')
      setTimeout(() => setOk(null), 3000)
    })
  }

  function handleSignatarioSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null); setOk(null)
    startSig(async () => {
      const res = await salvarSignatarioEmpresa(empresaId, { nome: sigNome, email: sigEmail })
      if (res.error) { setErro(res.error); return }
      setOk('Signatário da empresa salvo!')
      setTimeout(() => setOk(null), 3000)
    })
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">Modelo de contrato</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Suba o arquivo <code className="font-mono">.html</code> do contrato white-label desta empresa.
            Após conferir, libere para o cliente visualizar no CRM.
          </p>
        </div>
      </div>

      {/* Estado atual */}
      <div className="flex flex-wrap items-center gap-3">
        {templatePath ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Modelo enviado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <XCircle className="size-3.5" /> Nenhum modelo
          </span>
        )}

        {templatePath && (
          aprovado ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-3.5" /> Liberado para o cliente
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              Em revisão
            </span>
          )
        )}
      </div>

      {/* Upload */}
      <form onSubmit={handleUpload} className="flex flex-col gap-3">
        <label className="text-xs font-medium text-muted-foreground">
          Arquivo .html (máx. 2 MB)
        </label>
        <input
          ref={fileRef}
          name="modelo"
          type="file"
          accept=".html,text/html"
          required
          className="text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15"
        />
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? 'Enviando…' : templatePath ? 'Substituir modelo' : 'Enviar modelo'}
        </button>
      </form>

      {/* Toggle liberar */}
      {templatePath && (
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
              aprovado
                ? 'border border-border bg-background text-muted-foreground hover:text-foreground'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {toggling && <Loader2 className="size-4 animate-spin" />}
            {aprovado ? 'Revogar liberação' : 'Liberar para o cliente'}
          </button>
          <span className="text-xs text-muted-foreground">
            {aprovado
              ? 'O cliente está vendo o gerador. Clique para colocar em revisão.'
              : 'O cliente vê "em revisão" até você liberar.'}
          </span>
        </div>
      )}

      {/* Modalidade de assinatura eletrônica (ZapSign) */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Modalidade de assinatura eletrônica
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Simples/e-mail/SMS não têm custo adicional. Qualificada (ICP-Brasil) tem mais força
            probatória, mas consome crédito ZapSign por assinatura.
          </p>
        </div>
        <Select value={nivel} onValueChange={handleNivelChange}>
          <SelectTrigger className="w-64">
            <span className="flex flex-1 items-center gap-1.5">
              {savingNivel && <Loader2 className="size-3.5 animate-spin" />}
              {NIVEL_LABEL[nivel] ?? nivel}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="simples">Simples (nome na tela)</SelectItem>
            <SelectItem value="email">Confirmação por e-mail</SelectItem>
            <SelectItem value="qualificada">Qualificada (ICP-Brasil) — paga</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Signatário da própria empresa (o CONTRATADO) */}
      <form onSubmit={handleSignatarioSubmit} className="flex flex-col gap-3 border-t border-border pt-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Quem assina pela empresa
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            O contrato tem assinatura dos dois lados. Esta pessoa é incluída como signatária em
            todo contrato enviado e recebe o próprio link por e-mail. Deixe em branco se só a
            contraparte assina.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={sigNome}
            onChange={(e) => setSigNome(e.target.value)}
            placeholder="Nome completo"
            className="w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={sigEmail}
            onChange={(e) => setSigEmail(e.target.value)}
            placeholder="email@empresa.com.br"
            className="w-64 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={savingSig}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-60"
          >
            {savingSig && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </form>

      {/* Feedback */}
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      {ok  && <p className="text-xs text-emerald-600">{ok}</p>}
    </div>
  )
}
