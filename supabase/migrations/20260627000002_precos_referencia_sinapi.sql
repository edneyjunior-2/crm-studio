-- =============================================================================
-- F1 — Catálogo de preços de referência (SINAPI/ORSE) para o módulo Engenharia.
-- Tabela GLOBAL (não por tenant): SINAPI é referência pública compartilhada.
-- Leitura para qualquer autenticado; escrita só platform admin (importador).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.precos_referencia (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte                  TEXT NOT NULL DEFAULT 'SINAPI',          -- SINAPI | ORSE
  uf                     CHAR(2) NOT NULL,                        -- BA
  data_ref               DATE NOT NULL,                          -- mês de referência (1º dia)
  tipo                   TEXT NOT NULL CHECK (tipo IN ('insumo','composicao')),
  codigo                 TEXT NOT NULL,
  descricao              TEXT NOT NULL,
  unidade                TEXT,
  grupo                  TEXT,
  custo_com_desoneracao  NUMERIC(15,4),
  custo_sem_desoneracao  NUMERIC(15,4),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fonte, uf, data_ref, tipo, codigo)
);

ALTER TABLE public.precos_referencia ENABLE ROW LEVEL SECURITY;

-- Catálogo é leitura para todo usuário autenticado (compartilhado entre tenants)
CREATE POLICY precos_ref_select ON public.precos_referencia
  FOR SELECT TO authenticated USING (true);

-- Escrita só platform admin (o importador usa service role, que bypassa RLS de qualquer forma)
CREATE POLICY precos_ref_admin_insert ON public.precos_referencia
  FOR INSERT TO authenticated WITH CHECK (is_platform_admin());
CREATE POLICY precos_ref_admin_update ON public.precos_referencia
  FOR UPDATE TO authenticated USING (is_platform_admin());
CREATE POLICY precos_ref_admin_delete ON public.precos_referencia
  FOR DELETE TO authenticated USING (is_platform_admin());

CREATE INDEX IF NOT EXISTS idx_precos_ref_filtro ON public.precos_referencia (uf, data_ref, tipo);
CREATE INDEX IF NOT EXISTS idx_precos_ref_codigo ON public.precos_referencia (codigo);
CREATE INDEX IF NOT EXISTS idx_precos_ref_descricao_trgm ON public.precos_referencia USING gin (descricao gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
