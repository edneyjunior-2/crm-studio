'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Shield, Download, FileText, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { salvarEncarregado } from '@/app/(crm)/configuracoes/actions'

interface PrivacidadeDadosProps {
  encarregadoNome: string | null
  encarregadoEmail: string | null
  encarregadoTelefone: string | null
  aceiteTermosVersao: string | null
  aceiteTermosEm: string | null
  role: string
}

type ExportTipo = 'clientes' | 'pipeline' | 'financeiro' | 'tudo'

export function PrivacidadeDados({
  encarregadoNome,
  encarregadoEmail,
  encarregadoTelefone,
  aceiteTermosVersao,
  aceiteTermosEm,
  role,
}: PrivacidadeDadosProps) {
  const [nome, setNome] = useState(encarregadoNome ?? '')
  const [email, setEmail] = useState(encarregadoEmail ?? '')
  const [telefone, setTelefone] = useState(encarregadoTelefone ?? '')
  const [isPending, startTransition] = useTransition()
  const [exportLoading, setExportLoading] = useState<ExportTipo | null>(null)

  const podeVerFinanceiro = role === 'admin' || role === 'socio'

  function handleSalvarEncarregado(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const result = await salvarEncarregado({
        encarregado_nome: nome || null,
        encarregado_email: email || null,
        encarregado_telefone: telefone || null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Dados do Encarregado salvos com sucesso.')
    })
  }

  async function handleExport(tipo: ExportTipo) {
    setExportLoading(tipo)
    try {
      const res = await fetch(`/api/export/${tipo}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Erro ao exportar.' }))
        toast.error(body.error ?? 'Erro ao exportar.')
        return
      }

      const contentDisposition = res.headers.get('Content-Disposition') ?? ''
      const match = contentDisposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `${tipo}-export`

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erro inesperado ao gerar o arquivo de exportação.')
    } finally {
      setExportLoading(null)
    }
  }

  const aceiteLabel = aceiteTermosVersao
    ? `Versão ${aceiteTermosVersao}${aceiteTermosEm ? ` · aceita em ${aceiteTermosEm.slice(0, 10)}` : ''}`
    : 'Não registrado'

  return (
    <div className="flex flex-col gap-8">
      {/* Cabeçalho da seção */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="size-4 text-muted-foreground" />
          <h3 className="text-base font-medium text-foreground">Privacidade &amp; Dados (LGPD)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Indique o Encarregado de Dados (DPO) da sua empresa e exporte seus dados a qualquer momento.
        </p>
      </div>

      {/* Card: Encarregado/DPO */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Encarregado pela Proteção de Dados (DPO)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Obrigatório pela LGPD (art. 41). Informe o responsável pelo tratamento de dados da sua empresa.
          </p>
        </div>

        <form onSubmit={handleSalvarEncarregado} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="encarregado_nome">Nome</Label>
              <Input
                id="encarregado_nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do encarregado"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="encarregado_email">E-mail</Label>
              <Input
                id="encarregado_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com.br"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="encarregado_telefone">Telefone</Label>
              <Input
                id="encarregado_telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 9 0000-0000"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? 'Salvando…' : 'Salvar Encarregado'}
            </Button>
          </div>
        </form>
      </div>

      {/* Card: Exportar dados */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Exportar dados da empresa</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Baixe os dados da sua empresa em CSV (Excel-BR) ou JSON. Os arquivos contêm apenas dados da sua conta.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('clientes')}
            disabled={exportLoading !== null}
          >
            {exportLoading === 'clientes' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Clientes (CSV)
          </Button>

          <Button
            variant="outline"
            onClick={() => handleExport('pipeline')}
            disabled={exportLoading !== null}
          >
            {exportLoading === 'pipeline' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Pipeline (CSV)
          </Button>

          {podeVerFinanceiro && (
            <Button
              variant="outline"
              onClick={() => handleExport('financeiro')}
              disabled={exportLoading !== null}
            >
              {exportLoading === 'financeiro' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Financeiro (CSV)
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => handleExport('tudo')}
            disabled={exportLoading !== null}
          >
            {exportLoading === 'tudo' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Exportar tudo (JSON)
          </Button>
        </div>
      </div>

      {/* Card: Documentos legais */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Documentos vigentes</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Termos aceitos: <span className="font-medium text-foreground">{aceiteLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="/termos"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileText className="size-4 text-muted-foreground" />
            Termos de Uso
            <ExternalLink className="size-3 text-muted-foreground" />
          </a>

          <a
            href="/contrato-operador"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileText className="size-4 text-muted-foreground" />
            Contrato de Operador (DPA)
            <ExternalLink className="size-3 text-muted-foreground" />
          </a>

          <a
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileText className="size-4 text-muted-foreground" />
            Política de Privacidade
            <ExternalLink className="size-3 text-muted-foreground" />
          </a>
        </div>
      </div>
    </div>
  )
}
