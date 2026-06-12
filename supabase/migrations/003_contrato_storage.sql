-- Adiciona campo de URL do contrato na tabela parceiros
ALTER TABLE public.parceiros
  ADD COLUMN IF NOT EXISTS contrato_url text,
  ADD COLUMN IF NOT EXISTS contrato_nome text;

-- Bucket de contratos no Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contratos',
  'contratos',
  false,
  10485760,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- RLS do Storage
CREATE POLICY "contratos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contratos');

CREATE POLICY "contratos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos');

CREATE POLICY "contratos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contratos');

NOTIFY pgrst, 'reload schema';
