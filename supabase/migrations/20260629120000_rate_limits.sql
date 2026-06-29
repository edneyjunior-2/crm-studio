-- Rate-limit de janela fixa via Postgres (sem infra externa).
-- Usado por rotas públicas (contato, cadastro, esqueci-senha) e ingest de leads.

create table if not exists public.rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- A tabela é acessada APENAS via a função SECURITY DEFINER abaixo (ou service_role).
-- RLS habilitada sem policies = nenhum acesso por anon/authenticated direto.
alter table public.rate_limits enable row level security;

-- Janela fixa atômica: incrementa o contador da chave; reseta se a janela expirou.
-- Retorna TRUE se a requisição está DENTRO do limite, FALSE se excedeu.
create or replace function public.check_rate_limit(
  p_key            text,
  p_max            int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_count int;
begin
  insert into public.rate_limits as rl (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set
      count = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds) then 1
        else rl.count + 1
      end,
      window_start = case
        when rl.window_start < v_now - make_interval(secs => p_window_seconds) then v_now
        else rl.window_start
      end
  returning rl.count into v_count;

  return v_count <= p_max;
end;
$$;

grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated, service_role;

-- ponytail: sem garbage collection. As linhas são chaveadas por IP+rota (reusadas),
-- então o crescimento é limitado a IPs distintos. Adicionar purge via pg_cron só se a
-- tabela crescer demais.

notify pgrst, 'reload schema';
