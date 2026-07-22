'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2, Users, Send, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  updateUserRole,
  deleteUser,
  updateUserCargo,
  salvarModulosUsuario,
  reenviarConvite,
  updateUserNome,
  renomearPapel,
  atualizarPermissaoPapel,
} from '@/app/(crm)/configuracoes/actions'
import type { Role, Papel } from '@/types'

interface UsuarioRow {
  id: string
  full_name: string
  email: string
  role: Role
  cargo?: string | null
  modulos_permitidos?: string[] | null
  created_at: string
  pendente?: boolean
}

const CARGOS_SUGERIDOS = [
  'Advogado',
  'Advogado Sênior',
  'Advogado Pleno',
  'Advogado Júnior',
  'Sócio',
  'Sócio-fundador',
  'Estagiário',
  'Paralegal',
  'Analista Jurídico',
  'Secretário(a)',
  'Gerente Administrativo',
  'Financeiro',
]

interface UsuariosTableProps {
  usuarios: UsuarioRow[]
  currentUserId: string
  /** Módulos que a empresa tem (slug + label) — opções de acesso por usuário. */
  modulosEmpresa: { slug: string; label: string }[]
  /** Papéis customizáveis da empresa (Fase 1 — spec papeis-customizaveis-01-fundacao.md). */
  papeis: Papel[]
}

/** Ordem fixa de exibição — âncora é role_sistema, nunca o nome (editável). */
const ROLE_ORDER: Record<Role, number> = { admin: 0, socio: 1, comercial: 2, parceiro: 3 }

const roleBadge: Record<Role, { label: string; className: string }> = {
  admin: {
    label: 'Administrador',
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  },
  socio: {
    label: 'Sócio',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  },
  comercial: {
    label: 'Comercial',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  parceiro: {
    label: 'Parceiro',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  },
}

function UserAvatar({ name }: { name: string }) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase()
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {initial}
    </div>
  )
}

function StatusBadge({ pendente }: { pendente: boolean }) {
  if (pendente) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-400">
        Pendente
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-700/50 dark:bg-green-900/20 dark:text-green-400">
      Ativo
    </span>
  )
}

function NomeInput({ userId, nome: nomeProp }: { userId: string; nome: string }) {
  const [valor, setValor] = useState(nomeProp ?? '')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  async function handleBlur() {
    const trimmed = valor.trim()
    if (trimmed === (nomeProp ?? '').trim() || !trimmed) {
      // Reverter se em branco
      if (!trimmed) setValor(nomeProp ?? '')
      return
    }
    setSalvando(true)
    const result = await updateUserNome(userId, trimmed)
    setSalvando(false)
    if (result.error) {
      toast.error(result.error)
      setValor(nomeProp ?? '')
    } else {
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2000)
    }
  }

  return (
    <div className="relative">
      <input
        value={valor}
        onChange={(e) => { setValor(e.target.value); setSalvo(false) }}
        onBlur={handleBlur}
        placeholder="Nome completo"
        className="h-8 w-44 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40"
      />
      {salvando && <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">salvando…</span>}
      {salvo    && <span className="absolute right-2 top-1.5 text-[10px] text-chart-5">✓</span>}
    </div>
  )
}

function RoleSelect({
  userId,
  currentRole,
  disabled,
  nomePorRole,
}: {
  userId: string
  currentRole: Role
  disabled: boolean
  nomePorRole: Partial<Record<Role, string>>
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(newRole: string | null) {
    if (!newRole) return
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Perfil atualizado com sucesso.')
    })
  }

  return (
    <Select
      defaultValue={currentRole}
      onValueChange={handleChange}
      disabled={disabled || isPending}
    >
      <SelectTrigger size="sm" className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROLE_ORDER) as Role[]).map((r) => (
          <SelectItem key={r} value={r}>{nomePorRole[r] ?? roleBadge[r].label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CargoInput({ userId, cargo }: { userId: string; cargo?: string | null }) {
  const [valor, setValor] = useState(cargo ?? '')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  async function handleBlur() {
    if (valor === (cargo ?? '')) return
    setSalvando(true)
    await updateUserCargo(userId, valor)
    setSalvando(false)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <div className="relative">
      <input
        list={`cargos-${userId}`}
        value={valor}
        onChange={(e) => { setValor(e.target.value); setSalvo(false) }}
        onBlur={handleBlur}
        placeholder="Ex: Advogado, Estagiário…"
        className="h-8 w-44 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-foreground/40"
      />
      <datalist id={`cargos-${userId}`}>
        {CARGOS_SUGERIDOS.map((c) => <option key={c} value={c} />)}
      </datalist>
      {salvando && <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">salvando…</span>}
      {salvo    && <span className="absolute right-2 top-1.5 text-[10px] text-chart-5">✓</span>}
    </div>
  )
}

function ReenviarConviteButton({ userId, email }: { userId: string; email: string }) {
  const [isPending, startTransition] = useTransition()

  function handleReenviar() {
    startTransition(async () => {
      const result = await reenviarConvite(userId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Convite reenviado para ${email}.`)
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-foreground"
      disabled={isPending}
      onClick={handleReenviar}
      title="Reenviar convite"
    >
      <Send className="size-3.5" />
      <span className="sr-only">Reenviar convite</span>
    </Button>
  )
}

function DeleteButton({
  userId,
  userName,
  disabled,
}: {
  userId: string
  userName: string
  disabled: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteUser(userId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Usuário "${userName}" excluído com sucesso.`)
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={disabled || isPending}
          />
        }
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Excluir</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <strong>{userName}</strong>? O
            acesso será revogado imediatamente e esta ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AcessoModulos({
  userId,
  role,
  modulosEmpresa,
  modulosPermitidos,
}: {
  userId: string
  role: Role
  modulosEmpresa: { slug: string; label: string }[]
  modulosPermitidos: string[] | null
}) {
  const [perms, setPerms] = useState<string[] | null>(modulosPermitidos ?? null)
  const [isPending, startTransition] = useTransition()

  // Admin é sempre full — não editável.
  if (role === 'admin') {
    return (
      <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
        Acesso total
      </Badge>
    )
  }

  function persist(novo: string[] | null) {
    const anterior = perms
    setPerms(novo)
    startTransition(async () => {
      const r = await salvarModulosUsuario(userId, novo)
      if (r.error) { toast.error(r.error); setPerms(anterior) }
    })
  }

  const semRestricao = perms == null
  const base = perms ?? modulosEmpresa.map((m) => m.slug)
  const resumo = semRestricao ? 'Todos os menus' : `${perms!.length}/${modulosEmpresa.length} menus`

  return (
    <details className="group w-52">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm marker:hidden">
        <span className={semRestricao ? 'text-muted-foreground' : 'font-medium'}>{resumo}</span>
        <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5 shadow-sm">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={semRestricao}
            disabled={isPending}
            onChange={(e) => persist(e.target.checked ? null : modulosEmpresa.map((m) => m.slug))}
          />
          Sem restrição (vê tudo)
        </label>
        {!semRestricao && (
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto border-t border-border pt-1.5">
            {modulosEmpresa.map((m) => (
              <label key={m.slug} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={base.includes(m.slug)}
                  disabled={isPending}
                  onChange={(e) =>
                    persist(e.target.checked ? [...new Set([...base, m.slug])] : base.filter((s) => s !== m.slug))
                  }
                />
                {m.label}
              </label>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

function PapelNomeInput({ papel }: { papel: Papel }) {
  const [valor, setValor] = useState(papel.nome)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function handleBlur() {
    setEditando(false)
    const trimmed = valor.trim()
    if (!trimmed || trimmed === papel.nome) {
      setValor(papel.nome)
      return
    }
    setSalvando(true)
    const result = await renomearPapel(papel.id, trimmed)
    setSalvando(false)
    if (result.error) {
      toast.error(result.error)
      setValor(papel.nome)
    } else {
      toast.success('Nome do perfil atualizado.')
    }
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        disabled={salvando}
        className="group flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:border-foreground/40"
      >
        {valor}
        <Pencil className="size-3 text-muted-foreground group-hover:text-foreground" />
      </button>
    )
  }

  return (
    <input
      autoFocus
      value={valor}
      disabled={salvando}
      maxLength={60}
      onChange={(e) => setValor(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="h-7 w-32 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-foreground/40"
    />
  )
}

/** Permissão fina por papel (Fase 2 — spec papeis-customizaveis-02-permissao-
 *  pipeline.md). Só aparece pro papel Comercial: admin/sócio já veem tudo,
 *  parceiro tem portal/RLS própria (fora de escopo desta permissão). */
function PapelPermissaoPipeline({ papel }: { papel: Papel }) {
  const [ativo, setAtivo] = useState(!!papel.permissoes?.pipeline_visao_completa)
  const [salvando, setSalvando] = useState(false)

  async function handleChange(valor: boolean) {
    const anterior = ativo
    setAtivo(valor)
    setSalvando(true)
    const result = await atualizarPermissaoPapel(papel.id, 'pipeline_visao_completa', valor)
    setSalvando(false)
    if (result.error) {
      toast.error(result.error)
      setAtivo(anterior)
    } else {
      toast.success(valor ? 'Agora este perfil vê o pipeline completo.' : 'Este perfil voltou a ver só os próprios negócios.')
    }
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Switch size="sm" checked={ativo} disabled={salvando} onCheckedChange={handleChange} />
      Ver pipeline completo
    </label>
  )
}

/** Nomes dos 4 papéis de sistema, editáveis inline — renomeia só o rótulo
 *  exibido; a permissão continua vindo de profiles.role (ver renomearPapel). */
function PapeisNomes({ papeis }: { papeis: Papel[] }) {
  if (papeis.length === 0) return null
  const ordenados = [...papeis].sort((a, b) => ROLE_ORDER[a.role_sistema] - ROLE_ORDER[b.role_sistema])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">Nomes dos perfis:</span>
      {ordenados.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <PapelNomeInput papel={p} />
          {p.role_sistema === 'comercial' && <PapelPermissaoPipeline papel={p} />}
        </div>
      ))}
    </div>
  )
}

export function UsuariosTable({ usuarios, currentUserId, modulosEmpresa, papeis }: UsuariosTableProps) {
  const nomePorRole: Partial<Record<Role, string>> = Object.fromEntries(
    papeis.map((p) => [p.role_sistema, p.nome]),
  )

  if (usuarios.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PapeisNomes papeis={papeis} />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Users className="mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum usuário cadastrado.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Clique em "Convidar Usuário" para adicionar alguém.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PapeisNomes papeis={papeis} />
      <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Alterar perfil</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Acesso aos menus</TableHead>
            <TableHead className="w-20 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => {
            const isSelf = u.id === currentUserId
            const badge = roleBadge[u.role]
            const pendente = u.pendente ?? false

            return (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={u.full_name} />
                    <div className="flex flex-col gap-0.5">
                      <NomeInput userId={u.id} nome={u.full_name} />
                      {isSelf && (
                        <span className="text-xs text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge pendente={pendente} />
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={badge.className}
                  >
                    {nomePorRole[u.role] ?? badge.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RoleSelect
                    userId={u.id}
                    currentRole={u.role}
                    disabled={isSelf}
                    nomePorRole={nomePorRole}
                  />
                </TableCell>
                <TableCell>
                  <CargoInput userId={u.id} cargo={u.cargo} />
                </TableCell>
                <TableCell>
                  <AcessoModulos
                    userId={u.id}
                    role={u.role}
                    modulosEmpresa={modulosEmpresa}
                    modulosPermitidos={u.modulos_permitidos ?? null}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <ReenviarConviteButton userId={u.id} email={u.email} />
                    <DeleteButton
                      userId={u.id}
                      userName={u.full_name}
                      disabled={isSelf}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
