-- =============================================================================
-- Aviso prévio de purga: marca quando o dono já foi avisado de que uma conta
-- está perto do prazo de 90 dias (para não repetir o aviso todo dia).
-- Reativar a conta limpa o carimbo (trigger) → se cancelar de novo, avisa de novo.
-- =============================================================================

alter table public.empresas
  add column if not exists aviso_purga_enviado_em timestamptz;

comment on column public.empresas.aviso_purga_enviado_em is
  'Quando o dono foi avisado de que esta conta cancelada está perto da purga (1x por cancelamento).';

-- Estende o trigger: ao reativar (status<>cancelado) também zera o aviso.
create or replace function public.sync_cancelado_em()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelado' then
    if new.cancelado_em is null then
      new.cancelado_em := now();
    end if;
  else
    new.cancelado_em := null;
    new.aviso_purga_enviado_em := null;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
