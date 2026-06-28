-- Segurança: clientes_sdr ficou SEM RLS (única tabela com empresa_id assim).
-- Guarda crm_api_key + persona por tenant → sem RLS, qualquer usuário autenticado
-- lê os segredos de TODOS os tenants via REST. Habilita RLS + isolamento por tenant.
-- O app acessa clientes_sdr só via admin client (service_role, bypassa RLS) → nada quebra.

alter table public.clientes_sdr enable row level security;

drop policy if exists clientes_sdr_tenant on public.clientes_sdr;
create policy clientes_sdr_tenant on public.clientes_sdr
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

notify pgrst, 'reload schema';
