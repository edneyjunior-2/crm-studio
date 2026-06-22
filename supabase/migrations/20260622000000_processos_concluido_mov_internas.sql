-- Adiciona 'concluido' ao CHECK de status dos processos
ALTER TABLE processos_juridicos
  DROP CONSTRAINT IF EXISTS processos_juridicos_status_check;
ALTER TABLE processos_juridicos
  ADD CONSTRAINT processos_juridicos_status_check
  CHECK (status IN ('ativo', 'encerrado', 'suspenso', 'arquivado', 'concluido'));

-- Tabela de movimentações internas (histórico interno, não DataJud)
CREATE TABLE IF NOT EXISTS movimentacoes_internas_processo (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id uuid NOT NULL REFERENCES processos_juridicos(id) ON DELETE CASCADE,
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  autor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assunto     text NOT NULL,
  descricao   text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE movimentacoes_internas_processo ENABLE ROW LEVEL SECURITY;

-- RESTRICTIVE: isolamento de tenant (empresa_id = tenant do usuário logado)
CREATE POLICY tenant_isolation ON movimentacoes_internas_processo AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

-- PERMISSIVE: todos autenticados podem ler e criar
CREATE POLICY select_auth ON movimentacoes_internas_processo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON movimentacoes_internas_processo
  FOR INSERT TO authenticated WITH CHECK (true);

-- Somente admin pode excluir
CREATE POLICY delete_admin ON movimentacoes_internas_processo
  FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Trigger: preenche empresa_id automaticamente a partir do perfil do usuário
CREATE TRIGGER trg_set_empresa
  BEFORE INSERT ON movimentacoes_internas_processo
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

-- Índices
CREATE INDEX IF NOT EXISTS idx_mov_internas_processo
  ON movimentacoes_internas_processo(processo_id);
CREATE INDEX IF NOT EXISTS idx_mov_internas_created_at
  ON movimentacoes_internas_processo(created_at DESC);

NOTIFY pgrst, 'reload schema';
