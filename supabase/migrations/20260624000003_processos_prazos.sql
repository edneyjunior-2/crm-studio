-- Prazos processuais vinculados ao processo
CREATE TABLE IF NOT EXISTS processos_prazos (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id    uuid NOT NULL REFERENCES processos_juridicos(id) ON DELETE CASCADE,
  empresa_id     uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  descricao      text NOT NULL,
  data_prazo     date NOT NULL,
  cumprido       boolean DEFAULT false NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE processos_prazos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON processos_prazos AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON processos_prazos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON processos_prazos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY update_auth ON processos_prazos
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY delete_admin ON processos_prazos
  FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_prazos
  BEFORE INSERT ON processos_prazos
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX IF NOT EXISTS idx_processos_prazos_processo
  ON processos_prazos(processo_id);

CREATE INDEX IF NOT EXISTS idx_processos_prazos_data
  ON processos_prazos(data_prazo);

-- índice parcial para dashboards de prazo: busca só os pendentes
CREATE INDEX IF NOT EXISTS idx_processos_prazos_pendentes
  ON processos_prazos(empresa_id, data_prazo) WHERE cumprido = false;

NOTIFY pgrst, 'reload schema';
