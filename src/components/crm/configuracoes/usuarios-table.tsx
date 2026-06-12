'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2, Users } from 'lucide-react'
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
import { updateUserRole, deleteUser } from '@/app/(crm)/configuracoes/actions'
import type { Role } from '@/types'

interface UsuarioRow {
  id: string
  full_name: string
  email: string
  role: Role
  created_at: string
}

interface UsuariosTableProps {
  usuarios: UsuarioRow[]
  currentUserId: string
}

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
}

function UserAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase()
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {initial}
    </div>
  )
}

function RoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string
  currentRole: Role
  disabled: boolean
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
        <SelectItem value="admin">Administrador</SelectItem>
        <SelectItem value="socio">Sócio</SelectItem>
        <SelectItem value="comercial">Comercial</SelectItem>
      </SelectContent>
    </Select>
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

export function UsuariosTable({ usuarios, currentUserId }: UsuariosTableProps) {
  if (usuarios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <Users className="mb-3 size-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">
          Nenhum usuário cadastrado.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Clique em "Convidar Usuário" para adicionar alguém.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Alterar perfil</TableHead>
            <TableHead className="w-16 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => {
            const isSelf = u.id === currentUserId
            const badge = roleBadge[u.role]

            return (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar name={u.full_name} />
                    <span className="font-medium">
                      {u.full_name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          (você)
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={badge.className}
                  >
                    {badge.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RoleSelect
                    userId={u.id}
                    currentRole={u.role}
                    disabled={isSelf}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
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
  )
}
