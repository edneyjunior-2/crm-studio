'use client'

import { useState, useTransition } from 'react'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'

export function SinapiImportForm() {
  const [uf, setUf] = useState('BA')
  const [mes, setMes] = useState('')
  const [tipo, setTipo] = useState<'insumo' | 'composicao'>('composicao')
  const [fonte, setFonte] = useState('SINAPI')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [pending, start] = useTransition()

  function enviar() {
    if (!arquivo) { toast.error('Selecione a planilha (.xlsx).'); return }
    if (!/^\d{4}-\d{2}$/.test(mes)) { toast.error('Informe o mês de referência.'); return }
    start(async () => {
      const fd = new FormData()
      fd.set('arquivo', arquivo)
      fd.set('uf', uf)
      fd.set('data_ref', mes)
      fd.set('tipo', tipo)
      fd.set('fonte', fonte)
      try {
        const res = await fetch('/api/obras/sinapi/importar', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? 'Falha na importação.'); return }
        toast.success(`${json.gravados.toLocaleString('pt-BR')} ${tipo === 'insumo' ? 'insumos' : 'composições'} importados (${uf} ${mes}).`)
        setArquivo(null)
      } catch {
        toast.error('Erro de rede ao importar.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Fonte</span>
          <select value={fonte} onChange={(e) => setFonte(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="SINAPI">SINAPI</option>
            <option value="ORSE">ORSE</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">UF</span>
          <input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} maxLength={2}
            className="rounded-lg border border-border bg-background px-3 py-2 uppercase" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Mês ref.</span>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as 'insumo' | 'composicao')}
            className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="composicao">Composições</option>
            <option value="insumo">Insumos</option>
          </select>
        </label>
      </div>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center hover:bg-muted/40">
        <UploadCloud className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">{arquivo ? arquivo.name : 'Selecionar planilha SINAPI (.xlsx)'}</span>
        <span className="text-xs text-muted-foreground">Relatórios Mensais da Caixa, por UF. Importe Insumos e Composições separadamente.</span>
        <input type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>

      <button type="button" onClick={enviar} disabled={pending}
        className="self-start rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-60">
        {pending ? 'Importando…' : 'Importar catálogo'}
      </button>
    </div>
  )
}
