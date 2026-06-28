'use client'

import { useState, useTransition } from 'react'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'

export function SinapiImportForm() {
  const [uf, setUf] = useState('BA')
  const [mes, setMes] = useState('')
  const [fonte, setFonte] = useState('SINAPI')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [pending, start] = useTransition()

  function enviar() {
    if (!arquivo) { toast.error('Selecione o arquivo SINAPI_Referência (.xlsx).'); return }
    if (!/^\d{4}-\d{2}$/.test(mes)) { toast.error('Informe o mês de referência.'); return }
    start(async () => {
      const fd = new FormData()
      fd.set('arquivo', arquivo)
      fd.set('uf', uf)
      fd.set('data_ref', mes)
      fd.set('fonte', fonte)
      try {
        const res = await fetch('/api/obras/sinapi/importar', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? 'Falha na importação.'); return }
        toast.success(`Importado (${uf} ${mes}): ${json.insumos.toLocaleString('pt-BR')} insumos + ${json.composicoes.toLocaleString('pt-BR')} composições.`)
        setArquivo(null)
      } catch {
        toast.error('Erro de rede ao importar.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-3">
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
      </div>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center hover:bg-muted/40">
        <UploadCloud className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">{arquivo ? arquivo.name : 'Selecionar SINAPI_Referência_AAAA_MM.xlsx'}</span>
        <span className="text-xs text-muted-foreground">Arquivo único de Relatórios Mensais da Caixa. Importa insumos + composições (com/sem desoneração) da UF de uma vez.</span>
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
