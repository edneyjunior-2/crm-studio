import { getAuthPlatformAdmin } from '@/lib/auth'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NovaEmpresaForm } from './nova-empresa-form'

export default async function NovaEmpresaPage() {
  await getAuthPlatformAdmin()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/empresas"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova empresa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cria a empresa e o primeiro usuário admin. Um e-mail de acesso é enviado automaticamente.
        </p>
      </div>

      <NovaEmpresaForm />
    </div>
  )
}
