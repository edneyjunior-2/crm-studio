'use client'

import { useState } from 'react'
import {
  HelpCircle, CheckCircle2, Zap, Timer,
  MessageCircle, Banknote, BarChart3, FileWarning, ShieldAlert,
  Hammer,
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
  status: 'ativa' | 'em_construcao'
  frequencia?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  descricao_leiga: string
  dependencias: string[]
  casos_de_uso: string[]
}

const AUTOMACOES: Automacao[] = [
  // ── VENDAS ───────────────────────────────────────────────────────────────
  {
    id: 'cadencia-followup-whatsapp',
    nome: 'Cadência de Follow-up via WhatsApp',
    subtitulo: 'Avisa o vendedor quando um negócio fica dias parado sem atividade',
    categoria: 'vendas',
    status: 'em_construcao',
    frequencia: 'Todo dia — varredura de negócios parados',
    icon: MessageCircle,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-500/10',
    descricao_leiga:
      'Se um negócio no pipeline ficar X dias sem nenhuma atividade registrada, o sistema manda uma mensagem WhatsApp direto para o vendedor responsável: qual cliente, qual valor está em jogo, quando foi o último contato e um link para abrir o negócio no CRM. Nenhum cliente é esquecido no meio do funil.',
    dependencias: ['Evolution API (WhatsApp)'],
    casos_de_uso: [
      'Um vendedor esqueceu de dar follow-up em uma proposta enviada há 4 dias',
      'Um cliente está esperando retorno e ninguém percebeu',
      'Garantir que nenhum negócio fique parado mais de 5 dias em qualquer etapa',
    ],
  },

  // ── ADMIN ────────────────────────────────────────────────────────────────
  {
    id: 'cobranca-ao-fechar-negocio',
    nome: 'Cobrança Automática ao Fechar Negócio',
    subtitulo: 'Cria a conta a receber e envia o boleto/PIX ao cliente quando o negócio fecha',
    categoria: 'admin',
    status: 'em_construcao',
    frequencia: 'Instantâneo — acionado ao mover negócio para "Fechado Ganho"',
    icon: Banknote,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-500/10',
    descricao_leiga:
      'No momento em que um negócio é marcado como "Fechado Ganho", o sistema cria automaticamente a conta a receber no financeiro e envia um e-mail para o cliente com o boleto ou link de pagamento. O representante fecha o negócio e o cliente já recebe a cobrança — sem ninguém precisar tocar em nada.',
    dependencias: ['Asaas (cobrança)', 'Resend (e-mail)'],
    casos_de_uso: [
      'Eliminar o passo manual de criar a cobrança depois de fechar a venda',
      'Garantir que o cliente receba a cobrança no mesmo dia do fechamento',
      'Manter o financeiro sempre em sincronia com o pipeline de vendas',
    ],
  },
  {
    id: 'relatorio-comissoes-whatsapp',
    nome: 'Relatório de Comissões por WhatsApp',
    subtitulo: 'Envia para cada vendedor o resultado individual da semana todo domingo',
    categoria: 'admin',
    status: 'em_construcao',
    frequencia: 'Todo domingo às 18h',
    icon: BarChart3,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-500/10',
    descricao_leiga:
      'Todo domingo, cada membro da equipe recebe no WhatsApp um resumo personalizado da semana: negócios fechados, valor total, comissões estimadas e o cliente destaque. O time chega na segunda já sabendo onde estão e o que precisam bater.',
    dependencias: ['Evolution API (WhatsApp)'],
    casos_de_uso: [
      'Criar senso de urgência no time sem o gestor precisar fazer reunião toda semana',
      'Dar transparência individual sobre comissões sem planilha manual',
      'Celebrar resultados e manter o engajamento do comercial',
    ],
  },
  {
    id: 'alerta-contrato-vencendo',
    nome: 'Alerta de Contrato Vencendo + PDF de Renovação',
    subtitulo: 'Envia ao representante um PDF pronto para renovar contratos próximos do vencimento',
    categoria: 'admin',
    status: 'em_construcao',
    frequencia: '30, 15 e 7 dias antes do vencimento',
    icon: FileWarning,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-500/10',
    descricao_leiga:
      'Com 30, 15 e 7 dias de antecedência, o sistema gera um PDF com os termos do contrato atual pré-preenchidos para renovação e envia por e-mail ao representante responsável — não para o cliente. Ele chega na reunião com o documento pronto.',
    dependencias: ['Resend (e-mail)', 'Supabase Storage (PDF)'],
    casos_de_uso: [
      'Nunca perder um contrato por esquecimento de renovação',
      'Chegar na reunião com o cliente já com a proposta de renovação em mãos',
      'Ter visibilidade antecipada de quais contratos precisam de atenção',
    ],
  },
  {
    id: 'inadimplencia-automatica',
    nome: 'Sinalização Automática de Inadimplência',
    subtitulo: 'Marca clientes com conta vencida e alerta o responsável no WhatsApp',
    categoria: 'admin',
    status: 'em_construcao',
    frequencia: 'Instantâneo — acionado quando uma conta passa do prazo',
    icon: ShieldAlert,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-500/10',
    descricao_leiga:
      'Quando um cliente passa a ter conta a receber em atraso, o sistema sinaliza automaticamente todos os negócios ativos desse cliente com um indicador vermelho no pipeline e manda WhatsApp para o responsável. Quando o pagamento é recebido, o indicador some sozinho.',
    dependencias: ['Evolution API (WhatsApp)'],
    casos_de_uso: [
      'Saber imediatamente quando um cliente importante está em atraso',
      'Evitar avançar negócios de clientes que ainda têm dívida pendente',
      'Ter o pipeline sempre refletindo a saúde financeira de cada cliente',
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
          !isAtiva && 'opacity-70'
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
              <Badge className="border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-700">
                <Hammer className="mr-1 size-2.5" />
                Em construção
              </Badge>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{automacao.subtitulo}</p>

          {automacao.frequencia && (
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
                Casos de uso
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

            <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-amber-300/60 bg-amber-50/50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                Dependências para construir
              </p>
              <ul className="flex flex-col gap-1">
                {automacao.dependencias.map((dep, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-amber-700/80">
                    <span className="size-1 rounded-full bg-amber-500 shrink-0" />
                    {dep}
                  </li>
                ))}
              </ul>
            </div>
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
            Processos que o sistema executa automaticamente — sem intervenção manual.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shrink-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Zap className="size-3.5 text-amber-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            {ativas > 0 ? (
              <>
                <p className="text-xs text-muted-foreground">Rodando agora</p>
                <p className="text-sm font-semibold text-foreground">{ativas} de {AUTOMACOES.length}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Em breve</p>
                <p className="text-sm font-semibold text-foreground">Em construção</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Automações de Vendas */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-emerald-500/10">
              <Zap className="size-3 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Automações de Vendas</h3>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Comercial</Badge>
          </div>
          <p className="pl-7 text-xs text-muted-foreground">
            Lembretes e alertas que ajudam o time comercial a nunca perder um follow-up.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {vendasAutomacoes.map((a) => (
            <AutomacaoCard key={a.id} automacao={a} />
          ))}
        </div>
      </section>

      {/* Automações do Sistema */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-blue-500/10">
              <Zap className="size-3 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Automações do Sistema</h3>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Admin</Badge>
          </div>
          <p className="pl-7 text-xs text-muted-foreground">
            Processos que ligam financeiro, contratos e clientes sem intervenção manual.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {adminAutomacoes.map((a) => (
            <AutomacaoCard key={a.id} automacao={a} />
          ))}
        </div>
      </section>
    </div>
  )
}
