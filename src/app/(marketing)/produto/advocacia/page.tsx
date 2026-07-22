import { Scale } from 'lucide-react'
import { VerticalPage } from '@/components/marketing/vertical-page'

export const metadata = {
  title: 'CRM para Advocacia · CRM Studio',
  description:
    'CRM Studio para escritórios de advocacia: DataJud e DJEN sincronizam movimentações e publicações automaticamente, prazos com alerta, honorários no financeiro.',
}

const FEATURES = [
  {
    eyebrow: 'Movimentações e publicações',
    title: 'DataJud e DJEN vigiam por você.',
    body: 'O DataJud sincroniza movimentações oficiais por número CNJ, e o DJEN sincroniza publicações por OAB de cada advogado — sem caçar nada manualmente em diário nenhum. A timeline fica agrupada por mês, mais recente primeiro.',
    points: [
      'Movimentações por número CNJ (DataJud)',
      'Publicações por OAB de cada advogado (DJEN)',
      'Timeline agrupada por mês',
    ],
  },
  {
    eyebrow: 'Prazos e audiências',
    title: 'Nenhum prazo passa batido.',
    body: 'Prazos avisam antes de vencer, e audiências detectadas na timeline viram evento no Google Calendar automaticamente. Pra processos sem cobertura do DataJud, qualquer pessoa do escritório registra a movimentação manualmente.',
    points: [
      'Alerta antes do prazo vencer',
      'Audiência detectada vira evento no Google Calendar',
      'Movimentação manual pra processo sem DataJud',
    ],
  },
  {
    eyebrow: 'Financeiro jurídico',
    title: 'Honorário virou lançamento, não anotação.',
    body: 'Honorário fixo ou percentual da causa, com preview do valor ao vivo antes de salvar. Custas e honorários lançam direto no financeiro do escritório, sem digitar duas vezes.',
    points: [
      'Honorário fixo ou percentual da causa',
      'Custas e honorários lançam direto no financeiro',
      'Preview do valor ao vivo, antes de salvar',
    ],
  },
  {
    eyebrow: 'Migração',
    title: 'Sua carteira de processos entra de uma vez.',
    body: 'Importe a carteira inteira via planilha Excel — CNJ, cliente, área, vara, comarca, honorários e indicação. O dashboard já nasce com cards clicáveis pra filtrar por status, e os dados do seu escritório ficam isolados dos de qualquer outra empresa.',
    points: [
      'Importação por planilha Excel',
      'Dashboard com cards clicáveis por status',
      'Dados isolados por escritório',
    ],
  },
]

const FAQ = [
  {
    q: 'O DataJud e o DJEN substituem a assinatura de um diário oficial?',
    a: 'Cobrem movimentação judicial (DataJud, por número CNJ) e publicação (DJEN, por OAB) automaticamente — você não precisa mais caçar isso manualmente. Processos sem cobertura de nenhum dos dois aceitam movimentação manual.',
  },
  {
    q: 'Preciso digitar minha carteira de processos do zero?',
    a: 'Não. A importação é por planilha Excel: CNJ, cliente, área, vara, comarca, honorários e indicação — sua planilha original continua intacta enquanto você testa.',
  },
  {
    q: 'O financeiro do escritório mistura tudo?',
    a: 'Não. Honorários (fixo ou percentual da causa) e custas lançam direto nas contas do processo, dentro do mesmo financeiro do CRM — sem digitar duas vezes e sem planilha à parte.',
  },
  {
    q: 'Meus dados de processos ficam visíveis pra outros escritórios que usam o CRM Studio?',
    a: 'Não. Cada empresa tem os dados isolados no banco — ninguém de fora do seu escritório enxerga.',
  },
]

export default function AdvocaciaPage() {
  return (
    <VerticalPage
      plano="advocacia"
      icon={Scale}
      eyebrow="Para escritórios de advocacia"
      heroTitle="O processo se atualiza sozinho, todo santo dia."
      heroSubtitle="DataJud e DJEN avisam quando um processo se mexe ou sai uma publicação — sem caçar nada em diário nenhum. Prazos, audiências e honorários no mesmo lugar do resto do escritório."
      features={FEATURES}
      faq={FAQ}
      ctaTitle="Veja o CRM Studio com os processos do seu escritório."
    />
  )
}
