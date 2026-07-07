'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { ClienteForm } from '@/components/crm/clientes/cliente-form'
import type { Cliente } from '@/types'

type ClienteOption = Pick<Cliente, 'id' | 'razao_social'>

interface ClienteComboboxProps {
  /** Lista base de clientes do tenant (vinda do server). */
  clientes: ClienteOption[]
  value: string | null
  onChange: (clienteId: string | null) => void
  required?: boolean
  disabled?: boolean
}

/**
 * Seletor de cliente com busca (Base UI Combobox) + cadastro inline. Reusa
 * `cliente-form.tsx` num dialog controlado — ao cadastrar, o novo cliente é
 * adicionado à lista local e selecionado automaticamente, sem sair do form de
 * negócio (mesmo padrão já usado em processos/novo/novo-processo-form.tsx).
 */
export function ClienteCombobox({
  clientes,
  value,
  onChange,
  required = false,
  disabled = false,
}: ClienteComboboxProps) {
  const [lista, setLista] = useState<ClienteOption[]>(clientes)
  const [novoClienteOpen, setNovoClienteOpen] = useState(false)

  // Ressincroniza se a lista vinda do server mudar (ex.: navegação/revalidate).
  useEffect(() => {
    setLista(clientes)
  }, [clientes])

  const selecionado = lista.find((c) => c.id === value) ?? null

  function handleNovoCliente(cliente: { id: string; razao_social: string }) {
    setLista((prev) =>
      [...prev, cliente].sort((a, b) => a.razao_social.localeCompare(b.razao_social, 'pt-BR'))
    )
    onChange(cliente.id)
    setNovoClienteOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Combobox<ClienteOption>
        items={lista}
        value={selecionado}
        onValueChange={(item) => onChange(item?.id ?? null)}
        itemToStringLabel={(c) => c.razao_social}
        isItemEqualToValue={(a, b) => a.id === b.id}
        required={required}
        disabled={disabled}
      >
        <ComboboxInputGroup>
          <ComboboxInput placeholder="Buscar cliente por nome..." />
          <ComboboxClear aria-label="Limpar cliente selecionado" />
          <ComboboxIcon />
        </ComboboxInputGroup>
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxEmpty>Nenhum cliente encontrado.</ComboboxEmpty>
              <ComboboxList>
                {(cliente: ClienteOption) => (
                  <ComboboxItem key={cliente.id} value={cliente}>
                    {cliente.razao_social}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </Combobox>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setNovoClienteOpen(true)}
        className="h-7 w-fit gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Cadastrar novo cliente
      </Button>

      <ClienteForm
        open={novoClienteOpen}
        onOpenChange={setNovoClienteOpen}
        onSuccess={handleNovoCliente}
      />
    </div>
  )
}
