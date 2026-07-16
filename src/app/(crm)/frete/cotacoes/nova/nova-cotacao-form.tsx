'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle } from 'lucide-react'
import { criarCotacao } from '../actions'
import municipiosBr from '@/lib/frete/municipios-br.json'

interface Cliente { id: string; razao_social: string }
interface Veiculo { id: string; placa: string }
interface Motorista { id: string; nome: string }

interface Props {
  clientes:   Cliente[]
  veiculos:   Veiculo[]
  motoristas: Motorista[]
}

const TABELAS_ANTT = ['A', 'B', 'C', 'D']

const TIPOS_CARGA = [
  { value: 'geral',            label: 'Carga geral' },
  { value: 'granel_solido',    label: 'Granel sólido' },
  { value: 'granel_liquido',   label: 'Granel líquido' },
  { value: 'frigorificada',    label: 'Frigorificada' },
  { value: 'perigosa',         label: 'Perigosa' },
  { value: 'neogranel',        label: 'Neogranel' },
  { value: 'conteinerizada',   label: 'Conteinerizada' },
]

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10'
const labelClass = 'text-sm font-medium text-foreground'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50'
const btnSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted'

// ponytail: sem preview reativo do piso ANTT no form — o valor é calculado uma
// única vez no servidor ao salvar (assertModulo + buscarCoeficienteVigente +
// calcularPisoMinimoAntt em actions.ts) e exibido na página de detalhe, junto
// do alerta "abaixo do piso" quando aplicável. Evita duplicar a lógica de
// cálculo no client e mantém o form enxuto.
export function NovaCotacaoForm({ clientes, veiculos, motoristas }: Props) {
  const [state, action, isPending] = useActionState(criarCotacao, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.id) router.push(`/frete/cotacoes/${state.id}`)
  }, [state?.id, router])

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Origem + destino — autocomplete nativo (<datalist>) com os 5.571
          municípios do IBGE (src/lib/frete/municipios-br.json, dado público
          oficial, sem custo de API nem dependência de Google Maps). */}
      <datalist id="cidades-br">
        {municipiosBr.map((m) => (
          <option key={`${m.nome}-${m.uf}`} value={`${m.nome} - ${m.uf}`} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="origem">Origem *</label>
          <input id="origem" name="origem" list="cidades-br" required placeholder="Cidade/UF de origem" className={inputClass} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="destino">Destino *</label>
          <input id="destino" name="destino" list="cidades-br" required placeholder="Cidade/UF de destino" className={inputClass} autoComplete="off" />
        </div>
      </div>

      {/* Distância + Tabela ANTT */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="distancia_km">Distância (km) *</label>
          <input id="distancia_km" name="distancia_km" type="number" min={1} step="0.1" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="tabela_antt">Tabela ANTT *</label>
          <select id="tabela_antt" name="tabela_antt" required className={inputClass} defaultValue="">
            <option value="" disabled>Selecione…</option>
            {TABELAS_ANTT.map((t) => (
              <option key={t} value={t}>Tabela {t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tipo de carga */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="tipo_carga">Tipo de carga *</label>
        <select id="tipo_carga" name="tipo_carga" required className={inputClass} defaultValue="">
          <option value="" disabled>Selecione…</option>
          {TIPOS_CARGA.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Veículo + Motorista */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="veiculo_id">Veículo</label>
          <select id="veiculo_id" name="veiculo_id" className={inputClass} defaultValue="">
            <option value="">Nenhum</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.placa}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="motorista_id">Motorista</label>
          <select id="motorista_id" name="motorista_id" className={inputClass} defaultValue="">
            <option value="">Nenhum</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cliente */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="cliente_id">Cliente</label>
        <select id="cliente_id" name="cliente_id" className={inputClass} defaultValue="">
          <option value="">Nenhum</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.razao_social}</option>
          ))}
        </select>
      </div>

      {/* Valor negociado */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="valor_negociado">Valor negociado (R$)</label>
        <input
          id="valor_negociado"
          name="valor_negociado"
          type="number"
          min={0}
          step="0.01"
          placeholder="Opcional — deixe em branco para usar o piso ANTT"
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          O piso mínimo ANTT é calculado ao salvar. Se o valor negociado ficar abaixo do piso, um alerta aparece na página da cotação.
        </p>
      </div>

      {/* Observações */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          placeholder="Detalhes adicionais sobre a cotação…"
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Salvar cotação
        </button>
        <Link href="/frete/cotacoes" className={btnSecondary}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
