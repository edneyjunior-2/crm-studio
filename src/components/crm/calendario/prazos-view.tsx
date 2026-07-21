'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlarmClock,
  AlertTriangle,
  Check,
  CheckCircle2,
  Gavel,
  LayoutGrid,
  MapPin,
  ArrowUpRight,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MembroInterno } from '@/app/(crm)/calendario/page'
import type { PrazoCalendario, AudienciaCalendario } from '@/lib/processos-prazos-calendario'
import { AgendarAudienciaDialog } from '@/app/(crm)/processos/[id]/agendar-audiencia-dialog'
import { PrazosMesGrid, type PrazoGrid } from '@/components/crm/calendario/prazos-mes-grid'
import {
  atualizarPrazoCalendario,
  excluirPrazoCalendario,
  marcarPrazoCalendarioCumprido,
} from '@/app/(crm)/calendario/prazos-actions'

// data `date` ('YYYY-MM-DD'): parse por componentes, nunca `new Date()` cru
// (interpretaria como UTC e poderia recuar um dia em BRT). Mesmo padrão de
// processos/[id]/page.tsx e processos/prazos-a-vencer.tsx.
function formatarData(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return data
  return `${dia}/${mes}/${ano}`
}

function hojeStr(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

// Dialog de edição compartilhado entre a lista (botão de lápis) e o grid de
// mês (clique num prazo) — um único form, sem duplicar (pedido explícito da spec).
function EditarPrazoDialog({
  prazo,
  onClose,
  onSalvar,
  isPending,
}: {
  prazo: PrazoCalendario | null
  onClose: () => void
  onSalvar: (descricao: string, dataPrazo: string) => void
  isPending: boolean
}) {
  const [descricao, setDescricao] = useState('')
  const [dataPrazo, setDataPrazo] = useState('')

  useEffect(() => {
    if (prazo) {
      setDescricao(prazo.descricao)
      setDataPrazo(prazo.data_prazo.slice(0, 10))
    }
  }, [prazo])

  return (
    <Dialog open={!!prazo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar prazo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prazo-calendario-descricao">Descrição</Label>
            <Input
              id="prazo-calendario-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Prazo para contestação"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prazo-calendario-data">Data fatal</Label>
            <Input
              id="prazo-calendario-data"
              type="date"
              value={dataPrazo}
              onChange={(e) => setDataPrazo(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => onSalvar(descricao, dataPrazo)}
            disabled={isPending || !descricao.trim() || !dataPrazo}
          >
            {isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface PrazosViewProps {
  prazos: PrazoCalendario[]
  audiencias: AudienciaCalendario[]
  membrosInternos: MembroInterno[]
  currentUserEmail: string
  isAdmin: boolean
}

export function PrazosView({
  prazos: prazosIniciais,
  audiencias,
  membrosInternos,
  currentUserEmail,
  isAdmin,
}: PrazosViewProps) {
  const [prazos, setPrazos] = useState(prazosIniciais)
  const [prazoEditando, setPrazoEditando] = useState<PrazoCalendario | null>(null)
  const [saving, startSave] = useTransition()
  const [toggling, startToggle] = useTransition()
  const [deleting, startDelete] = useTransition()

  const hoje = hojeStr()
  // Nome do usuário logado (via e-mail) — só para destacar "Você" nos prazos
  // sob sua responsabilidade; processos_prazos guarda responsavel_nome, não e-mail.
  const meuNome = membrosInternos.find((m) => m.email === currentUserEmail)?.nome ?? null

  const pendentes = prazos.filter((p) => !p.cumprido)
  const cumpridos = prazos.filter((p) => p.cumprido)

  function handleToggle(prazo: PrazoCalendario) {
    startToggle(async () => {
      const res = await marcarPrazoCalendarioCumprido(prazo.id, !prazo.cumprido)
      if (res.error) { toast.error(res.error); return }
      setPrazos((prev) => prev.map((p) => (p.id === prazo.id ? { ...p, cumprido: !prazo.cumprido } : p)))
      toast.success(prazo.cumprido ? 'Prazo marcado como pendente.' : 'Prazo marcado como cumprido.')
    })
  }

  function handleExcluir(prazo: PrazoCalendario) {
    if (!confirm('Excluir este prazo?')) return
    startDelete(async () => {
      const res = await excluirPrazoCalendario(prazo.id)
      if (res.error) { toast.error(res.error); return }
      setPrazos((prev) => prev.filter((p) => p.id !== prazo.id))
      toast.success('Prazo excluído.')
    })
  }

  function handleSalvarEdicao(descricao: string, dataPrazo: string) {
    if (!prazoEditando) return
    const id = prazoEditando.id
    startSave(async () => {
      const res = await atualizarPrazoCalendario(id, descricao, dataPrazo)
      if (res.error) { toast.error(res.error); return }
      setPrazos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, descricao: descricao.trim(), data_prazo: dataPrazo } : p)),
      )
      toast.success('Prazo atualizado.')
      setPrazoEditando(null)
    })
  }

  function handleSelecionarDoGrid(prazoGrid: PrazoGrid) {
    const prazo = prazos.find((p) => p.id === prazoGrid.id)
    if (prazo) setPrazoEditando(prazo)
  }

  const prazosGrid: PrazoGrid[] = prazos.map((p) => ({
    id: p.id,
    processoId: p.processo_id,
    numeroProcesso: p.numero_processo,
    descricao: p.descricao,
    cumprido: p.cumprido,
    dataPrazo: p.data_prazo,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Seção Prazos */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <AlarmClock className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Prazos</h2>
            <span className="ml-auto text-xs text-muted-foreground">{prazos.length} no total</span>
          </div>

          {prazos.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum prazo cadastrado.</p>
              <Link href="/processos" className="text-xs text-primary underline-offset-2 hover:underline">
                Ver processos
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {pendentes.map((p) => {
                const vencido = p.data_prazo < hoje
                const isMeu = meuNome !== null && p.responsavel_nome === meuNome
                return (
                  <li
                    key={p.id}
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm',
                      vencido
                        ? 'border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/10'
                        : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/10',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(p)}
                      disabled={toggling}
                      title="Marcar como cumprido"
                      className="flex size-4 shrink-0 items-center justify-center rounded border border-border bg-background transition-colors hover:border-foreground/40 disabled:opacity-40"
                    />
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none',
                        vencido
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
                      )}
                    >
                      {vencido ? 'Vencido' : 'A vencer'}
                    </span>
                    <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                      {formatarData(p.data_prazo)}
                    </span>
                    <span className={cn('flex-1 truncate', vencido ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>
                      {p.descricao}
                    </span>
                    <Link
                      href={`/processos/${p.processo_id}`}
                      className="shrink-0 font-mono text-xs text-primary underline-offset-2 hover:underline"
                    >
                      {p.numero_processo}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {isMeu ? 'Você' : p.responsavel_nome ?? '—'}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPrazoEditando(p)}
                        title="Editar prazo"
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleExcluir(p)}
                          disabled={deleting}
                          title="Excluir prazo"
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}

              {cumpridos.length > 0 && (
                <>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    Cumpridos ({cumpridos.length})
                  </p>
                  {cumpridos.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm opacity-60"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggle(p)}
                        disabled={toggling}
                        title="Marcar como pendente"
                        className="flex size-4 shrink-0 items-center justify-center rounded border border-emerald-500 bg-emerald-500 text-white transition-colors disabled:opacity-40"
                      >
                        <Check className="size-2.5" />
                      </button>
                      <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                        {formatarData(p.data_prazo)}
                      </span>
                      <span className="flex-1 truncate text-muted-foreground line-through">{p.descricao}</span>
                      <Link
                        href={`/processos/${p.processo_id}`}
                        className="shrink-0 font-mono text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {p.numero_processo}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.responsavel_nome ?? '—'}</span>
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPrazoEditando(p)}
                          title="Editar prazo"
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleExcluir(p)}
                            disabled={deleting}
                            title="Excluir prazo"
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}

          {pendentes.some((p) => p.data_prazo < hoje) && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              Há prazos vencidos exigindo atenção imediata.
            </p>
          )}
        </section>

        {/* Seção Audiências */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Gavel className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Audiências</h2>
            <span className="ml-auto text-xs text-muted-foreground">{audiencias.length} no total</span>
          </div>

          {audiencias.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma audiência encontrada.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {audiencias.map((a) => {
                const local = [a.vara, a.comarca].filter(Boolean).join(' — ')
                return (
                  <li
                    key={a.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-xs text-muted-foreground">{formatarData(a.data)}</span>
                        <span className="truncate text-foreground">{a.descricao}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <Link
                          href={`/processos/${a.processo_id}`}
                          className="inline-flex items-center gap-1 font-mono text-primary underline-offset-2 hover:underline"
                        >
                          {a.numero_processo}
                          <ArrowUpRight className="size-3" />
                        </Link>
                        {a.cliente_nome && <span>· {a.cliente_nome}</span>}
                        {local && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3 shrink-0" />
                            {local}
                          </span>
                        )}
                        {a.complemento && <span className="truncate">· {a.complemento}</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground">Enviar para o calendário</span>
                      <AgendarAudienciaDialog
                        descricao={a.descricao}
                        dataSugerida={a.data}
                        processoNumero={a.numero_processo}
                        vara={a.vara}
                        comarca={a.comarca}
                        clienteNome={a.cliente_nome}
                        areaLabel={null}
                        advogadoEmail={a.advogado_email}
                        membros={membrosInternos}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Calendário visual (grid de mês) — só prazos, sem audiências/eventos do Google */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Calendário de prazos</h2>
        </div>
        <PrazosMesGrid prazos={prazosGrid} onSelecionarPrazo={handleSelecionarDoGrid} />
      </section>

      <EditarPrazoDialog
        prazo={prazoEditando}
        onClose={() => setPrazoEditando(null)}
        onSalvar={handleSalvarEdicao}
        isPending={saving}
      />
    </div>
  )
}
