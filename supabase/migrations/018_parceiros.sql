-- Feature: Parceiros no Módulo de Comissões
-- Cria tabela de parceiros e vincula à tabela de comissões

CREATE TABLE IF NOT EXISTS parceiros_comissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  pix_tipo text CHECK (pix_tipo IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_chave text,
  banco_nome text,
  banco_agencia text,
  banco_conta text,
  observacoes text,
  ativo boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Adiciona coluna parceiro_id na tabela de comissões
ALTER TABLE comissoes_comercial
  ADD COLUMN IF NOT EXISTS parceiro_id uuid REFERENCES parceiros_comissao(id);

-- RLS para parceiros_comissao
ALTER TABLE parceiros_comissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_socio_all_parceiros_comissao" ON parceiros_comissao
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'socio'))
  );

CREATE POLICY "comercial_read_parceiros_comissao" ON parceiros_comissao
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'comercial')
  );

NOTIFY pgrst, 'reload schema';
