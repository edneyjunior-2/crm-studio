/**
 * URL ABSOLUTA do app (app.crmstudio.com.br), robusta contra
 * NEXT_PUBLIC_SITE_URL vazio/ausente.
 *
 * Em produção essa env vem como STRING VAZIA. `'' ?? fallback` retorna `''`
 * (o `??` só cai no fallback com null/undefined), o que quebrava os `redirectTo`
 * de auth (recovery/invite/reset): viravam `/reset-password` sem origin → o
 * Supabase rejeitava o link e o usuário ficava sem como definir a senha.
 *
 * Use isto em TODO `redirectTo` de link de auth e em links de e-mail do app.
 */
export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
  return raw && (raw.startsWith('https://') || raw.startsWith('http://localhost'))
    ? raw
    : 'https://app.crmstudio.com.br'
}
