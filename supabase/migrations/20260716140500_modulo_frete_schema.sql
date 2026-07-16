-- ============================================================================
-- CRM Studio — Módulo Frete e Logística (schema físico)
-- ============================================================================
-- Spec: .claude/specs/frete-01-backend-schema-antt.md
--
-- Tabelas por tenant (RLS RESTRICTIVE + trigger set_empresa_id(), padrão de
-- 20260625000002_modulo_obras.sql — funções já existem em
-- 20260611180000_multitenant_foundation.sql, não redefinidas aqui):
--   frete_veiculos, frete_motoristas, frete_cotacoes
--
-- Tabela global (NÃO por tenant, sem empresa_id/RLS de tenant):
--   frete_antt_coeficientes — coeficientes oficiais ANTT, iguais para todas as
--   empresas; escrita restrita a service_role (atualização manual quando a
--   ANTT reajusta).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. frete_veiculos
-- ---------------------------------------------------------------------------

CREATE TABLE public.frete_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  placa text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('toco','truck','carreta','bitrem','rodotrem','outro')),
  eixos integer,
  rntrc text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frete_veiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.frete_veiculos AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON public.frete_veiculos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON public.frete_veiculos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY update_auth ON public.frete_veiculos
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY delete_admin ON public.frete_veiculos
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_frete_veiculos
  BEFORE INSERT ON public.frete_veiculos
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX idx_frete_veiculos_empresa ON public.frete_veiculos(empresa_id);

-- ---------------------------------------------------------------------------
-- 2. frete_motoristas
-- ---------------------------------------------------------------------------

CREATE TABLE public.frete_motoristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  cnh_numero text,
  cnh_categoria text CHECK (cnh_categoria IN ('A','B','C','D','E','AB','AC','AD','AE')),
  cnh_validade date,
  vinculo text NOT NULL DEFAULT 'clt' CHECK (vinculo IN ('autonomo','clt')),
  rntrc text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frete_motoristas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.frete_motoristas AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON public.frete_motoristas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON public.frete_motoristas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY update_auth ON public.frete_motoristas
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY delete_admin ON public.frete_motoristas
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_frete_motoristas
  BEFORE INSERT ON public.frete_motoristas
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX idx_frete_motoristas_empresa ON public.frete_motoristas(empresa_id);

-- ---------------------------------------------------------------------------
-- 3. frete_cotacoes
-- ---------------------------------------------------------------------------

CREATE TABLE public.frete_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id),
  negocio_id uuid REFERENCES public.negocios(id),
  veiculo_id uuid REFERENCES public.frete_veiculos(id),
  motorista_id uuid REFERENCES public.frete_motoristas(id),
  origem text,
  destino text,
  distancia_km numeric(10,2) NOT NULL CHECK (distancia_km > 0),
  tabela_antt text NOT NULL CHECK (tabela_antt IN ('A','B','C','D')),
  tipo_carga text NOT NULL,
  valor_piso_antt numeric(12,2) NOT NULL,
  valor_negociado numeric(12,2),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','aprovada','em_viagem','concluida','cancelada')),
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frete_cotacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON public.frete_cotacoes AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON public.frete_cotacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON public.frete_cotacoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY update_auth ON public.frete_cotacoes
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY delete_admin ON public.frete_cotacoes
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_frete_cotacoes
  BEFORE INSERT ON public.frete_cotacoes
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX idx_frete_cotacoes_empresa ON public.frete_cotacoes(empresa_id);
CREATE INDEX idx_frete_cotacoes_cliente ON public.frete_cotacoes(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX idx_frete_cotacoes_negocio ON public.frete_cotacoes(negocio_id) WHERE negocio_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. frete_antt_coeficientes — tabela GLOBAL (não por tenant)
-- ---------------------------------------------------------------------------
-- Os valores da ANTT são os mesmos para todas as empresas: sem empresa_id, sem
-- RLS por tenant. Só SELECT é liberado para authenticated; INSERT/UPDATE/
-- DELETE ficam de fora de propósito — a atualização dos coeficientes é manual
-- (SQL/admin) quando a ANTT reajusta, nunca pelo app.

CREATE TABLE public.frete_antt_coeficientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_antt text NOT NULL CHECK (tabela_antt IN ('A','B','C','D')),
  tipo_carga text NOT NULL,
  ccd numeric(10,4) NOT NULL,
  cc numeric(10,2) NOT NULL,
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  fonte text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tabela_antt, tipo_carga, vigencia_inicio)
);

ALTER TABLE public.frete_antt_coeficientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_auth ON public.frete_antt_coeficientes FOR SELECT TO authenticated USING (true);
-- Sem policy de INSERT/UPDATE/DELETE para 'authenticated': só service_role escreve
-- (atualização dos coeficientes é manual, feita pela plataforma quando a ANTT reajusta).

-- IMPORTANTE — NÃO fabricar valores oficiais. Semeia com APENAS UMA linha, o
-- único par de coeficientes confirmado em
-- research/25-modulo-frete-logistica-transportadora.md (Resolução ANTT
-- 6.076/2026). NÃO inventar outras linhas/valores de CCD/CC para os demais
-- tipos de carga ou tabelas (B/C/D, ou outros tipos de carga da tabela A) —
-- isso seria dado de compliance falso. A tabela completa A/B/C/D × tipos de
-- carga está PENDENTE de transcrição manual da fonte oficial antes de uso em
-- produção — qualquer cotação fora de tabela_antt='A'/tipo_carga='geral' deve
-- tratar buscarCoeficienteVigente() retornando null (ver
-- src/lib/frete/antt-calculadora.ts) e bloquear o cálculo, nunca chutar.
INSERT INTO public.frete_antt_coeficientes (tabela_antt, tipo_carga, ccd, cc, vigencia_inicio, fonte)
VALUES (
  'A',
  'geral',
  5.986,
  478.76,
  '2026-01-20',
  'Resolução ANTT 6.076/2026 (exemplo — tabela completa A/B/C/D × tipos de carga PENDENTE de transcrição manual da fonte oficial antes de uso em produção)'
);

-- ---------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
