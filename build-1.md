Clean. Let me summarize the fix.

## Root cause

Migration `supabase/migrations/20260703130000_protege_billing_empresas.sql` (2026-07-03) intentionally **revoked `UPDATE` on `public.empresas` from the `authenticated` role** to close a billing-escalation vulnerability (an admin could PATCH `modulos_ativos`/`trial_ends_at`/`valor_mensalidade` directly via PostgREST since the old RLS `WITH CHECK` only pinned `plano`/`status`).

The fix's intended pattern: all legitimate writes to `empresas` go through `createAdminClient()` (service-role, bypasses RLS/grants), scoped by `empresaId` from `getAuthAdmin()`. That pattern was already applied to `salvarTimbrado`/`removerTimbrado` and the `(admin)/admin/empresas` actions — but three functions in `src/app/(crm)/configuracoes/actions.ts` were missed and kept using the RLS-bound `supabase` client:

- `salvarDadosEmpresa` — saves razão social / **nome fantasia** / CNPJ (this is the exact bug reported)
- `salvarEncarregado` — saves DPO/encarregado contact info
- `toggleModuloVisibilidade` — reads/writes `modulos_ocultos`

All three hit `permission denied for table empresas` after the security migration landed, since it wasn't just a missing RLS policy — the table-level `GRANT` itself was revoked by design, and these call sites weren't updated to use the service-role client.

## Fix

Switched all three to `createAdminClient()` for the `empresas` reads/writes, keeping the existing `empresaId` tenant scoping (from `getAuthAdmin()`) intact — same pattern as the already-correct `salvarTimbrado`. No RLS/GRANT changes were made, since re-granting `UPDATE` to `authenticated` would reopen the billing-escalation hole the prior migration closed. Only these safe, non-billing columns are affected (`razao_social`, `nome_fantasia`, `cnpj`, `encarregado_*`, `modulos_ocultos`).

`tsc --noEmit` and `eslint` on the file are clean.
