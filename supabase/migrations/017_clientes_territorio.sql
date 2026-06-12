-- Feature: Bloqueio de Território por CNPJ
-- Adiciona campos de território na tabela clientes

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS area_tipo text DEFAULT 'publica' CHECK (area_tipo IN ('publica', 'privada')),
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS responsavel_desde timestamptz DEFAULT now();

-- Popular responsavel_id com created_by para registros existentes
UPDATE clientes SET responsavel_id = created_by WHERE responsavel_id IS NULL;
UPDATE clientes SET responsavel_desde = created_at WHERE responsavel_desde IS NULL;

NOTIFY pgrst, 'reload schema';
