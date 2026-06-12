ALTER TABLE negocios ADD COLUMN IF NOT EXISTS motivo_perda text;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS estagio_atualizado_em timestamptz DEFAULT now();

-- Trigger para atualizar estagio_atualizado_em quando estagio muda
CREATE OR REPLACE FUNCTION update_estagio_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estagio IS DISTINCT FROM OLD.estagio THEN
    NEW.estagio_atualizado_em = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_estagio_atualizado_em ON negocios;
CREATE TRIGGER trigger_estagio_atualizado_em
  BEFORE UPDATE ON negocios
  FOR EACH ROW EXECUTE FUNCTION update_estagio_atualizado_em();

NOTIFY pgrst, 'reload schema';
