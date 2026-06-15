'use client'

import 'driver.js/dist/driver.css'
import { useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const TOUR_KEY = 'crmstudio_tour_boasvindas_v1'

function hasTourBeenSeen(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(TOUR_KEY) === 'seen'
  } catch {
    return false
  }
}

function markTourAsSeen(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(TOUR_KEY, 'seen')
  } catch {
    // localStorage indisponível — degrada sem erro
  }
}

function resetTourSeen(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(TOUR_KEY)
  } catch {
    // silently fail
  }
}

declare global {
  interface Window {
    __crmTourStart?: () => void
  }
}

interface TourStep {
  element?: string
  popover: {
    title: string
    description: string
    side?: 'left' | 'right' | 'top' | 'bottom'
  }
}

const tourSteps: TourStep[] = [
  // Passo 1: sem element → driver.js exibe centralizado
  {
    popover: {
      title: 'Bem-vindo(a) ao CRM Studio!',
      description:
        'Vou te mostrar rapidinho o que dá pra fazer aqui. Use os botões abaixo para navegar.',
    },
  },
  {
    element: '[data-tour="solucoes"]',
    popover: {
      title: 'Soluções',
      description:
        'Cadastre os produtos e serviços que você representa ou oferece aos clientes.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="parceiros"]',
    popover: {
      title: 'Parceiros',
      description:
        'Gerencie as empresas e pessoas com quem você trabalha em conjunto para fechar negócios.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="clientes"]',
    popover: {
      title: 'Clientes',
      description:
        'Aqui ficam todas as empresas e pessoas que você atende. Cadastre, busque e veja o histórico de cada um.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="pipeline"]',
    popover: {
      title: 'Pipeline de Vendas',
      description:
        'Acompanhe cada negociação em aberto: desde o primeiro contato até o fechamento. Veja onde estão suas oportunidades.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="onboarding"]',
    popover: {
      title: 'Onboarding',
      description:
        'Gerencie o processo de entrada de novos clientes: tarefas, checklist e etapas de implantação.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="calendario"]',
    popover: {
      title: 'Calendário',
      description:
        'Veja suas reuniões, tarefas e compromissos num só lugar. Integre com o Google Calendar se quiser.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="financeiro"]',
    popover: {
      title: 'Financeiro',
      description:
        'Onde você controla o dinheiro que entra e sai: contas a receber, contas a pagar e fluxo de caixa.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="contratos"]',
    popover: {
      title: 'Contratos',
      description:
        'Guarde e gerencie os contratos assinados com seus clientes. Nunca perca o prazo de renovação.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="estoque"]',
    popover: {
      title: 'Estoque',
      description:
        'Controle a quantidade de produtos disponíveis para venda ou entrega.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="rh"]',
    popover: {
      title: 'RH',
      description:
        'Gerencie a equipe: colaboradores, cargos e informações de pessoal.',
      side: 'right',
    },
  },
  {
    element: '[data-tour="automacoes"]',
    popover: {
      title: 'Automações',
      description:
        'Crie regras automáticas para o sistema agir por você: enviar alertas, mover negócios de etapa e muito mais.',
      side: 'right',
    },
  },
  // Passo final — CTA de cadastro do primeiro cliente
  {
    element: '[data-tour="clientes"]',
    popover: {
      title: 'Pronto para começar!',
      description:
        'Agora você conhece o sistema. Que tal cadastrar o seu primeiro cliente? Clique em "Concluir" para ir direto à tela de clientes.',
      side: 'right',
    },
  },
]

async function startTour(
  onFinish: () => void,
): Promise<void> {
  if (typeof window === 'undefined') return

  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const { driver } = await import('driver.js')

  // Filtra passos com element — o passo 1 (sem element) sempre é incluído
  const stepsToShow = tourSteps.filter((step) => {
    if (!step.element) return true // passo centralizado
    try {
      return !!document.querySelector(step.element)
    } catch {
      return false
    }
  })

  if (stepsToShow.length === 0) return

  const driverInstance = driver({
    showProgress: false,
    animate: !prefersReduced,
    smoothScroll: !prefersReduced,
    popoverClass: 'crm-tour-popover',
    nextBtnText: 'Seguinte',
    prevBtnText: 'Anterior',
    doneBtnText: 'Concluir',
    allowClose: true,
    steps: stepsToShow.map((step, index) => {
      const isFirst = index === 0
      const isLast = index === stepsToShow.length - 1
      return {
        ...(step.element ? { element: step.element } : {}),
        popover: {
          title: step.popover.title,
          description: step.popover.description,
          ...(step.popover.side ? { side: step.popover.side } : {}),
          ...(isFirst ? { nextBtnText: 'Começar' } : {}),
          ...(isLast ? { nextBtnText: 'Concluir' } : {}),
        },
      }
    }),
    // Injeta botão "Pular" em todos os passos via onPopoverRender
    onPopoverRender: (popover) => {
      const footer = popover.footer

      // Evita duplicar o botão se onPopoverRender for chamado mais de uma vez
      if (footer.querySelector('.crm-tour-pular-btn')) return

      const btn = document.createElement('button')
      btn.textContent = 'Pular'
      btn.className = 'crm-tour-pular-btn'
      btn.type = 'button'
      btn.addEventListener('click', () => {
        // "Pular": grava marca, fecha, NÃO navega
        markTourAsSeen()
        driverInstance.destroy()
      })

      // Insere antes dos botões de navegação (que ficam à direita)
      footer.insertBefore(btn, footer.firstChild)
    },
    // onNextClick global: assume controle do avanço em TODOS os passos.
    // Último passo ("Concluir"): grava marca + navega + destroi aqui mesmo,
    // pois destroy() chama g(false) e NÃO dispara onDestroyStarted.
    // Passos intermediários: apenas moveNext().
    onNextClick: () => {
      if (driverInstance.isLastStep()) {
        markTourAsSeen()
        onFinish() // navega para /clientes
        driverInstance.destroy()
      } else {
        driverInstance.moveNext()
      }
    },
    // onDestroyStarted é disparado APENAS por X / Esc / clique no overlay
    // (caminhos de fechamento, nunca conclusão). Grava marca e confirma teardown.
    // NÃO navega — esses caminhos não vão para /clientes.
    onDestroyStarted: () => {
      markTourAsSeen()
      driverInstance.destroy()
    },
  })

  driverInstance.drive()
}

export function TourBoasVindas() {
  const pathname = usePathname()
  const router = useRouter()

  const tryAutoStart = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (hasTourBeenSeen()) return

    // Aguarda o DOM da sidebar estar pintado
    await new Promise<void>((resolve) => setTimeout(resolve, 800))
    await startTour(() => {
      router.push('/clientes')
    })
  }, [router])

  useEffect(() => {
    // Auto-inicia apenas no dashboard, na primeira visita
    if (pathname === '/dashboard') {
      void tryAutoStart()
    }

    // Expõe o start global para o botão "Refazer tour"
    window.__crmTourStart = async () => {
      resetTourSeen()
      await startTour(() => {
        router.push('/clientes')
      })
    }

    return () => {
      delete window.__crmTourStart
    }
  }, [pathname, tryAutoStart, router])

  // Sem renderização visual própria
  return null
}

// Exporta para uso no cliente (botão em minha-conta)
export { resetTourSeen }
