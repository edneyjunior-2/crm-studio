'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Bot, Trash2, Plus, Copy, Check, X, Link as LinkIcon } from 'lucide-react'
import { gerarApiKey, revogarApiKey } from '../actions'

interface ApiKey {
  id: string
  label: string | null
  created_at: string
}

// Endereço fixo da rota de ingestão (a "porta" do CRM onde o robô entrega os leads).
const INGEST_URL = 'https://app.crmstudio.com.br/api/leads/ingest'

// Campo com valor + botão copiar (componente no nível do módulo, não no render).
function CampoCopiavel({
  label, valor, id, mono, copiadoId, onCopiar,
}: {
  label: string
  valor: string
  id: string
  mono?: boolean
  copiadoId: string | null
  onCopiar: (texto: string, id: string) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        <code className={`flex-1 select-all break-all text-xs ${mono ? 'font-mono' : ''}`}>{valor}</code>
        <button
          type="button"
          onClick={() => onCopiar(valor, id)}
          className="shrink-0 rounded p-1.5 hover:bg-muted"
          title="Copiar"
        >
          {copiadoId === id ? <Check className="size-4 text-green-600" /> : <Copy className="size-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  )
}

export function ApiKeysSection({
  empresaId,
  apiKeys,
}: {
  empresaId: string
  apiKeys: ApiKey[]
}) {
  const [novoLabel, setNovoLabel] = useState('')
  const [tokenGerado, setTokenGerado] = useState<string | null>(null)
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (tokenGerado) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [tokenGerado])

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId((cur) => (cur === id ? null : cur)), 2000)
  }

  function handleGerar() {
    if (!novoLabel.trim()) {
      setErro('Informe um nome para a chave (ex.: "SDR Leila")')
      return
    }
    setErro(null)
    startTransition(async () => {
      const result = await gerarApiKey(empresaId, novoLabel.trim())
      if ('error' in result) setErro(result.error)
      else {
        setTokenGerado(result.token)
        setNovoLabel('')
      }
    })
  }

  function handleFechar() {
    setTokenGerado(null)
    setCopiadoId(null)
  }

  function handleRevogar(keyId: string) {
    if (!confirm('Revogar esta chave? A integração que usa ela vai parar de funcionar.')) return
    startTransition(() => revogarApiKey(keyId, empresaId))
  }

  return (
    <>
      {/* Modal: chave gerada + endereço + passo a passo */}
      <dialog
        ref={dialogRef}
        onClose={handleFechar}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Chave do SDR gerada ✅</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Copie a chave agora — ela <strong>não será exibida de novo</strong>.
              </p>
            </div>
            <button onClick={handleFechar} className="rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>

          {tokenGerado && <CampoCopiavel label="Chave (API key)" valor={tokenGerado} id="modal-key" mono copiadoId={copiadoId} onCopiar={copiar} />}
          <CampoCopiavel label="Endereço do CRM (URL)" valor={INGEST_URL} id="modal-url" mono copiadoId={copiadoId} onCopiar={copiar} />

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Como ligar o robô:</p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>Copie a <strong>chave</strong> e o <strong>endereço</strong> acima.</li>
              <li>Cole nas configurações do robô SDR (a chave e a URL de destino).</li>
              <li>Pronto — os leads qualificados passam a cair no pipeline deste cliente.</li>
            </ol>
          </div>

          <button
            onClick={handleFechar}
            className="self-end rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Já copiei, fechar
          </button>
        </div>
      </dialog>

      {/* Seção Integração SDR */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Integração SDR</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Conecte o robô de atendimento (SDR) ao CRM deste cliente. Gere a chave, copie a chave + o endereço e cole nas configurações do robô.
          </p>
        </div>

        {/* Endereço do CRM (sempre disponível) */}
        <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
          <LinkIcon className="mt-2 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <CampoCopiavel label="Endereço do CRM (cole no robô)" valor={INGEST_URL} id="url" mono copiadoId={copiadoId} onCopiar={copiar} />
          </div>
        </div>

        {/* Chaves existentes */}
        {apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma chave gerada ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{k.label ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Criada em {new Date(k.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <button
                  onClick={() => handleRevogar(k.id)}
                  disabled={isPending}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Revogar chave"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Gerar nova chave */}
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">A chave só é exibida uma vez, logo após gerar.</p>
          <div className="flex gap-2">
            <input
              value={novoLabel}
              onChange={(e) => setNovoLabel(e.target.value)}
              placeholder='Nome da chave (ex.: "SDR Leila")'
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
            />
            <button
              onClick={handleGerar}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              <Plus className="size-4" />
              Gerar chave
            </button>
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>
      </div>
    </>
  )
}
