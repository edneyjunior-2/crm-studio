import { Megaphone, ExternalLink } from 'lucide-react'
import { getAuthPlatformAdmin } from '@/lib/auth'
import { AdsDashboard } from '@/components/admin/ads-dashboard'

export default async function AdsAdminPage() {
  await getAuthPlatformAdmin()

  // URL de embed do relatório Looker Studio (Google Ads da conta 415-374-1078).
  // Não é segredo (é um embed restrito à conta Google do platform-admin); fica
  // cravada como padrão pra funcionar sem env na Vercel. NEXT_PUBLIC_LOOKER_ADS_URL
  // sobrepõe se trocar de relatório.
  const lookerUrl =
    process.env.NEXT_PUBLIC_LOOKER_ADS_URL ??
    'https://lookerstudio.google.com/embed/reporting/3c681c36-07d0-4ada-b0dd-fa44029a4b11/page/qRI3F'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ads — Campanhas Google Ads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas da campanha de Google Ads do CRM Studio · painel Looker Studio
        </p>
      </div>

      {lookerUrl ? (
        <AdsDashboard src={lookerUrl} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Configure o painel de Ads</h2>
          </div>
          <ol className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>1. Crie um relatório no Looker Studio conectando sua conta Google Ads.</li>
            <li>
              2. Em <strong className="font-medium text-foreground">Compartilhar → Incorporar relatório</strong>,
              copie a URL de embed.
            </li>
            <li>
              3. Defina a variável{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                NEXT_PUBLIC_LOOKER_ADS_URL
              </code>{' '}
              nas variáveis de ambiente da Vercel.
            </li>
          </ol>
          <a
            href="https://lookerstudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Abrir lookerstudio.google.com
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}
    </div>
  )
}
