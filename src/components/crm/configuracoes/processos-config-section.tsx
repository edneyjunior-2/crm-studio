'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  salvarAdvogadoPadrao,
  aplicarPadraoProcessosSemResponsavel,
} from '@/app/(crm)/configuracoes/processos-config-actions'

interface Advogado {
  id: string
  full_name: string
}

interface Props {
  advogados: Advogado[]
  advogadoPadraoId: string | null
}

// ponytail: sentinel string em vez de um tipo Option<string> — mesmo padrão já
// usado em card-detail-dialog.tsx / comissao-form.tsx pra representar "nenhum"
// dentro de um Select do Base UI (que só aceita valores string, nunca null).
const NENHUM = '__nenhum__'

export function ProcessosConfigSection({ advogados, advogadoPadraoId }: Props) {
  const [selecionado, setSelecionado] = useState<string>(advogadoPadraoId ?? NENHUM)
  // Valor efetivamente salvo no servidor (não o que está escolhido no dropdown
  // e ainda não confirmado) — é o que controla se "Aplicar padrão" pode rodar.
  const [padraoSalvo, setPadraoSalvo] = useState<string | null>(advogadoPadraoId)
  const [isSaving, startSaving] = useTransition()
  const [isApplying, startApplying] = useTransition()

  // label manual no trigger — convenção do projeto: nunca confiar em
  // SelectValue pra exibir um UUID.
  const labelSelecionado =
    selecionado === NENHUM
      ? 'Nenhum'
      : (advogados.find((a) => a.id === selecionado)?.full_name ?? 'Advogado selecionado')

  function handleSalvar() {
    const valor = selecionado === NENHUM ? null : selecionado
    startSaving(async () => {
      const result = await salvarAdvogadoPadrao(valor)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Advogado padrão salvo.')
        setPadraoSalvo(valor)
      }
    })
  }

  function handleAplicar() {
    startApplying(async () => {
      const result = await aplicarPadraoProcessosSemResponsavel()
      if (result.error) {
        toast.error(result.error)
        return
      }
      const atualizados = result.atualizados ?? 0
      toast.success(
        atualizados === 0
          ? 'Nenhum processo sem responsável encontrado.'
          : `${atualizados} processos atualizados.`
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Defina um advogado responsável padrão: processos novos criados sem um responsável
        escolhido (pelo formulário ou pela importação em massa) passam a ser atribuídos a ele
        automaticamente. Você também pode aplicar esse padrão aos processos que já existem e
        ainda não têm responsável, com o botão abaixo.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="advogado-padrao-select">Advogado responsável padrão</Label>
          <Select
            value={selecionado}
            onValueChange={(valor) => {
              if (valor) setSelecionado(valor)
            }}
            disabled={isSaving}
          >
            <SelectTrigger id="advogado-padrao-select" className="w-full sm:w-72">
              <span className="line-clamp-1 flex-1 text-left">{labelSelecionado}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NENHUM}>Nenhum</SelectItem>
              {advogados.map((advogado) => (
                <SelectItem key={advogado.id} value={advogado.id}>
                  {advogado.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" onClick={handleSalvar} disabled={isSaving} className="shrink-0">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSaving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAplicar}
          disabled={isApplying || !padraoSalvo}
        >
          {isApplying ? <Loader2 className="size-4 animate-spin" /> : null}
          {isApplying ? 'Aplicando…' : 'Aplicar padrão aos processos sem responsável'}
        </Button>
      </div>
    </div>
  )
}
