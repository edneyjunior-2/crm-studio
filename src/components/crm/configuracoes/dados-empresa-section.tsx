'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { salvarDadosEmpresa } from '@/app/(crm)/configuracoes/actions'
import { formatCNPJ } from '@/lib/masks'

interface DadosEmpresaSectionProps {
  nomeFantasia: string | null
  razaoSocial: string | null
  cnpj: string | null
}

export function DadosEmpresaSection({
  nomeFantasia,
  razaoSocial,
  cnpj,
}: DadosEmpresaSectionProps) {
  const [nomeFant, setNomeFant] = useState(nomeFantasia ?? '')
  const [razao, setRazao] = useState(razaoSocial ?? '')
  const [cnpjVal, setCnpjVal] = useState(cnpj ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const result = await salvarDadosEmpresa({
        nome_fantasia: nomeFant || null,
        razao_social:  razao    || null,
        cnpj:          cnpjVal  || null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Dados da empresa salvos com sucesso.')
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-4 text-muted-foreground" />
          <h3 className="text-base font-medium text-foreground">Dados da empresa</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Estas informações aparecem nos documentos gerados (orçamentos, contratos etc.).
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
              <Input
                id="nome_fantasia"
                value={nomeFant}
                onChange={(e) => setNomeFant(e.target.value)}
                placeholder="Como sua empresa é conhecida"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="razao_social">Razão Social <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="razao_social"
                value={razao}
                onChange={(e) => setRazao(e.target.value)}
                placeholder="Razão Social Ltda."
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cnpj">CNPJ <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="cnpj"
                value={cnpjVal}
                onChange={(e) => setCnpjVal(formatCNPJ(e.target.value))}
                placeholder="00.000.000/0001-00"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? 'Salvando…' : 'Salvar dados'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
