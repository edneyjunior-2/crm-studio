'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, CalendarDays, Loader2, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface GoogleCalendarConnectProps {
  isConnected: boolean
}

export function GoogleCalendarConnect({ isConnected }: GoogleCalendarConnectProps) {
  const [connected, setConnected] = useState(isConnected)
  const [isConnecting, startConnectTransition] = useTransition()
  const [isDisconnecting, startDisconnectTransition] = useTransition()

  function handleConnect() {
    startConnectTransition(async () => {
      try {
        const res = await fetch('/api/google/auth-url')
        if (!res.ok) {
          toast.error('Erro ao iniciar conexão com o Google.')
          return
        }
        const { url } = await res.json()
        window.location.href = url
      } catch {
        toast.error('Erro ao iniciar conexão com o Google.')
      }
    })
  }

  function handleDisconnect() {
    startDisconnectTransition(async () => {
      try {
        const res = await fetch('/api/google/disconnect', { method: 'POST' })
        if (!res.ok) {
          toast.error('Erro ao desconectar o Google Calendar.')
          return
        }
        setConnected(false)
        toast.success('Google Calendar desconectado com sucesso.')
      } catch {
        toast.error('Erro ao desconectar o Google Calendar.')
      }
    })
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        {/* Ícone do Google Calendar */}
        <div className={`flex size-10 items-center justify-center rounded-lg ${connected ? 'bg-emerald-50 border border-emerald-200' : 'bg-muted'}`}>
          <CalendarDays className={`size-5 ${connected ? 'text-emerald-600' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Google Calendar</p>
          {connected ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <p className="text-xs text-emerald-700 font-medium">Conectado</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie eventos no seu calendário ao registrar reuniões
            </p>
          )}
        </div>
      </div>

      {connected ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              >
                {isDisconnecting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unlink className="size-3.5" />
                )}
                Desconectar
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desconectar Google Calendar</AlertDialogTitle>
              <AlertDialogDescription>
                Ao desconectar, novas reuniões não serão mais adicionadas ao seu Google Calendar.
                Eventos já criados permanecem no seu calendário.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDisconnect}>
                Desconectar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          size="sm"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Aguarde...
            </>
          ) : (
            <>
              <CalendarDays className="size-3.5" />
              Conectar Google Calendar
            </>
          )}
        </Button>
      )}
    </div>
  )
}
