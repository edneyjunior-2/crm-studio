import { Truck } from 'lucide-react'
import { VerticalPage } from '@/components/marketing/vertical-page'

export const metadata = {
  title: 'CRM para Frete e Logística · CRM Studio',
  description:
    'CRM Studio para transportadoras: calculadora de piso mínimo ANTT oficial, cadastro de veículos e motoristas com leitura automática de CNH, cotação que vira negócio no pipeline.',
}

const FEATURES = [
  {
    eyebrow: 'Calculadora de frete',
    title: 'Piso mínimo com base na lei, não no cálculo de cabeça.',
    body: 'O piso mínimo é calculado pela tabela ANTT oficial (Lei 13.703/2018), com coeficiente por tipo de carga e número de eixos do veículo — vindo do banco, nunca fixo no código. O valor final é sempre recalculado no servidor no momento de salvar, por segurança.',
    points: [
      'Tabela ANTT oficial (Lei 13.703/2018)',
      'Coeficiente por tipo de carga e número de eixos',
      'Valor sempre recalculado no servidor',
    ],
  },
  {
    eyebrow: 'Veículos e motoristas',
    title: 'Cadastro rápido, com leitura automática de CNH.',
    body: 'Cadastre veículos (placa, tipo, eixos, RNTRC) e motoristas em minutos: envie a foto ou o PDF da CNH e o sistema lê automaticamente e pré-preenche nome, CPF, número, categoria e validade.',
    points: [
      'Cadastro completo de veículos e motoristas',
      'Leitura automática de CNH por foto',
      'Pré-preenchimento dos dados do motorista',
    ],
  },
  {
    eyebrow: 'Cotação e pipeline',
    title: 'Cotação aprovada vira negócio com um clique.',
    body: 'A cotação tem origem, destino, cliente, veículo e motorista vinculados, e segue um workflow de status até concluída. O botão "Gerar negócio" transforma a cotação aprovada em negócio no pipeline — sem duplicar se você clicar de novo.',
    points: [
      'Cotação com origem, destino, cliente, veículo e motorista',
      'Workflow de status até concluída ou cancelada',
      '"Gerar negócio" leva a cotação pro pipeline sem duplicar',
    ],
  },
  {
    eyebrow: 'Painel',
    title: 'Visão da frota e do faturamento num só lugar.',
    body: 'O dashboard mostra veículos e motoristas ativos, cotações em aberto e o valor negociado no mês — sem precisar consolidar planilha nenhuma.',
    points: [
      'KPIs de veículos e motoristas ativos',
      'Cotações em aberto no radar',
      'Valor negociado no mês',
    ],
  },
]

const FAQ = [
  {
    q: 'A calculadora de piso mínimo é confiável, ou é só uma estimativa?',
    a: 'É a fórmula oficial da tabela ANTT (Lei 13.703/2018), com coeficiente por tipo de carga e eixos vindo do banco — nunca fixo no código — e o valor final é sempre recalculado no servidor no momento de salvar, não só no navegador.',
  },
  {
    q: 'Preciso digitar os dados da CNH do motorista na mão?',
    a: 'Não — envia a foto ou o PDF da CNH e o sistema lê automaticamente e pré-preenche nome, CPF, número, categoria e validade.',
  },
  {
    q: 'A cotação aprovada vira negócio automaticamente?',
    a: 'Com um clique no botão "Gerar negócio" — e é idempotente, não duplica se você clicar de novo.',
  },
  {
    q: 'Isso substitui o resto do CRM, ou é um sistema separado de frete?',
    a: 'É o CRM Studio inteiro — pipeline, financeiro, clientes, contratos — com o módulo de Frete e Logística ligado.',
  },
]

export default function FreteELogisticaPage() {
  return (
    <VerticalPage
      plano="frete"
      icon={Truck}
      eyebrow="Para transportadoras e operadores logísticos"
      heroTitle="Frete e Logística com base legal, sem calculadora à parte."
      heroSubtitle="Calcule o piso mínimo pela tabela ANTT oficial, cadastre veículos e motoristas com leitura automática de CNH, e transforme cotação aprovada em negócio no pipeline — tudo no mesmo sistema."
      features={FEATURES}
      faq={FAQ}
      ctaTitle="Veja o CRM Studio com a frota da sua transportadora."
    />
  )
}
