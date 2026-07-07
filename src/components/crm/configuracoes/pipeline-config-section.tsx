'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { salvarPipelineConfig } from '@/app/(crm)/configuracoes/pipeline-config-actions'
import type { PipelineConfig } from '@/lib/pipeline-config'

interface Props {
  config: PipelineConfig
}

const ITENS: { chave: keyof PipelineConfig; titulo: string; descricao: string }[] = [
  {
    chave: 'exige_cliente',
    titulo: 'Exigir cliente',
    descricao: 'O negócio só pode ser salvo com um cliente selecionado.',
  },
  {
    chave: 'exige_produto',
    titulo: 'Exigir produto/solução',
    descricao: 'O negócio precisa ter ao menos um produto vinculado.',
  },
  {
    chave: 'exige_responsavel',
    titulo: 'Exigir responsável específico',
    descricao: 'Torna a escolha do responsável obrigatória. Desligado, o criador do negócio vira o responsável automaticamente.',
  },
]

export function PipelineConfigSection({ config: initial }: Props) {
  const [config, setConfig] = useState<PipelineConfig>(initial)
  const [isPending, startTransition] = useTransition()

  function handleToggle(chave: keyof PipelineConfig, valor: boolean) {
    const anterior = config
    const proximo = { ...config, [chave]: valor }
    setConfig(proximo)
    startTransition(async () => {
      const result = await salvarPipelineConfig(proximo)
      if (result.error) {
        toast.error(result.error)
        setConfig(anterior)
      } else {
        toast.success('Configuração salva.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Controla o que é obrigatório ao criar um negócio no pipeline. Desligue os campos que não fizerem
        sentido para habilitar um <strong className="text-foreground">modo lead rápido</strong> — por
        exemplo, um lead que chegou pelo WhatsApp e ainda não tem cliente ou produto definido.
      </p>
      <div className="flex flex-col gap-2">
        {ITENS.map((item) => (
          <div
            key={item.chave}
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3"
          >
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`pipeline-cfg-${item.chave}`} className="cursor-pointer">
                {item.titulo}
              </Label>
              <span className="text-xs text-muted-foreground">{item.descricao}</span>
            </div>
            <Switch
              id={`pipeline-cfg-${item.chave}`}
              checked={config[item.chave]}
              disabled={isPending}
              onCheckedChange={(valor) => handleToggle(item.chave, valor)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
