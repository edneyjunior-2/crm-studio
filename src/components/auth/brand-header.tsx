/**
 * Cabeçalho de marca compartilhado pelas telas de auth (esqueci-senha,
 * reset-password). White-label CRM Studio — sem resíduos da marca antiga.
 */
export function AuthBrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="mb-10 text-center">
      <span className="font-logo text-3xl font-extrabold tracking-[-0.03em] text-foreground">
        CRM Studio<span className="text-accent">.</span>
      </span>
      {subtitle && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      )}
      <div className="mx-auto mt-4 h-px w-16 bg-accent/60" />
    </div>
  )
}
