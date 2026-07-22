import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ImportarWizard } from './importar-wizard'

export default function ImportarPontoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/rh/ponto"
          className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-[family-name:var(--font-heading)]">
            Importar folha de ponto
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Suba o PDF do Cartão Ponto exportado do Secullum — nada é gravado antes de você conferir
          </p>
        </div>
      </div>

      <ImportarWizard />
    </div>
  )
}
