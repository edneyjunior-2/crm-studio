-- QW#3: GED básico — documentos vinculados ao processo
CREATE TABLE IF NOT EXISTS processos_documentos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id  uuid NOT NULL REFERENCES processos_juridicos(id) ON DELETE CASCADE,
  empresa_id   uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  autor_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  nome         text NOT NULL,
  storage_path text NOT NULL,
  mime_type    text,
  tamanho      bigint,
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE processos_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON processos_documentos AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON processos_documentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON processos_documentos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY delete_own_or_admin ON processos_documentos
  FOR DELETE USING (
    autor_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_docs
  BEFORE INSERT ON processos_documentos
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX IF NOT EXISTS idx_processos_docs_processo
  ON processos_documentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_processos_docs_created
  ON processos_documentos(created_at DESC);

-- Bucket de Storage (Supabase Storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'processos-docs',
  'processos-docs',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage (todos autenticados podem subir e ler; só dono/admin exclui)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='processos_docs_insert') THEN
    CREATE POLICY "processos_docs_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'processos-docs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='processos_docs_select') THEN
    CREATE POLICY "processos_docs_select"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'processos-docs');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='processos_docs_delete') THEN
    CREATE POLICY "processos_docs_delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'processos-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
