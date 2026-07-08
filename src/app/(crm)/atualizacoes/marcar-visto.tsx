'use client'

import { useEffect } from 'react'

/**
 * Componente client que marca a última atualização VISÍVEL pra esta empresa
 * como vista no localStorage. Renderizado dentro da page de Atualizações
 * para que o dot da sidebar suma após a visita.
 */
export function MarcarVisto({ ultimaVisivel }: { ultimaVisivel: string }) {
  useEffect(() => {
    if (ultimaVisivel) {
      localStorage.setItem('atualizacoes_vista', ultimaVisivel)
      // Dispara evento para que a sidebar reaja imediatamente (mesma aba)
      window.dispatchEvent(new Event('atualizacoes-vista'))
    }
  }, [ultimaVisivel])

  return null
}
