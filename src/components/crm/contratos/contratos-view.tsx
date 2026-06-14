import { FileText } from 'lucide-react'

export function ContratosView() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <FileText className="size-7" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-[-0.01em]">Gerador de contratos em retrabalho</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Estamos reconstruindo o gerador de contratos para ser white-label: com a sua marca, os seus
        modelos e os seus dados. Em breve por aqui.
      </p>
      <span className="mt-5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
        Em breve
      </span>
    </div>
  )
}
