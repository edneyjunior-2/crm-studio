-- Adiciona campo 'cargo' na tabela profiles
-- Usado para identificar o cargo/função do usuário no escritório
-- Ex: Advogado, Sócio, Estagiário, Paralegal, Analista Jurídico
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cargo TEXT;

-- Notifica PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
