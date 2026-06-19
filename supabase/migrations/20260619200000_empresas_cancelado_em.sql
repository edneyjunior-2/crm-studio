-- =============================================================================
-- Retenção de dados pós-cancelamento (soft-delete).
--
-- Quando o cliente exclui (cancela) a conta, mantemos os dados por ~90 dias
-- (retenção informada ao cliente no ato). Este timestamp marca QUANDO o
-- cancelamento ocorreu, para uma futura rotina de purga após o período.
-- =============================================================================

alter table public.empresas
  add column if not exists cancelado_em timestamptz;

comment on column public.empresas.cancelado_em is
  'Quando a conta foi cancelada (soft-delete). Retenção de ~90 dias antes de eventual purga definitiva.';

notify pgrst, 'reload schema';
