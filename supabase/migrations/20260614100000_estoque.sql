-- ============================================================================
-- CRM Studio — Módulo Estoque (M7)
-- ============================================================================
-- Depende de: 20260611180000_multitenant_foundation.sql
-- Helpers reutilizados: current_empresa_id(), set_empresa_id()
-- ============================================================================

-- 1) Tabela de produtos -------------------------------------------------------
create table if not exists public.produtos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nome            text not null,
  sku             text,
  unidade         text not null default 'un',
  custo_medio     numeric(14,2) not null default 0,
  preco_venda     numeric(14,2) not null default 0,
  estoque_minimo  numeric(14,3) not null default 0,
  saldo_atual     numeric(14,3) not null default 0,
  ativo           boolean not null default true,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_produtos_empresa on public.produtos(empresa_id);
create index if not exists idx_produtos_sku     on public.produtos(empresa_id, sku) where sku is not null;

alter table public.produtos enable row level security;

drop policy if exists tenant_isolation on public.produtos;
create policy tenant_isolation on public.produtos as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

drop trigger if exists trg_set_empresa on public.produtos;
create trigger trg_set_empresa
  before insert on public.produtos
  for each row execute function public.set_empresa_id();

-- 2) Tabela de movimentações de estoque ---------------------------------------
create table if not exists public.movimentacoes_estoque (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  produto_id      uuid not null references public.produtos(id) on delete cascade,
  tipo            text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  quantidade      numeric(14,3) not null,
  custo_unitario  numeric(14,2),
  motivo          text,
  negocio_id      uuid,  -- TODO(integração): FK para negocios quando integração pipeline estiver pronta
  data            date not null default current_date,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_movimentacoes_estoque_empresa on public.movimentacoes_estoque(empresa_id);
create index if not exists idx_movimentacoes_estoque_produto on public.movimentacoes_estoque(produto_id);
create index if not exists idx_movimentacoes_estoque_data    on public.movimentacoes_estoque(empresa_id, data);

alter table public.movimentacoes_estoque enable row level security;

drop policy if exists tenant_isolation on public.movimentacoes_estoque;
create policy tenant_isolation on public.movimentacoes_estoque as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

drop trigger if exists trg_set_empresa on public.movimentacoes_estoque;
create trigger trg_set_empresa
  before insert on public.movimentacoes_estoque
  for each row execute function public.set_empresa_id();

-- 3) Função: atualiza saldo_atual após movimentação ---------------------------
-- entrada  → soma quantidade
-- saida    → subtrai quantidade
-- ajuste   → quantidade pode ser positiva (soma) ou negativa (subtrai)
-- Custo médio ponderado é atualizado nas entradas (quando custo_unitario informado).
create or replace function public.atualizar_saldo_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_saldo_atual   numeric(14,3);
  v_custo_atual   numeric(14,2);
  v_novo_saldo    numeric(14,3);
  v_novo_custo    numeric(14,2);
  v_delta         numeric(14,3);
begin
  select saldo_atual, custo_medio
    into v_saldo_atual, v_custo_atual
  from public.produtos
  where id = new.produto_id;

  case new.tipo
    when 'entrada' then
      v_delta := new.quantidade;
      -- Custo médio ponderado (apenas se custo_unitario informado e positivo)
      if new.custo_unitario is not null and new.custo_unitario > 0 then
        if (v_saldo_atual + v_delta) > 0 then
          v_novo_custo := (
            (coalesce(v_saldo_atual, 0) * coalesce(v_custo_atual, 0))
            + (new.quantidade * new.custo_unitario)
          ) / (v_saldo_atual + v_delta);
        else
          v_novo_custo := new.custo_unitario;
        end if;
      else
        v_novo_custo := v_custo_atual;
      end if;

    when 'saida' then
      v_delta := -new.quantidade;
      v_novo_custo := v_custo_atual;

    when 'ajuste' then
      -- ajuste: quantidade positiva = soma, negativa = subtrai
      v_delta := new.quantidade;
      v_novo_custo := v_custo_atual;
  end case;

  v_novo_saldo := coalesce(v_saldo_atual, 0) + v_delta;

  update public.produtos
    set saldo_atual  = v_novo_saldo,
        custo_medio  = coalesce(v_novo_custo, 0)
  where id = new.produto_id;

  return new;
end $$;

drop trigger if exists trg_atualizar_saldo on public.movimentacoes_estoque;
create trigger trg_atualizar_saldo
  after insert on public.movimentacoes_estoque
  for each row execute function public.atualizar_saldo_estoque();

-- ============================================================================
-- Recarregar schema do PostgREST
-- ============================================================================
notify pgrst, 'reload schema';
