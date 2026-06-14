import Link from 'next/link'

const COLS = [
  {
    title: 'Produto',
    links: [
      { href: '/produto', label: 'Como funciona' },
      { href: '/precos', label: 'Preços' },
      { href: '/login', label: 'Entrar' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { href: '/contato', label: 'Falar com vendas' },
      { href: '/contato', label: 'Agendar demo' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-[1180px] px-6 py-14 sm:px-8">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs">
            <span className="font-logo text-lg font-extrabold tracking-[-0.03em] text-foreground">
              CRM Studio<span className="text-accent">.</span>
            </span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Vendas, financeiro e equipe num só lugar. Feito no Brasil para quem vende.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {COLS.map((col) => (
              <div key={col.title}>
                <h3 className="text-xs font-semibold tracking-wide text-foreground">{col.title}</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>© 2026 CRM Studio</span>
          <span>Dados hospedados com segurança, em conformidade com a LGPD.</span>
        </div>
      </div>
    </footer>
  )
}
