'use client'

import { useActionState } from 'react'
import { Building2, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { entrarNaEmpresa, type EntrarNaEmpresaState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: EntrarNaEmpresaState = { step: 'idle' }

export function EntrarEmpresaForm() {
  const [state, action, pending] = useActionState(entrarNaEmpresa, initialState)

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      {/* Passo 1 — digitar o código */}
      {(state.step === 'idle') && (
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="codigo">Código de acesso</Label>
            <Input
              id="codigo"
              name="codigo"
              type="text"
              placeholder="EX: SAT-4821"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={10}
              required
              className="font-mono tracking-widest uppercase"
            />
          </div>

          {state.error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <Button type="submit" className="mt-1 w-full" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Buscar empresa
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      )}

      {/* Passo 2 — confirmar a empresa */}
      {state.step === 'preview' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/40 px-5 py-5 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
              <Building2 className="size-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Empresa encontrada</p>
              <p className="mt-0.5 text-lg font-semibold text-foreground">{state.empresaNome}</p>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Confirme que você pertence a esta empresa para ter acesso ao CRM.
          </p>

          <form action={action} className="flex flex-col gap-2">
            <input type="hidden" name="_step" value="confirmar" />
            <input type="hidden" name="empresa_id" value={state.empresaId} />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Confirmar entrada
                </>
              )}
            </Button>
          </form>

          <form action={action}>
            <button
              type="submit"
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline transition-colors"
            >
              Usar outro código
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
