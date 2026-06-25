-- Módulo Obras e Construção Civil
-- Tabelas: obras, obras_etapas, obras_medicoes

-- ---------------------------------------------------------------------------
-- 1. obras — projetos/contratos de construção
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.obras (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id            UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  responsavel_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  nome                  TEXT NOT NULL,
  tipo                  TEXT CHECK (tipo IN ('residencial','comercial','industrial','infraestrutura','reforma','outro')),
  endereco              TEXT,
  cidade                TEXT,
  estado                CHAR(2),
  valor_contrato        NUMERIC(15,2),
  data_inicio           DATE,
  data_previsao_termino DATE,
  data_conclusao        DATE,
  status                TEXT NOT NULL DEFAULT 'orcamento' CHECK (status IN ('orcamento','em_andamento','pausada','concluida','cancelada')),
  descricao             TEXT,
  art_numero            TEXT,
  created_by            UUID REFERENCES public.profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.obras AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON public.obras
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON public.obras
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY update_auth ON public.obras
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY delete_admin ON public.obras
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_obras
  BEFORE INSERT ON public.obras
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX IF NOT EXISTS idx_obras_empresa
  ON public.obras(empresa_id);

CREATE INDEX IF NOT EXISTS idx_obras_status
  ON public.obras(status);

CREATE INDEX IF NOT EXISTS idx_obras_cliente
  ON public.obras(cliente_id) WHERE cliente_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. obras_etapas — fases/marcos da obra
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.obras_etapas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id          UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  descricao        TEXT,
  percentual_obra  NUMERIC(5,2),
  valor            NUMERIC(15,2),
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida')),
  data_previsao    DATE,
  data_conclusao   DATE,
  ordem            INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.obras_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.obras_etapas AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON public.obras_etapas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON public.obras_etapas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY update_auth ON public.obras_etapas
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY delete_admin ON public.obras_etapas
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_obras_etapas
  BEFORE INSERT ON public.obras_etapas
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX IF NOT EXISTS idx_obras_etapas_obra
  ON public.obras_etapas(obra_id);

-- ---------------------------------------------------------------------------
-- 3. obras_medicoes — marcos de faturamento
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.obras_medicoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id          UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_medicao   INTEGER NOT NULL DEFAULT 1,
  descricao        TEXT NOT NULL,
  percentual       NUMERIC(5,2),
  valor            NUMERIC(15,2),
  data_medicao     DATE,
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','faturada')),
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.obras_medicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.obras_medicoes AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON public.obras_medicoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON public.obras_medicoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY update_auth ON public.obras_medicoes
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY delete_admin ON public.obras_medicoes
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_obras_medicoes
  BEFORE INSERT ON public.obras_medicoes
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX IF NOT EXISTS idx_obras_medicoes_obra
  ON public.obras_medicoes(obra_id);

-- ---------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
