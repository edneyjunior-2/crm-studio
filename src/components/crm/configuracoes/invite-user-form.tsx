'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUser } from '@/app/(crm)/configuracoes/actions'

export function InviteUserForm() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('comercial')
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) setOpen(nextOpen)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const email = (data.get('email') as string).trim()
    const fullName = (data.get('full_name') as string).trim()

    if (!email || !fullName) return

    startTransition(async () => {
      const result = await createUser(email, role, fullName)

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.warning) {
        // Usuário criado mas o e-mail de convite falhou — admin precisa reenviar.
        toast.warning(result.warning)
      } else {
        toast.success(`Convite enviado para ${email}.`)
      }
      setOpen(false)
      form.reset()
      setRole('comercial')
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        Convidar Usuário
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-1">
            O usuário receberá um e-mail com link para definir a própria senha e acessar o CRM.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">
                Nome completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                name="full_name"
                required
                placeholder="Nome do usuário"
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="usuario@empresa.com"
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-acesso">Perfil de Acesso</Label>
              <Select value={role} onValueChange={(v) => { if (v) setRole(v) }} disabled={isPending}>
                <SelectTrigger id="role-acesso" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="socio">Sócio</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Enviando convite...' : 'Enviar convite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
