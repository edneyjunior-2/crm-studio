-- =============================================================================
-- F2 — Orçamento de obra (módulo Engenharia). Tabelas por tenant: orcamentos + itens.
-- Mesmo padrão RLS/trigger do módulo obras.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  obra_id         UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  cliente_id      UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo          TEXT NOT NULL,
  modelo          TEXT NOT NULL DEFAULT 'mao_obra_material'
                    CHECK (modelo IN ('mao_obra','mao_obra_material')),
  uf              CHAR(2) NOT NULL DEFAULT 'BA',
  fonte           TEXT NOT NULL DEFAULT 'SINAPI',
  data_ref_sinapi DATE,
  desoneracao     BOOLEAN NOT NULL DEFAULT false,
  bdi_percentual  NUMERIC(5,2) NOT NULL DEFAULT 0,
  total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','finalizado')),
  observacoes     TEXT,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.orcamentos AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());
CREATE POLICY select_auth ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY insert_auth ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY update_auth ON public.orcamentos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY delete_admin ON public.orcamentos FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin','socio')
);
CREATE TRIGGER trg_set_empresa_orcamentos
  BEFORE INSERT ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION set_empresa_id();
CREATE INDEX IF NOT EXISTS idx_orcamentos_empresa ON public.orcamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_obra ON public.orcamentos(obra_id);

-- Itens do orçamento (agrupados por etapa) -----------------------------------
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id   UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  etapa          TEXT,
  categoria      TEXT CHECK (categoria IN ('mao_obra','material','composicao')),
  codigo_sinapi  TEXT,
  descricao      TEXT NOT NULL,
  unidade        TEXT,
  quantidade     NUMERIC(15,4) NOT NULL DEFAULT 1,
  custo_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,  -- snapshot do preço
  subtotal       NUMERIC(15,2) NOT NULL DEFAULT 0,
  ordem          INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.orcamento_itens AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());
CREATE POLICY select_auth ON public.orcamento_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY insert_auth ON public.orcamento_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY update_auth ON public.orcamento_itens FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY delete_auth ON public.orcamento_itens FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_set_empresa_orcamento_itens
  BEFORE INSERT ON public.orcamento_itens FOR EACH ROW EXECUTE FUNCTION set_empresa_id();
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento ON public.orcamento_itens(orcamento_id);

NOTIFY pgrst, 'reload schema';
