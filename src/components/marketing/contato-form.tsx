'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const ASSUNTOS = ['Agendar demo', 'Falar com vendas', 'Dúvida'] as const
type Assunto = (typeof ASSUNTOS)[number]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ContatoForm() {
  const [assunto, setAssunto] = useState<Assunto>('Agendar demo')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  function validar() {
    const e: Record<string, string> = {}
    if (!nome.trim()) e.nome = 'Informe seu nome.'
    if (!EMAIL_RE.test(email)) e.email = 'Informe um e-mail válido.'
    if (!mensagem.trim()) e.mensagem = 'Conte rapidamente o que você precisa.'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (!validar()) return
    setErroGeral(null)
    setEnviando(true)
    try {
      const res = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, empresa, assunto, mensagem }),
      })
      if (!res.ok) throw new Error('Falha')
      setEnviado(true)
    } catch {
      setErroGeral('Não foi possível enviar. Tente novamente ou escreva para nao-responda@crmstudio.com.br.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex size-11 items-center justify-center rounded-full bg-chart-5/15 text-chart-5">
          <Check className="size-5" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-[-0.01em]">Recebemos seu contato.</h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Obrigado, {nome.split(' ')[0]}. Nosso time responde em até um dia útil no e-mail {email}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      {erroGeral && (
        <div role="alert" className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {erroGeral}
        </div>
      )}
      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-medium">Como podemos ajudar?</legend>
        <div className="flex flex-wrap gap-2">
          {ASSUNTOS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAssunto(a)}
              aria-pressed={assunto === a}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                assunto === a
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" aria-invalid={!!erros.nome} />
          {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" aria-invalid={!!erros.email} />
            {erros.email && <p className="text-xs text-destructive">{erros.email}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="empresa">Empresa</Label>
            <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mensagem">Mensagem</Label>
          <Textarea id="mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Conte o tamanho do time e o que você quer resolver." rows={4} aria-invalid={!!erros.mensagem} />
          {erros.mensagem && <p className="text-xs text-destructive">{erros.mensagem}</p>}
        </div>

        <Button type="submit" disabled={enviando} className="mt-1 w-full sm:w-auto">
          {enviando ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Enviando...
            </>
          ) : (
            'Enviar mensagem'
          )}
        </Button>
      </div>
    </form>
  )
}
