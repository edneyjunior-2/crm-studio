import { HardHat } from 'lucide-react'
import { VerticalPage } from '@/components/marketing/vertical-page'

export const metadata = {
  title: 'CRM para Engenharia e Obras · CRM Studio',
  description:
    'CRM Studio para engenharia e construção civil: orçamento com catálogo SINAPI, medição por etapa, equipe e ponto por obra, estoque de materiais incluso.',
}

const FEATURES = [
  {
    eyebrow: 'Orçamento',
    title: 'Composições e insumos direto da fonte oficial.',
    body: 'Monte o orçamento buscando composições e insumos no catálogo SINAPI, com BDI e desoneração aplicados automaticamente, e gere o PDF pronto pra enviar ao cliente.',
    points: [
      'Catálogo SINAPI oficial de composições e insumos',
      'BDI e desoneração aplicados automaticamente',
      'PDF de orçamento pronto pro cliente',
    ],
  },
  {
    eyebrow: 'Execução',
    title: 'A obra avança, o sistema acompanha.',
    body: 'Cada obra é medida por etapa, com avanço de status e boletim físico-financeiro (curva S) — dá pra ver onde a obra está sem abrir planilha nenhuma.',
    points: [
      'Medição por etapa com avanço de status',
      'Boletim físico-financeiro / curva S',
      'Histórico de medições por obra',
    ],
  },
  {
    eyebrow: 'Equipe e ponto',
    title: 'Quem tá em qual obra, sem planilha de RH solta.',
    body: 'A equipe é alocada por obra, e o ponto eletrônico já vem com filtro nativo "por obra" — é a mesma base do módulo de RH, generalizada pra qualquer tipo de negócio.',
    points: [
      'Equipe alocada por obra',
      'Ponto eletrônico com filtro por obra',
      'Mesma base do módulo de RH',
    ],
  },
  {
    eyebrow: 'Materiais',
    title: 'Estoque de obra incluso, não é módulo à parte.',
    body: 'Controle os materiais com saldo e custo médio recalculados automaticamente a cada movimentação, e um alerta visual quando um item está abaixo do mínimo.',
    points: [
      'Estoque de materiais incluso no plano Engenharia',
      'Saldo e custo médio recalculados a cada movimentação',
      'Alerta de estoque abaixo do mínimo',
    ],
  },
]

const FAQ = [
  {
    q: 'O orçamento usa a tabela SINAPI de verdade, ou é só um formulário livre?',
    a: 'É o catálogo SINAPI oficial — busca composições e insumos direto dele, aplica BDI e desoneração e gera o PDF pro cliente.',
  },
  {
    q: 'Dá pra acompanhar o andamento físico da obra, não só o financeiro?',
    a: 'Sim — medição por etapa, com boletim físico-financeiro (curva S) e histórico completo por obra.',
  },
  {
    q: 'O ponto da equipe de obra é outro sistema?',
    a: 'Não, é o mesmo módulo de RH do CRM, com um filtro nativo "por obra" pra ver só quem está alocado ali.',
  },
  {
    q: 'O módulo de materiais/estoque é add-on à parte?',
    a: 'Não no plano Engenharia — o módulo Estoque já vem incluso.',
  },
]

export default function EngenhariaPage() {
  return (
    <VerticalPage
      plano="engenharia"
      icon={HardHat}
      eyebrow="Para engenharia e construção civil"
      heroTitle="Do orçamento à medição, sem planilha solta."
      heroSubtitle="Monte o orçamento com a tabela SINAPI oficial, acompanhe a obra por etapa e feche o ponto da equipe — tudo ligado ao mesmo financeiro e ao mesmo pipeline de vendas."
      features={FEATURES}
      faq={FAQ}
      ctaTitle="Veja o CRM Studio com o orçamento da sua obra."
    />
  )
}
