-- =============================================================================
-- cancelado_em coerente com status — fonte ÚNICA de verdade da retenção.
--
-- Problema: 3 call-sites mudam status='cancelado' (excluirConta, atualizarEmpresa
-- do admin, webhook Asaas) mas só 1 carimbava cancelado_em; e nenhuma reativação
-- limpava. Isso permitia purga com retenção quase zero (cancelado_em obsoleto) ou
-- conta nunca purgada (cancelado_em nulo). Centralizamos num trigger: nenhum
-- call-site futuro pode reabrir a brecha.
--
-- Regra:
--   status = 'cancelado'  e cancelado_em IS NULL  -> cancelado_em := now()
--   status <> 'cancelado'                          -> cancelado_em := null
-- (excluirConta já manda now() explícito → o IS NULL preserva esse valor.)
-- =============================================================================

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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_cancelado_em on public.empresas;
create trigger trg_sync_cancelado_em
  before insert or update on public.empresas
  for each row
  execute function public.sync_cancelado_em();

-- Backfill defensivo: empresas já canceladas sem carimbo recebem now() (ganham a
-- janela de 90 dias a partir de agora — direção segura, nunca purga imediata).
update public.empresas
  set cancelado_em = now()
  where status = 'cancelado' and cancelado_em is null;

-- E zera carimbo órfão em quem não está cancelado (coerência retroativa).
update public.empresas
  set cancelado_em = null
  where status <> 'cancelado' and cancelado_em is not null;

notify pgrst, 'reload schema';
