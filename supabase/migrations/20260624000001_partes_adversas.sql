-- QW#5: Partes adversas (polo passivo + advogado adversário)
ALTER TABLE processos_juridicos
  ADD COLUMN IF NOT EXISTS polo_passivo_nome       TEXT,
  ADD COLUMN IF NOT EXISTS polo_passivo_cpf_cnpj   TEXT,
  ADD COLUMN IF NOT EXISTS advogado_adversario_nome TEXT,
  ADD COLUMN IF NOT EXISTS advogado_adversario_oab  TEXT;

NOTIFY pgrst, 'reload schema';
