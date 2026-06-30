'use client'

import { useEffect } from 'react'
import { ULTIMA_ATUALIZACAO } from '@/lib/changelog'

/**
 * Componente client que marca a última atualização como vista no localStorage.
 * Renderizado dentro da page de Atualizações para que o dot da sidebar suma
 * após a visita.
 */
export function MarcarVisto() {
  useEffect(() => {
    if (ULTIMA_ATUALIZACAO) {
      localStorage.setItem('atualizacoes_vista', ULTIMA_ATUALIZACAO)
      // Dispara evento para que a sidebar reaja imediatamente (mesmo aba)
      window.dispatchEvent(new Event('atualizacoes-vista'))
    }
  }, [])

  return null
}
