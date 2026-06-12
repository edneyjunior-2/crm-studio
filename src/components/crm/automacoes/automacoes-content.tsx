'use client'

import { useState } from 'react'
import {
  Clock, Mail, BellRing, AlertTriangle, MessageCircle,
  HelpCircle, CheckCircle2, Zap, Timer, CalendarClock, FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Automacao {
  id: string
  nome: string
  subtitulo: string
  categoria: 'admin' | 'vendas'
  status: 'ativa' | 'em_breve'
  frequencia?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  descricao_leiga: string
  casos_de_uso: string[]
}

const AUTOMACOES: Automacao[] = [
  // ── ADMIN ────────────────────────────────────────────────────────────────
  {
    id: 'marcar-contas-atrasadas',
    nome: 'Marcar Contas Vencidas',
    subtitulo: 'Atualiza sozinho o status de contas que passaram do prazo de pagamento',
    categoria: 'admin',
    status: 'ativa',
    frequencia: 'Todo dia às 8h (horário de Brasília)',
    icon: Clock,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-500/10',
    descricao_leiga:
      'Todo dia de manhã, o sistema verifica se alguma conta a pagar passou da data de vencimento. Se passou e ainda não foi paga, ela é marcada automaticamente como "Atrasada". Você não precisa fazer nada — o sistema cuida disso sozinho.',
    casos_de_uso: [
      'Você esqueceu de atualizar o status de uma conta que venceu ontem',
      'O financeiro precisa ver quais contas estão vencidas sem conferir uma por uma',
      'Os relatórios sempre mostram o status real das contas sem intervenção manual',
      'O KPI de "A Pagar" fica sempre correto, incluindo as contas em atraso',
    ],
  },
  {
    id: 'relatorio-financeiro-semanal',
    nome: 'Relatório Financeiro Semanal',
    subtitulo: 'Envia por e-mail um resumo financeiro toda segunda-feira de manhã',
    categoria: 'admin',
    status: 'em_breve',
    frequencia: 'Toda segunda-feira às 8h',
    icon: FileText,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-500/10',
    descricao_leiga:
      'Toda segunda-feira cedo, você recebe no e-mail um resumo completo do financeiro: quanto tem a receber na semana, quanto tem a pagar, quais contas estão atrasadas e o saldo atual de cada conta bancária. Tudo organizado, sem precisar abrir o sistema.',
    casos_de_uso: [
      'Você quer ter uma visão geral do financeiro sem precisar abrir o CRM toda semana',
      'Quer compartilhar o resumo financeiro da semana com os sócios automaticamente',
      'Preparação rápida para reuniões semanais de gestão',
    ],
  },
  {
    id: 'alerta-conta-vencendo',
    nome: 'Alerta de Conta Vencendo',
    subtitulo: 'Avisa por e-mail 3 dias antes de uma conta a pagar vencer',
    categoria: 'admin',
    status: 'em_breve',
    frequencia: '3 dias antes do vencimento',
    icon: BellRing,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-500/10',
    descricao_leiga:
      'O sistema avisa você por e-mail 3 dias antes de qualquer conta a pagar vencer. Assim você tem tempo de organizar o pagamento antes de atrasar e evita multas e juros desnecessários.',
    casos_de_uso: [
      'Você não quer ser pego de surpresa com uma conta vencendo amanhã',
      'Quer ter tempo de providenciar o pagamento com antecedência',
      'Evitar multas e juros por atraso, que aparecem no "Preço Real Pago"',
    ],
  },
  {
    id: 'relatorio-comissoes-mensal',
    nome: 'Relatório de Comissões do Mês',
    subtitulo: 'Envia para cada comercial o resumo das comissões do mês fechado',
    categoria: 'admin',
    status: 'em_breve',
    frequencia: 'Todo primeiro dia do mês',
    icon: Mail,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-500/10',
    descricao_leiga:
      'No início de cada mês, o sistema calcula automaticamente as comissões de cada membro da equipe comercial com base nos negócios fechados no mês anterior e envia um e-mail personalizado para cada um com o total a receber.',
    casos_de_uso: [
      'Você quer que cada vendedor receba automaticamente o extrato das próprias comissões',
      'Evitar calcular comissões na mão todo mês',
      'Dar transparência para o time sobre quanto cada um vai receber',
    ],
  },

  // ── VENDAS ───────────────────────────────────────────────────────────────
  {
    id: 'negocio-parado-pipeline',
    nome: 'Negócio Parado no Pipeline',
    subtitulo: 'Alerta o responsável quando um negócio fica dias sem nenhuma atividade',
    categoria: 'vendas',
    status: 'em_breve',
    icon: AlertTriangle,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-500/10',
    descricao_leiga:
      'Se um negócio no pipeline ficar parado — sem nenhuma atividade registrada por um número de dias que você define — o sistema manda um lembrete para o responsável. Assim nenhum cliente em negociação fica esquecido no meio do funil.',
    casos_de_uso: [
      'Um vendedor esqueceu de dar follow-up em uma proposta enviada há 4 dias',
      'Um cliente está esperando um retorno da equipe e ninguém percebeu',
      'Garantir que nenhum negócio fique parado mais de 5 dias em qualquer etapa',
      'Identificar negócios "frios" antes que o cliente desista',
    ],
  },
  {
    id: 'lembrete-followup-proposta',
    nome: 'Lembrete de Follow-up de Proposta',
    subtitulo: 'Lembra o vendedor de entrar em contato 2 dias após avançar para "Proposta"',
    categoria: 'vendas',
    status: 'em_breve',
    frequencia: '2 dias após mover para Proposta',
    icon: CalendarClock,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-500/10',
    descricao_leiga:
      'Quando um negócio avança para a etapa "Proposta" no pipeline, o sistema agenda automaticamente um lembrete para o responsável entrar em contato com o cliente 2 dias depois. O follow-up vira um processo automático — não depende mais da memória do vendedor.',
    casos_de_uso: [
      'Você enviou uma proposta e quer ser lembrado de ligar para o cliente',
      'Garantir que todo cliente que recebeu proposta seja contactado dentro de 48h',
      'Manter o ritmo de follow-up sem depender de post-it ou planilha paralela',
    ],
  },
  {
    id: 'notificacao-whatsapp-pipeline',
    nome: 'Notificação WhatsApp de Avanço',
    subtitulo: 'Avisa no WhatsApp quando um negócio muda de etapa no pipeline',
    categoria: 'vendas',
    status: 'em_breve',
    icon: MessageCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-500/10',
    descricao_leiga:
      'Quando um negócio avança ou recua de etapa no pipeline, o responsável recebe uma mensagem no WhatsApp com o que mudou. Você fica sabendo em tempo real, mesmo que não esteja com o computador aberto.',
    casos_de_uso: [
      'Um sócio quer ser avisado no WhatsApp quando um negócio grande for fechado',
      'O vendedor quer saber na hora quando a proposta dele for aprovada',
      'Acompanhar o pipeline pelo celular sem precisar abrir o CRM',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────

function AutomacaoCard({ automacao }: { automacao: Automacao }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const Icon = automacao.icon
  const isAtiva = automacao.status === 'ativa'

  return (
    <>
      <div
        className={cn(
          'flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-colors',
          !isAtiva && 'opacity-55'
        )}
      >
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', automacao.iconBg)}>
          <Icon className={cn('size-5', automacao.iconColor)} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{automacao.nome}</span>
            {isAtiva ? (
              <Badge className="border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-700">
                <CheckCircle2 className="mr-1 size-2.5" />
                Ativa
              </Badge>
            ) : (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                Em breve
              </Badge>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{automacao.subtitulo}</p>

          {automacao.frequencia && isAtiva && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Timer className="size-3 text-muted-foreground/50" />
              <span className="text-[11px] text-muted-foreground/60">{automacao.frequencia}</span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setHelpOpen(true)}
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
        >
          <HelpCircle className="size-4" />
          <span className="sr-only">O que é isso?</span>
        </Button>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', automacao.iconBg)}>
                <Icon className={cn('size-4', automacao.iconColor)} />
              </div>
              <DialogTitle className="text-base leading-snug">{automacao.nome}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {automacao.descricao_leiga}
            </p>

            {automacao.frequencia && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                <Timer className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Quando roda:</strong> {automacao.frequencia}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quando usar
              </p>
              <ul className="flex flex-col gap-2">
                {automacao.casos_de_uso.map((caso, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                    {caso}
                  </li>
                ))}
              </ul>
            </div>

            {automacao.status === 'em_breve' && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Esta automação está no roadmap e será implementada em breve.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function AutomacoesContent() {
  const adminAutomacoes = AUTOMACOES.filter((a) => a.categoria === 'admin')
  const vendasAutomacoes = AUTOMACOES.filter((a) => a.categoria === 'vendas')
  const ativas = AUTOMACOES.filter((a) => a.status === 'ativa').length

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
            Automações
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Processos que o sistema executa automaticamente para você e sua equipe.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shrink-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Zap className="size-3.5 text-emerald-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">Rodando agora</p>
            <p className="text-sm font-semibold text-foreground">{ativas} de {AUTOMACOES.length}</p>
          </div>
        </div>
      </div>

      {/* Automações do Sistema */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-amber-500/10">
              <Zap className="size-3 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Automações do Sistema</h3>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Admin</Badge>
          </div>
          <p className="pl-7 text-xs text-muted-foreground">
            Processos internos que mantêm os dados sempre corretos e atualizados — sem você precisar fazer nada.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {adminAutomacoes.map((a) => (
            <AutomacaoCard key={a.id} automacao={a} />
          ))}
        </div>
      </section>

      {/* Automações de Vendas */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-purple-500/10">
              <Zap className="size-3 text-purple-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Automações da Equipe de Vendas</h3>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Vendas</Badge>
          </div>
          <p className="pl-7 text-xs text-muted-foreground">
            Lembretes e alertas que ajudam o time comercial a nunca perder um follow-up ou oportunidade.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {vendasAutomacoes.map((a) => (
            <AutomacaoCard key={a.id} automacao={a} />
          ))}
        </div>
      </section>
    </div>
  )
}
