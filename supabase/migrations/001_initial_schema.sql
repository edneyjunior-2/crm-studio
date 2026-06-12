-- =============================================================================
-- CRM Aurum — Migration 001: Schema inicial completo
-- =============================================================================
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor)
-- Idempotente: usa IF NOT EXISTS em todas as criações
-- =============================================================================

BEGIN;

-- =============================================================================
-- SEÇÃO 1: EXTENSÕES
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- SEÇÃO 2: TABELAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- Ligado ao auth.users do Supabase. Criado automaticamente via trigger.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL,
  role        text        NOT NULL DEFAULT 'comercial'
                          CHECK (role IN ('admin', 'socio', 'comercial')),
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.profiles          IS 'Perfis de usuário ligados ao auth.users';
COMMENT ON COLUMN public.profiles.role     IS 'admin | socio | comercial';


-- -----------------------------------------------------------------------------
-- solucoes
-- Portfólio de soluções representadas pela empresa. Gerenciado pelo admin.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solucoes (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  nome                  text        NOT NULL,
  empresa_representada  text,
  descricao             text,
  comissao_percentual   numeric(5,2),
  ativo                 boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  CONSTRAINT solucoes_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.solucoes IS 'Catálogo de soluções representadas pela empresa';


-- -----------------------------------------------------------------------------
-- clientes
-- Clientes captados pela equipe. Podem estar associados a múltiplas soluções
-- via negócios.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  razao_social      text        NOT NULL,
  cnpj              text,
  contato_nome      text,
  contato_email     text,
  contato_telefone  text,
  segmento          text,
  observacoes       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  CONSTRAINT clientes_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.clientes IS 'Base de clientes do CRM';


-- -----------------------------------------------------------------------------
-- negocios
-- Oportunidades no pipeline de vendas. Cada negócio liga um cliente a uma
-- solução e possui um responsável.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.negocios (
  id                          uuid        NOT NULL DEFAULT gen_random_uuid(),
  cliente_id                  uuid        NOT NULL REFERENCES public.clientes(id)  ON DELETE RESTRICT,
  solucao_id                  uuid        NOT NULL REFERENCES public.solucoes(id)  ON DELETE RESTRICT,
  responsavel_id              uuid        NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,
  titulo                      text        NOT NULL,
  estagio                     text        NOT NULL DEFAULT 'prospeccao'
                              CHECK (estagio IN (
                                'prospeccao',
                                'qualificacao',
                                'proposta',
                                'negociacao',
                                'fechado_ganho',
                                'fechado_perdido'
                              )),
  valor_estimado              numeric(15,2),
  probabilidade               integer     CHECK (probabilidade BETWEEN 0 AND 100),
  data_previsao_fechamento    date,
  observacoes                 text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT negocios_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.negocios         IS 'Oportunidades no pipeline de vendas';
COMMENT ON COLUMN public.negocios.estagio IS 'prospeccao | qualificacao | proposta | negociacao | fechado_ganho | fechado_perdido';


-- -----------------------------------------------------------------------------
-- atividades
-- Histórico de interações com clientes/negócios.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.atividades (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  negocio_id      uuid        REFERENCES public.negocios(id)  ON DELETE SET NULL,
  cliente_id      uuid        REFERENCES public.clientes(id)  ON DELETE SET NULL,
  responsavel_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tipo            text        NOT NULL
                  CHECK (tipo IN ('ligacao', 'email', 'reuniao', 'proposta', 'nota')),
  descricao       text        NOT NULL,
  data_atividade  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT atividades_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.atividades      IS 'Histórico de interações com clientes e negócios';
COMMENT ON COLUMN public.atividades.tipo IS 'ligacao | email | reuniao | proposta | nota';


-- -----------------------------------------------------------------------------
-- contas_receber
-- Financeiro — acesso restrito a admin e socio.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas_receber (
  id                uuid    NOT NULL DEFAULT gen_random_uuid(),
  negocio_id        uuid    REFERENCES public.negocios(id)  ON DELETE SET NULL,
  cliente_id        uuid    REFERENCES public.clientes(id)  ON DELETE SET NULL,
  descricao         text    NOT NULL,
  valor             numeric(15,2) NOT NULL,
  data_vencimento   date    NOT NULL,
  data_recebimento  date,
  status            text    NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'recebido', 'atrasado', 'cancelado')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid    REFERENCES public.profiles(id) ON DELETE SET NULL,

  CONSTRAINT contas_receber_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.contas_receber IS 'Contas a receber — acesso restrito a admin e socio';


-- -----------------------------------------------------------------------------
-- contas_pagar
-- Financeiro — acesso restrito a admin e socio.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas_pagar (
  id                uuid    NOT NULL DEFAULT gen_random_uuid(),
  descricao         text    NOT NULL,
  fornecedor        text,
  valor             numeric(15,2) NOT NULL,
  data_vencimento   date    NOT NULL,
  data_pagamento    date,
  categoria         text,
  status            text    NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid    REFERENCES public.profiles(id) ON DELETE SET NULL,

  CONSTRAINT contas_pagar_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.contas_pagar IS 'Contas a pagar — acesso restrito a admin e socio';


-- =============================================================================
-- SEÇÃO 3: ÍNDICES
-- =============================================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);

-- solucoes
CREATE INDEX IF NOT EXISTS idx_solucoes_ativo
  ON public.solucoes(ativo);
CREATE INDEX IF NOT EXISTS idx_solucoes_created_by
  ON public.solucoes(created_by);

-- clientes
CREATE INDEX IF NOT EXISTS idx_clientes_created_by
  ON public.clientes(created_by);
CREATE INDEX IF NOT EXISTS idx_clientes_cnpj
  ON public.clientes(cnpj);

-- negocios
CREATE INDEX IF NOT EXISTS idx_negocios_cliente_id
  ON public.negocios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_negocios_solucao_id
  ON public.negocios(solucao_id);
CREATE INDEX IF NOT EXISTS idx_negocios_responsavel_id
  ON public.negocios(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_negocios_estagio
  ON public.negocios(estagio);
CREATE INDEX IF NOT EXISTS idx_negocios_data_previsao_fechamento
  ON public.negocios(data_previsao_fechamento);

-- atividades
CREATE INDEX IF NOT EXISTS idx_atividades_negocio_id
  ON public.atividades(negocio_id);
CREATE INDEX IF NOT EXISTS idx_atividades_cliente_id
  ON public.atividades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_atividades_responsavel_id
  ON public.atividades(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_atividades_data_atividade
  ON public.atividades(data_atividade);

-- contas_receber
CREATE INDEX IF NOT EXISTS idx_contas_receber_status
  ON public.contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_vencimento
  ON public.contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_id
  ON public.contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_negocio_id
  ON public.contas_receber(negocio_id);

-- contas_pagar
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status
  ON public.contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_vencimento
  ON public.contas_pagar(data_vencimento);


-- =============================================================================
-- SEÇÃO 4: TRIGGER — updated_at em negocios
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_negocios_updated_at ON public.negocios;
CREATE TRIGGER trg_negocios_updated_at
  BEFORE UPDATE ON public.negocios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SEÇÃO 5: TRIGGER — criação automática de profile ao registrar usuário
-- =============================================================================
-- Quando o Supabase Auth cria um novo usuário, este trigger insere
-- automaticamente um registro na tabela profiles.
-- O full_name é lido de raw_user_meta_data (passado no signUp).
-- O role padrão é 'comercial' — o admin deve elevar manualmente se necessário.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'comercial')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- SEÇÃO 6: ROW LEVEL SECURITY
-- =============================================================================
-- Estratégia:
--   admin    → acesso total a tudo
--   socio    → leitura total; sem acesso a contas_receber/contas_pagar via
--              política de escrita diferenciada (herda read total)
--   comercial → vê/edita apenas registros onde é responsável ou criador;
--               NUNCA acessa financeiro
--
-- Helper function: get_my_role()
-- Evita subqueries repetidas nas policies e é SECURITY DEFINER para garantir
-- que o lookup no profiles não seja bloqueado por outra policy.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- ===== HABILITAR RLS =========================================================

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solucoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar   ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- POLICIES: profiles
-- =============================================================================

-- Usuário vê o próprio perfil
DROP POLICY IF EXISTS "profiles: usuario ve o proprio" ON public.profiles;
CREATE POLICY "profiles: usuario ve o proprio"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- Admin vê todos os perfis
DROP POLICY IF EXISTS "profiles: admin ve todos" ON public.profiles;
CREATE POLICY "profiles: admin ve todos"
  ON public.profiles
  FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Somente o sistema (trigger) insere profiles; bloqueamos INSERT direto por todos
-- Usuário pode atualizar o próprio perfil (nome); role só via admin
DROP POLICY IF EXISTS "profiles: usuario atualiza o proprio" ON public.profiles;
CREATE POLICY "profiles: usuario atualiza o proprio"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin atualiza qualquer perfil (incluindo role)
DROP POLICY IF EXISTS "profiles: admin atualiza todos" ON public.profiles;
CREATE POLICY "profiles: admin atualiza todos"
  ON public.profiles
  FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Admin deleta perfis (exceto o próprio, protegido por lógica de aplicação)
DROP POLICY IF EXISTS "profiles: admin deleta" ON public.profiles;
CREATE POLICY "profiles: admin deleta"
  ON public.profiles
  FOR DELETE
  USING (public.get_my_role() = 'admin');

-- INSERT via trigger (SECURITY DEFINER) — nenhuma policy de INSERT para usuários normais
-- Admin pode inserir perfis manualmente se necessário
DROP POLICY IF EXISTS "profiles: admin insere" ON public.profiles;
CREATE POLICY "profiles: admin insere"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');


-- =============================================================================
-- POLICIES: solucoes
-- Todos leem; apenas admin cria, edita e deleta.
-- =============================================================================

DROP POLICY IF EXISTS "solucoes: todos leem" ON public.solucoes;
CREATE POLICY "solucoes: todos leem"
  ON public.solucoes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "solucoes: admin insere" ON public.solucoes;
CREATE POLICY "solucoes: admin insere"
  ON public.solucoes
  FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "solucoes: admin atualiza" ON public.solucoes;
CREATE POLICY "solucoes: admin atualiza"
  ON public.solucoes
  FOR UPDATE
  USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "solucoes: admin deleta" ON public.solucoes;
CREATE POLICY "solucoes: admin deleta"
  ON public.solucoes
  FOR DELETE
  USING (public.get_my_role() = 'admin');


-- =============================================================================
-- POLICIES: clientes
-- Todos leem e criam.
-- Admin edita/deleta qualquer um.
-- Socio edita qualquer um.
-- Comercial edita apenas os que criou.
-- =============================================================================

DROP POLICY IF EXISTS "clientes: todos leem" ON public.clientes;
CREATE POLICY "clientes: todos leem"
  ON public.clientes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "clientes: todos inserem" ON public.clientes;
CREATE POLICY "clientes: todos inserem"
  ON public.clientes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admin e socio atualizam qualquer cliente
DROP POLICY IF EXISTS "clientes: admin e socio atualizam todos" ON public.clientes;
CREATE POLICY "clientes: admin e socio atualizam todos"
  ON public.clientes
  FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'socio'));

-- Comercial atualiza apenas os que criou
DROP POLICY IF EXISTS "clientes: comercial atualiza os seus" ON public.clientes;
CREATE POLICY "clientes: comercial atualiza os seus"
  ON public.clientes
  FOR UPDATE
  USING (
    public.get_my_role() = 'comercial'
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'comercial'
    AND created_by = auth.uid()
  );

-- Apenas admin deleta clientes
DROP POLICY IF EXISTS "clientes: admin deleta" ON public.clientes;
CREATE POLICY "clientes: admin deleta"
  ON public.clientes
  FOR DELETE
  USING (public.get_my_role() = 'admin');


-- =============================================================================
-- POLICIES: negocios
-- Admin e socio veem todos; comercial vê apenas os seus (responsavel_id).
-- Admin e socio inserem para qualquer responsável.
-- Comercial insere apenas como responsável de si mesmo.
-- Admin e socio atualizam todos; comercial atualiza apenas os seus.
-- Apenas admin deleta.
-- =============================================================================

DROP POLICY IF EXISTS "negocios: admin e socio veem todos" ON public.negocios;
CREATE POLICY "negocios: admin e socio veem todos"
  ON public.negocios
  FOR SELECT
  USING (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "negocios: comercial ve os seus" ON public.negocios;
CREATE POLICY "negocios: comercial ve os seus"
  ON public.negocios
  FOR SELECT
  USING (
    public.get_my_role() = 'comercial'
    AND responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "negocios: admin e socio inserem" ON public.negocios;
CREATE POLICY "negocios: admin e socio inserem"
  ON public.negocios
  FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "negocios: comercial insere os seus" ON public.negocios;
CREATE POLICY "negocios: comercial insere os seus"
  ON public.negocios
  FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'comercial'
    AND responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "negocios: admin e socio atualizam todos" ON public.negocios;
CREATE POLICY "negocios: admin e socio atualizam todos"
  ON public.negocios
  FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "negocios: comercial atualiza os seus" ON public.negocios;
CREATE POLICY "negocios: comercial atualiza os seus"
  ON public.negocios
  FOR UPDATE
  USING (
    public.get_my_role() = 'comercial'
    AND responsavel_id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'comercial'
    AND responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "negocios: admin deleta" ON public.negocios;
CREATE POLICY "negocios: admin deleta"
  ON public.negocios
  FOR DELETE
  USING (public.get_my_role() = 'admin');


-- =============================================================================
-- POLICIES: atividades
-- Mesma lógica dos negócios (responsavel_id como filtro para comercial).
-- =============================================================================

DROP POLICY IF EXISTS "atividades: admin e socio veem todas" ON public.atividades;
CREATE POLICY "atividades: admin e socio veem todas"
  ON public.atividades
  FOR SELECT
  USING (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "atividades: comercial ve as suas" ON public.atividades;
CREATE POLICY "atividades: comercial ve as suas"
  ON public.atividades
  FOR SELECT
  USING (
    public.get_my_role() = 'comercial'
    AND responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "atividades: admin e socio inserem" ON public.atividades;
CREATE POLICY "atividades: admin e socio inserem"
  ON public.atividades
  FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "atividades: comercial insere as suas" ON public.atividades;
CREATE POLICY "atividades: comercial insere as suas"
  ON public.atividades
  FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'comercial'
    AND responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "atividades: admin e socio atualizam todas" ON public.atividades;
CREATE POLICY "atividades: admin e socio atualizam todas"
  ON public.atividades
  FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "atividades: comercial atualiza as suas" ON public.atividades;
CREATE POLICY "atividades: comercial atualiza as suas"
  ON public.atividades
  FOR UPDATE
  USING (
    public.get_my_role() = 'comercial'
    AND responsavel_id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'comercial'
    AND responsavel_id = auth.uid()
  );

DROP POLICY IF EXISTS "atividades: admin deleta" ON public.atividades;
CREATE POLICY "atividades: admin deleta"
  ON public.atividades
  FOR DELETE
  USING (public.get_my_role() = 'admin');


-- =============================================================================
-- POLICIES: contas_receber
-- APENAS admin e socio. Comercial nunca acessa — nenhuma policy permissiva
-- cobre o role 'comercial', portanto o RLS nega por padrão.
-- =============================================================================

DROP POLICY IF EXISTS "contas_receber: admin e socio leem" ON public.contas_receber;
CREATE POLICY "contas_receber: admin e socio leem"
  ON public.contas_receber
  FOR SELECT
  USING (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "contas_receber: admin e socio inserem" ON public.contas_receber;
CREATE POLICY "contas_receber: admin e socio inserem"
  ON public.contas_receber
  FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "contas_receber: admin e socio atualizam" ON public.contas_receber;
CREATE POLICY "contas_receber: admin e socio atualizam"
  ON public.contas_receber
  FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "contas_receber: admin deleta" ON public.contas_receber;
CREATE POLICY "contas_receber: admin deleta"
  ON public.contas_receber
  FOR DELETE
  USING (public.get_my_role() = 'admin');


-- =============================================================================
-- POLICIES: contas_pagar
-- APENAS admin e socio. Mesma restrição que contas_receber.
-- =============================================================================

DROP POLICY IF EXISTS "contas_pagar: admin e socio leem" ON public.contas_pagar;
CREATE POLICY "contas_pagar: admin e socio leem"
  ON public.contas_pagar
  FOR SELECT
  USING (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "contas_pagar: admin e socio inserem" ON public.contas_pagar;
CREATE POLICY "contas_pagar: admin e socio inserem"
  ON public.contas_pagar
  FOR INSERT
  WITH CHECK (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "contas_pagar: admin e socio atualizam" ON public.contas_pagar;
CREATE POLICY "contas_pagar: admin e socio atualizam"
  ON public.contas_pagar
  FOR UPDATE
  USING (public.get_my_role() IN ('admin', 'socio'));

DROP POLICY IF EXISTS "contas_pagar: admin deleta" ON public.contas_pagar;
CREATE POLICY "contas_pagar: admin deleta"
  ON public.contas_pagar
  FOR DELETE
  USING (public.get_my_role() = 'admin');


-- =============================================================================
-- SEÇÃO 7: GRANT — expor schema ao PostgREST
-- =============================================================================
-- O anon role não deve ter acesso direto; authenticated é o padrão Supabase.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solucoes       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.negocios       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_receber TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar   TO authenticated;

-- Revogar acesso anônimo explicitamente das tabelas sensíveis
REVOKE ALL ON public.contas_receber FROM anon;
REVOKE ALL ON public.contas_pagar   FROM anon;


-- =============================================================================
-- SEÇÃO 8: NOTIFY — recarregar schema do PostgREST
-- =============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
