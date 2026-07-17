'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, MapPinned } from 'lucide-react'
import { criarCotacao } from '../actions'
import { calcularDistanciaAction } from '../calcular-distancia-actions'
import municipiosBr from '@/lib/frete/municipios-br.json'

interface Cliente { id: string; razao_social: string }
interface Veiculo { id: string; placa: string; eixos: number | null }
interface Motorista { id: string; nome: string }

// Nomes de mercado por número de eixos do veículo combinado — a tabela ANTT
// oficial só fala em "número de eixos", mas quem cota frete pensa em termos
// como "carreta"/"bitrem" (mesmo mapeamento usado na planilha de referência
// do parceiro do setor que validamos). Nº de eixos é o que de fato indexa o
// coeficiente CCD/CC (ver antt-calculadora.ts).
const TIPOS_VEICULO_EIXOS = [
  { eixos: 2, label: 'Toco / VUC (2 eixos)' },
  { eixos: 3, label: 'Truck (3 eixos)' },
  { eixos: 4, label: 'Bitruck (4 eixos)' },
  { eixos: 5, label: 'Carreta (5 eixos)' },
  { eixos: 6, label: 'Carreta (6 eixos)' },
  { eixos: 7, label: 'Bitrem (7 eixos)' },
  { eixos: 9, label: 'Rodotrem (9 eixos)' },
]

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
  const eixosRef = useRef<HTMLSelectElement>(null)
  const origemRef = useRef<HTMLInputElement>(null)
  const distanciaRef = useRef<HTMLInputElement>(null)
  const [calculandoDistancia, startDistancia] = useTransition()
  const [avisoDistancia, setAvisoDistancia] = useState<string | null>(null)

  // Se o veículo selecionado já tem eixos cadastrados, pré-preenche o
  // seletor de eixos — mas continua editável (ex.: veículo sem eixos
  // cadastrado ainda, ou vendedor cotando sem veículo definido).
  function handleVeiculoChange(veiculoId: string) {
    const veiculo = veiculos.find((v) => v.id === veiculoId)
    if (veiculo?.eixos && eixosRef.current) {
      eixosRef.current.value = String(veiculo.eixos)
    }
  }

  // Ao sair do campo Destino, tenta calcular a distância de rota real
  // (OpenRouteService) entre origem e destino e pré-preenche o campo — nunca
  // bloqueia o fluxo: se origem/destino não forem cidades reconhecidas (texto
  // livre digitado sem usar o autocomplete) ou a chamada falhar, o campo
  // continua vazio/editável pra digitação manual.
  function handleDestinoBlur(destino: string) {
    const origem = origemRef.current?.value ?? ''
    if (!origem || !destino) return
    setAvisoDistancia(null)
    startDistancia(async () => {
      const resultado = await calcularDistanciaAction(origem, destino)
      if (resultado.distanciaKm != null && distanciaRef.current) {
        distanciaRef.current.value = String(resultado.distanciaKm)
        setAvisoDistancia(`Distância de rota calculada automaticamente: ${resultado.distanciaKm} km. Confira e ajuste se necessário.`)
      } else if (resultado.error) {
        // Silencioso por padrão — cidade digitada fora do autocomplete é comum
        // e não deve parecer um erro. Só avisa quando a API de rota falhou de
        // verdade (não quando é só "cidade não reconhecida").
        if (!resultado.error.includes('lista de cidades')) {
          setAvisoDistancia(`Não foi possível calcular a distância automaticamente (${resultado.error}). Preencha manualmente.`)
        }
      }
    })
  }

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
          <input id="origem" name="origem" ref={origemRef} list="cidades-br" required placeholder="Cidade/UF de origem" className={inputClass} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="destino">Destino *</label>
          <input
            id="destino"
            name="destino"
            list="cidades-br"
            required
            placeholder="Cidade/UF de destino"
            className={inputClass}
            autoComplete="off"
            onBlur={(e) => handleDestinoBlur(e.target.value)}
          />
        </div>
      </div>

      {/* Distância + Tabela ANTT */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="distancia_km">
            Distância (km) *
            {calculandoDistancia && <Loader2 className="ml-1.5 inline size-3 animate-spin text-muted-foreground" />}
          </label>
          <input id="distancia_km" name="distancia_km" ref={distanciaRef} type="number" min={1} step="0.1" required className={inputClass} />
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

      {avisoDistancia && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <MapPinned className="size-3.5 shrink-0" />
          {avisoDistancia}
        </div>
      )}

      {/* Tipo de carga + Nº de eixos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="tipo_carga">Tipo de carga *</label>
          <select id="tipo_carga" name="tipo_carga" required className={inputClass} defaultValue="">
            <option value="" disabled>Selecione…</option>
            {TIPOS_CARGA.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="eixos">Tipo de veículo *</label>
          <select id="eixos" name="eixos" ref={eixosRef} required className={inputClass} defaultValue="">
            <option value="" disabled>Selecione…</option>
            {TIPOS_VEICULO_EIXOS.map((t) => (
              <option key={t.eixos} value={t.eixos}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Veículo + Motorista */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="veiculo_id">Veículo</label>
          <select
            id="veiculo_id"
            name="veiculo_id"
            className={inputClass}
            defaultValue=""
            onChange={(e) => handleVeiculoChange(e.target.value)}
          >
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
