'use client'

import { useState, useTransition } from 'react'
import { Users, Link2, Copy, Check, X } from 'lucide-react'
import { gerarLinkAcesso } from '../actions'

interface Usuario {
  id:         string
  full_name:  string
  role:       string
  email:      string
  created_at: string
}

const ROLE_LABEL: Record<string, string> = {
  admin:     'Admin',
  socio:     'Sócio',
  comercial: 'Comercial',
}

export function UsuariosSection({ usuarios }: { usuarios: Usuario[] }) {
  const [link,    setLink]    = useState<string | null>(null)
  const [emailDo, setEmailDo] = useState<string>('')
  const [erro,    setErro]    = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [isPending, start]    = useTransition()

  function handleGerar(userId: string) {
    setErro(null)
    setLink(null)
    start(async () => {
      const res = await gerarLinkAcesso(userId)
      if ('error' in res) {
        setErro(res.error)
      } else {
        setLink(res.link)
        setEmailDo(res.email)
      }
    })
  }

  function handleCopiar() {
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Usuários</h2>
        <span className="ml-auto text-xs text-muted-foreground">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</span>
      </div>

      {usuarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário vinculado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{u.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {ROLE_LABEL[u.role] ?? u.role}
                </span>
                <button
                  type="button"
                  onClick={() => handleGerar(u.id)}
                  disabled={isPending}
                  title="Gerar link de primeiro acesso"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <Link2 className="size-3.5" />
                  Link de acesso
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <p className="text-xs text-destructive">{erro}</p>
      )}

      {/* Modal de exibição do link */}
      {link && (
        <div className="mt-2 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Link de primeiro acesso</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Envie este link para <strong>{emailDo}</strong> via WhatsApp ou e-mail. Válido por 24h.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLink(null)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            <code className="flex-1 select-all break-all font-mono text-[11px] text-foreground">
              {link}
            </code>
            <button
              type="button"
              onClick={handleCopiar}
              className="shrink-0 rounded p-1.5 hover:bg-accent"
              title="Copiar link"
            >
              {copiado
                ? <Check className="size-4 text-green-600" />
                : <Copy className="size-4 text-muted-foreground" />}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            O cliente clica no link, define uma senha e já entra no CRM Studio.
          </p>
        </div>
      )}
    </div>
  )
}
