CREATE TABLE IF NOT EXISTS followups (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  negocio_id      uuid REFERENCES negocios(id) ON DELETE CASCADE,
  responsavel_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  tipo            text NOT NULL DEFAULT 'd3',   -- 'd3' | 'd7'
  data_agendada   date NOT NULL,
  status          text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'concluido' | 'cancelado'
  observacao      text,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE followups ENABLE ROW LEVEL SECURITY;

-- Admin e sócio veem todos
CREATE POLICY "admin_socio_followups_all" ON followups
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'socio'))
  );

-- Comercial vê apenas os próprios
CREATE POLICY "comercial_followups_own" ON followups
  FOR ALL USING (
    auth.uid() = responsavel_id
    AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'comercial')
  );
