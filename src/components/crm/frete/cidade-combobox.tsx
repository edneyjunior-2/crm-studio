'use client'

import { useMemo } from 'react'
import {
  Combobox,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxIcon,
  ComboboxClear,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxPopup,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox'
import municipiosBr from '@/lib/frete/municipios-br.json'
import aeroportosBr from '@/lib/frete/aeroportos-br.json'

interface CidadeOption {
  nome: string
  uf: string
  /** Siglas de aeroporto (IATA) da cidade, quando houver alguma reconhecida —
   * ver src/lib/frete/aeroportos-br.json (188 códigos, cruzados com o
   * dataset OpenFlights + a lista oficial de municípios do IBGE). Array
   * porque 10 cidades têm mais de um aeroporto (Rio de Janeiro: GIG/SDU/SNZ;
   * São Paulo: GRU/CGH; Belo Horizonte: CNF/PLU; etc.) — usar Record<cidade,
   * código único> descartava um deles silenciosamente. Só pra busca/exibição
   * — nunca entra no valor canônico "Nome - UF" que é o que é submetido/
   * geocodificado (buscarCoordenadaCidade em openrouteservice.ts). */
  codigos: string[]
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Nome canônico "Nome - UF" — o mesmo formato que buscarCoordenadaCidade()
 * espera pra geocodificar. NUNCA inclui o código de aeroporto. */
export function cidadeParaTexto(cidade: Pick<CidadeOption, 'nome' | 'uf'>): string {
  return `${cidade.nome} - ${cidade.uf}`
}

interface Props {
  id?: string
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

/**
 * Busca de cidade brasileira por nome, UF ou sigla de aeroporto (ex.: "SSA"
 * encontra "Salvador - BA", "GRU" encontra "São Paulo - SP"). O valor
 * selecionado é sempre o texto canônico "Nome - UF" — a sigla de aeroporto é
 * só um atalho de busca, nunca aparece no valor final do campo.
 */
export function CidadeCombobox({ id, value, onChange, placeholder, required, className }: Props) {
  const cidades = useMemo<CidadeOption[]>(() => {
    const codigosPorCidade = new Map<string, string[]>()
    for (const [codigo, info] of Object.entries(aeroportosBr as Record<string, { nome: string; uf: string }>)) {
      const chave = `${info.nome}|${info.uf}`
      const lista = codigosPorCidade.get(chave)
      if (lista) lista.push(codigo)
      else codigosPorCidade.set(chave, [codigo])
    }
    return (municipiosBr as { nome: string; uf: string }[]).map((m) => ({
      nome: m.nome,
      uf: m.uf,
      codigos: codigosPorCidade.get(`${m.nome}|${m.uf}`) ?? [],
    }))
  }, [])

  const selecionado = useMemo<CidadeOption | null>(() => {
    if (!value) return null
    const match = value.match(/^(.+?)\s*-\s*([A-Za-z]{2})$/)
    if (!match) return null
    const [, nome, uf] = match
    return cidades.find((c) => c.nome === nome && c.uf.toUpperCase() === uf.toUpperCase()) ?? null
  }, [value, cidades])

  return (
    <Combobox<CidadeOption>
      items={cidades}
      value={selecionado}
      onValueChange={(item) => onChange(item ? cidadeParaTexto(item) : '')}
      itemToStringLabel={cidadeParaTexto}
      isItemEqualToValue={(a, b) => a.nome === b.nome && a.uf === b.uf}
      required={required}
      filter={(item, query) => {
        const q = normalizar(query.trim())
        if (!q) return true
        // Prefixo por PALAVRA (não substring solta em qualquer posição) — com
        // substring livre, buscar "SSA" batia em "aSSAré"/"juSSAra"/etc. e
        // afogava o resultado certo (Salvador, via código de aeroporto) no
        // meio de dezenas de cidades sem relação nenhuma com a busca.
        const nomeNormalizado = normalizar(item.nome)
        const bateNome = nomeNormalizado.split(/\s+/).some((palavra) => palavra.startsWith(q))
        const bateUf = item.uf.toLowerCase() === q
        const bateCodigo = item.codigos.some((c) => c.toLowerCase().startsWith(q))
        return bateNome || bateUf || bateCodigo
      }}
    >
      <ComboboxInputGroup className={className}>
        <ComboboxInput id={id} placeholder={placeholder ?? 'Cidade, UF ou sigla do aeroporto…'} />
        <ComboboxClear aria-label="Limpar" />
        <ComboboxIcon />
      </ComboboxInputGroup>
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxEmpty>Nenhuma cidade encontrada.</ComboboxEmpty>
            <ComboboxList>
              {(cidade: CidadeOption) => (
                <ComboboxItem key={`${cidade.nome}-${cidade.uf}`} value={cidade}>
                  <span>{cidade.nome} - {cidade.uf}</span>
                  {cidade.codigos.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">{cidade.codigos.join(', ')}</span>
                  )}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </Combobox>
  )
}
