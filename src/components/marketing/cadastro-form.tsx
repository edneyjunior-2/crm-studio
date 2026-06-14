'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cadastrar } from '@/app/(marketing)/cadastro/actions'

// ---------------------------------------------------------------------------
// Masks
// ---------------------------------------------------------------------------

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

// ---------------------------------------------------------------------------
// CNPJ WS response shape
// ---------------------------------------------------------------------------

interface CnpjWsResponse {
  razao_social?: string
  nome_fantasia?: string
  estabelecimento?: {
    nome_fantasia?: string
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CadastroForm() {
  const [tipoPessoa, setTipoPessoa] = useState<'pj' | 'pf'>('pj')
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cpf, setCpf] = useState('')
  const [isBuscandoCnpj, setIsBuscandoCnpj] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const cnpjDigits = cnpj.replace(/\D/g, '')
  const cnpjCompleto = cnpjDigits.length === 14

  // -------------------------------------------------------------------------
  // CNPJ lookup — same pattern as cliente-form.tsx
  // -------------------------------------------------------------------------

  async function buscarCnpj() {
    if (!cnpjCompleto) {
      toast.error('Digite um CNPJ completo (14 dígitos) antes de buscar.')
      return
    }

    setIsBuscandoCnpj(true)
    try {
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjDigits}`)
      if (!res.ok) {
        toast.error('CNPJ não encontrado ou serviço indisponível. Tente novamente.')
        return
      }
      const data: CnpjWsResponse = await res.json()

      if (data.razao_social) {
        setRazaoSocial(data.razao_social)
      }

      const fantasia =
        data.nome_fantasia ??
        data.estabelecimento?.nome_fantasia ??
        ''
      if (fantasia) {
        setNomeFantasia(fantasia)
      }

      toast.success('Dados preenchidos automaticamente.')
    } catch {
      toast.error('Erro ao consultar o CNPJ. Verifique sua conexão e tente novamente.')
    } finally {
      setIsBuscandoCnpj(false)
    }
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    // inject controlled state
    formData.set('tipo_pessoa', tipoPessoa)
    if (tipoPessoa === 'pj') {
      formData.set('cnpj', cnpj)
      formData.set('razao_social', razaoSocial)
      formData.set('nome_fantasia', nomeFantasia)
    } else {
      formData.set('cpf', cpf)
    }

    startTransition(async () => {
      const result = await cadastrar(formData)
      if (result?.error) {
        setServerError(result.error)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="w-full max-w-sm">
      {/* Branding */}
      <div className="mb-8 text-center">
        <Link href="/" className="font-logo text-2xl font-extrabold tracking-[-0.03em] text-foreground">
          CRM Studio<span className="text-accent">.</span>
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">Crie sua conta gratuitamente</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        {/* Toggle PJ / PF */}
        <div className="mb-6 flex rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setTipoPessoa('pj')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tipoPessoa === 'pj'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pessoa Jurídica
          </button>
          <button
            type="button"
            onClick={() => setTipoPessoa('pf')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tipoPessoa === 'pf'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pessoa Física
          </button>
        </div>

        {/* Server error */}
        {serverError && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* PJ fields */}
          {tipoPessoa === 'pj' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cnpj">
                  CNPJ <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="cnpj"
                    name="cnpj"
                    value={cnpj}
                    onChange={(e) => {
                      const formatted = formatCnpj(e.target.value)
                      setCnpj(formatted)
                      // Reset razão social ao mudar o CNPJ
                      if (formatted !== cnpj) {
                        setRazaoSocial('')
                        setNomeFantasia('')
                      }
                    }}
                    placeholder="00.000.000/0000-00"
                    autoComplete="off"
                    className="flex-1"
                  />
                  {cnpjCompleto && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={buscarCnpj}
                      disabled={isBuscandoCnpj || isPending}
                      className="shrink-0 gap-1.5"
                    >
                      {isBuscandoCnpj
                        ? <Loader2 className="size-3.5 animate-spin" />
                        : <Search className="size-3.5" />
                      }
                      {isBuscandoCnpj ? 'Buscando...' : 'Buscar'}
                    </Button>
                  )}
                </div>
                {!cnpjCompleto && (
                  <p className="text-xs text-muted-foreground">
                    Digite o CNPJ completo para preencher automaticamente.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="razao_social">
                  Razão Social <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="razao_social"
                  name="razao_social"
                  required={tipoPessoa === 'pj'}
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input
                  id="nome_fantasia"
                  name="nome_fantasia"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                  placeholder="Nome comercial (opcional)"
                />
              </div>
            </>
          )}

          {/* PF fields */}
          {tipoPessoa === 'pf' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cpf">
                CPF <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cpf"
                name="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                autoComplete="off"
              />
            </div>
          )}

          {/* Common fields */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome_responsavel">
              {tipoPessoa === 'pj' ? 'Nome do Responsável' : 'Seu nome'}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nome_responsavel"
              name="nome_responsavel"
              required
              placeholder="Nome completo"
              autoComplete="name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">
              E-mail <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="voce@empresa.com.br"
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="senha">
              Senha <span className="text-destructive">*</span>
            </Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>

          {/* Aceite */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="aceite_termo"
              name="aceite_termo"
              type="checkbox"
              required
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
            />
            <label htmlFor="aceite_termo" className="text-xs leading-relaxed text-muted-foreground">
              Li e aceito os{' '}
              <Link
                href="/termos"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Termos de Uso
              </Link>{' '}
              e o{' '}
              <Link
                href="/contrato-operador"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Contrato de Operador (DPA)
              </Link>
            </label>
          </div>

          <Button type="submit" disabled={isPending} className="mt-2 w-full">
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              'Criar conta grátis'
            )}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
