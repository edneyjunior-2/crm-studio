-- =============================================================================
-- Módulo Advocacia: processos_juridicos + movimentacoes_processo
-- =============================================================================

-- Tabela principal de processos
CREATE TABLE IF NOT EXISTS public.processos_juridicos (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id            uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_processo       text NOT NULL,
  tribunal_slug         text NOT NULL,
  cliente_id            uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  advogado_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  area                  text,
  assunto               text,
  vara                  text,
  comarca               text,
  valor_causa           numeric(15,2),
  status                text NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo','encerrado','suspenso','arquivado')),
  partes_raw            jsonb,
  ultimo_datajud_update timestamptz,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (empresa_id, numero_processo)
);

ALTER TABLE public.processos_juridicos ENABLE ROW LEVEL SECURITY;

-- Trigger: preenche empresa_id automaticamente no insert
DROP TRIGGER IF EXISTS trg_set_empresa ON public.processos_juridicos;
CREATE TRIGGER trg_set_empresa
  BEFORE INSERT ON public.processos_juridicos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- RLS tenant isolation (restrictive + WITH CHECK)
DROP POLICY IF EXISTS "tenant_isolation" ON public.processos_juridicos;
DROP POLICY IF EXISTS "empresa_own" ON public.processos_juridicos;
CREATE POLICY tenant_isolation ON public.processos_juridicos
  AS RESTRICTIVE FOR ALL
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- Tabela de movimentações
CREATE TABLE IF NOT EXISTS public.movimentacoes_processo (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id       uuid NOT NULL REFERENCES public.processos_juridicos(id) ON DELETE CASCADE,
  empresa_id        uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo_movimento  integer,
  descricao         text NOT NULL,
  complemento       text,
  data_movimentacao date NOT NULL,
  lido              boolean NOT NULL DEFAULT false,
  raw_data          jsonb,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (processo_id, codigo_movimento, data_movimentacao)
);

ALTER TABLE public.movimentacoes_processo ENABLE ROW LEVEL SECURITY;

-- Trigger: preenche empresa_id automaticamente no insert
DROP TRIGGER IF EXISTS trg_set_empresa ON public.movimentacoes_processo;
CREATE TRIGGER trg_set_empresa
  BEFORE INSERT ON public.movimentacoes_processo
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- RLS tenant isolation (restrictive + WITH CHECK)
DROP POLICY IF EXISTS "tenant_isolation" ON public.movimentacoes_processo;
DROP POLICY IF EXISTS "empresa_own" ON public.movimentacoes_processo;
CREATE POLICY tenant_isolation ON public.movimentacoes_processo
  AS RESTRICTIVE FOR ALL
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

-- Índices
CREATE INDEX IF NOT EXISTS idx_processos_empresa_status
  ON public.processos_juridicos (empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_lido
  ON public.movimentacoes_processo (processo_id, lido);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_data
  ON public.movimentacoes_processo (data_movimentacao DESC);
