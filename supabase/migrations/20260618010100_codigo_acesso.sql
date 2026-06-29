-- =============================================================================
-- Código de acesso à empresa
-- Cada empresa recebe um código curto único (ex: "SAT-4821") gerado
-- automaticamente. Funcionários usam esse código para se vincular à empresa
-- no primeiro login, sem precisar de convite individual do admin.
-- =============================================================================

-- Função geradora de código legível e único
create or replace function public.gen_codigo_acesso()
returns text
language plpgsql
as $$
declare
  v_codigo text;
  v_tentativas int := 0;
begin
  loop
    v_codigo := upper(substr(md5(gen_random_uuid()::text), 1, 3))
             || '-'
             || lpad((floor(random() * 9000) + 1000)::text, 4, '0');
    exit when not exists (select 1 from public.empresas where codigo_acesso = v_codigo);
    v_tentativas := v_tentativas + 1;
    if v_tentativas > 20 then
      raise exception 'Não foi possível gerar código único para empresa';
    end if;
  end loop;
  return v_codigo;
end;
$$;

-- Coluna na tabela empresas
alter table public.empresas
  add column if not exists codigo_acesso text unique;

-- Gerar código para empresas existentes que ainda não têm
update public.empresas
  set codigo_acesso = public.gen_codigo_acesso()
  where codigo_acesso is null;

-- Tornar não-nula após backfill
alter table public.empresas
  alter column codigo_acesso set not null,
  alter column codigo_acesso set default public.gen_codigo_acesso();

-- =============================================================================
-- RPC pública: buscar empresa por código de acesso
-- SECURITY DEFINER para contornar a RLS de empresas — o usuário-alvo ainda
-- não tem empresa_id, então current_empresa_id() retorna NULL e a policy
-- empresa_self_select bloquearia a consulta normal.
-- Retorna apenas os campos necessários para o preview (não expõe dados sensíveis).
-- =============================================================================
create or replace function public.buscar_empresa_por_codigo(p_codigo text)
returns table(id uuid, nome text, status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select e.id, e.nome, e.status
    from public.empresas e
    where e.codigo_acesso = upper(trim(p_codigo))
    limit 1;
end;
$$;

grant execute on function public.buscar_empresa_por_codigo(text) to authenticated;
