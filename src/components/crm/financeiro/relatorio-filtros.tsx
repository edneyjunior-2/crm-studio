'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RelatorioFiltrosProps {
  tipo: string
  status: string
  dataInicio: string
  dataFim: string
}

export function RelatorioFiltros({ tipo, status, dataInicio, dataFim }: RelatorioFiltrosProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localTipo, setLocalTipo] = useState(tipo)
  const [localStatus, setLocalStatus] = useState(status)
  const [localInicio, setLocalInicio] = useState(dataInicio)
  const [localFim, setLocalFim] = useState(dataFim)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (localTipo) params.set('tipo', localTipo)
    if (localStatus) params.set('status', localStatus)
    if (localInicio) params.set('data_inicio', localInicio)
    if (localFim) params.set('data_fim', localFim)

    startTransition(() => {
      router.push(`/financeiro/relatorio?${params.toString()}`)
    })
  }

  function handleLimpar() {
    setLocalTipo('ambos')
    setLocalStatus('todos')
    setLocalInicio('')
    setLocalFim('')
    startTransition(() => {
      router.push('/financeiro/relatorio')
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>Tipo</Label>
          <Select value={localTipo} onValueChange={(v) => { if (v) setLocalTipo(v) }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ambos">Ambos</SelectItem>
              <SelectItem value="receber">Contas a Receber</SelectItem>
              <SelectItem value="pagar">Contas a Pagar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={localStatus} onValueChange={(v) => { if (v) setLocalStatus(v) }}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago / Recebido</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_inicio">Data Início</Label>
          <Input
            id="data_inicio"
            type="date"
            value={localInicio}
            onChange={(e) => setLocalInicio(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="data_fim">Data Fim</Label>
          <Input
            id="data_fim"
            type="date"
            value={localFim}
            onChange={(e) => setLocalFim(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Gerando...' : 'Gerar Relatório'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={handleLimpar}
        >
          Limpar filtros
        </Button>
      </div>
    </form>
  )
}
