'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Key, Trash2, Plus, Copy, Check, X } from 'lucide-react'
import { gerarApiKey, revogarApiKey } from '../actions'

interface ApiKey {
  id: string
  label: string | null
  created_at: string
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
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (tokenGerado) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [tokenGerado])

  function handleGerar() {
    if (!novoLabel.trim()) {
      setErro('Informe um label para a key (ex.: "SDR Leila")')
      return
    }
    setErro(null)
    startTransition(async () => {
      const result = await gerarApiKey(empresaId, novoLabel.trim())
      if ('error' in result) {
        setErro(result.error)
      } else {
        setTokenGerado(result.token)
        setNovoLabel('')
      }
    })
  }

  function handleCopiar() {
    if (!tokenGerado) return
    navigator.clipboard.writeText(tokenGerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleFechar() {
    setTokenGerado(null)
    setCopiado(false)
  }

  function handleRevogar(keyId: string) {
    if (!confirm('Revogar esta API key? A integração que usa ela vai parar de funcionar.')) return
    startTransition(() => revogarApiKey(keyId, empresaId))
  }

  return (
    <>
      {/* Modal de exibição do token */}
      <dialog
        ref={dialogRef}
        onClose={handleFechar}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">API Key gerada</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Copie agora — não será exibida novamente.
              </p>
            </div>
            <button
              onClick={handleFechar}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-3">
            <code className="flex-1 select-all break-all font-mono text-xs">
              {tokenGerado}
            </code>
            <button
              onClick={handleCopiar}
              className="shrink-0 rounded p-1.5 hover:bg-accent/10"
              title="Copiar"
            >
              {copiado
                ? <Check className="size-4 text-green-600" />
                : <Copy className="size-4 text-accent" />}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Cole em <code className="font-mono">CRM_INGEST_API_KEY</code> no ambiente do SDR.
          </p>

          <button
            onClick={handleFechar}
            className="mt-1 self-end rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Já copiei, fechar
          </button>
        </div>
      </dialog>

      {/* Seção de API Keys */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Key className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">API Keys (integração SDR)</h2>
        </div>

        {apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma API key gerada ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {apiKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5"
              >
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
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            O token só é exibido uma vez após geração.
          </p>
          <div className="flex gap-2">
            <input
              value={novoLabel}
              onChange={(e) => setNovoLabel(e.target.value)}
              placeholder='Label (ex.: "SDR Leila")'
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
            />
            <button
              onClick={handleGerar}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              <Plus className="size-4" />
              Gerar
            </button>
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>
      </div>
    </>
  )
}
