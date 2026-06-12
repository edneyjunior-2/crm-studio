'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface GoogleConnectFeedbackProps {
  status?: string
}

export function GoogleConnectFeedback({ status }: GoogleConnectFeedbackProps) {
  const router = useRouter()

  useEffect(() => {
    if (!status) return

    if (status === 'connected') {
      toast.success('Google Calendar conectado com sucesso!')
    } else if (status === 'denied') {
      toast.error('Acesso ao Google Calendar negado.')
    } else if (status === 'error') {
      toast.error('Erro ao conectar com o Google Calendar. Tente novamente.')
    }

    // Remove o parâmetro da URL sem recarregar a página
    router.replace('/minha-conta')
  }, [status, router])

  return null
}
