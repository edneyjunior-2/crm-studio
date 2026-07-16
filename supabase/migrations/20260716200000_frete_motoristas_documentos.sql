-- Módulo Frete/Logística — Stream 3: documentos do motorista (CNH) + OCR
-- Tabela de documentos vinculados a frete_motoristas (id, empresa_id, nome, cpf,
-- cnh_numero, cnh_categoria, cnh_validade, ...) criada pelo Stream 1 em paralelo.
--
-- NÃO APLICAR AUTOMATICAMENTE — migration a ser revisada/aplicada pelo Opus depois
-- que os 3 streams de frete convergirem (evita colisão de timestamp/ordem).

-- ---------------------------------------------------------------------------
-- 1. frete_motoristas_documentos
-- ---------------------------------------------------------------------------

CREATE TABLE public.frete_motoristas_documentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motorista_id  uuid NOT NULL REFERENCES public.frete_motoristas(id) ON DELETE CASCADE,
  tipo          text NOT NULL DEFAULT 'cnh',
  storage_path  text NOT NULL,
  mime_type     text,
  tamanho       integer,
  ocr_status    text NOT NULL DEFAULT 'pendente' CHECK (ocr_status IN ('pendente','processado','erro')),
  ocr_dados     jsonb,
  ocr_erro      text,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.frete_motoristas_documentos ENABLE ROW LEVEL SECURITY;

-- RLS RESTRICTIVE + 4 policies padrão — mesmo bloco usado no resto do módulo
-- frete (ver 20260625000002_modulo_obras.sql, padrão replicado pelo Stream 1
-- em frete_veiculos/frete_motoristas/frete_cotacoes).
CREATE POLICY tenant_isolation ON public.frete_motoristas_documentos AS RESTRICTIVE
  FOR ALL USING (empresa_id = current_empresa_id());

CREATE POLICY select_auth ON public.frete_motoristas_documentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_auth ON public.frete_motoristas_documentos
  FOR INSERT TO authenticated WITH CHECK (true);

-- update_auth é necessário aqui (diferente do GED de processos): o OCR síncrono
-- faz um UPDATE de ocr_status/ocr_dados/ocr_erro logo após o INSERT, na mesma
-- Server Action, usando o client do usuário autenticado.
CREATE POLICY update_auth ON public.frete_motoristas_documentos
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY delete_admin ON public.frete_motoristas_documentos
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE TRIGGER trg_set_empresa_frete_motoristas_documentos
  BEFORE INSERT ON public.frete_motoristas_documentos
  FOR EACH ROW EXECUTE FUNCTION set_empresa_id();

CREATE INDEX idx_frete_motoristas_documentos_empresa
  ON public.frete_motoristas_documentos(empresa_id);

CREATE INDEX idx_frete_motoristas_documentos_motorista
  ON public.frete_motoristas_documentos(motorista_id);

-- ---------------------------------------------------------------------------
-- 2. Bucket privado no Supabase Storage
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'frete-motoristas-docs',
  'frete-motoristas-docs',
  false,
  10485760, -- 10 MB
  -- PDF removido: o endpoint Vision usado (images:annotate) não rasteriza PDF
  -- (achado de review 2026-07-16, ver cnh-actions.ts).
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage — bucket privado, escopado por pasta/tenant
-- (path = <empresa_id>/<motorista_id>/<uuid>.<ext>). CORREÇÃO (review de
-- segurança 2026-07-16): a primeira versão desta migration só checava
-- bucket_id em INSERT/SELECT, sem escopar por empresa — isso permitia
-- qualquer usuário autenticado de QUALQUER tenant listar/baixar/subir
-- arquivo na pasta de outra empresa via chamada direta ao Storage
-- (bypass total do RLS da tabela frete_motoristas_documentos, que nunca é
-- consultada pelo endpoint de Storage). storage_path nunca é aceito do
-- client em leitura/delete — sempre resolvido a partir do banco — mas isso
-- não protege contra alguém chamando o Storage diretamente, por isso o
-- escopo por pasta abaixo é obrigatório, igual ao DELETE.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='frete_motoristas_docs_insert') THEN
    CREATE POLICY "frete_motoristas_docs_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'frete-motoristas-docs'
        AND (storage.foldername(name))[1] = current_empresa_id()::text
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='frete_motoristas_docs_select') THEN
    CREATE POLICY "frete_motoristas_docs_select"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'frete-motoristas-docs'
        AND (storage.foldername(name))[1] = current_empresa_id()::text
      );
  END IF;
  -- DELETE restrito por tenant (path = <empresa_id>/<motorista_id>/<uuid>.<ext>)
  -- + admin, mais estrito que o mínimo pedido na spec (nenhuma action desta
  -- spec exclui arquivo, mas a policy precisa existir antes de qualquer
  -- exclusão futura ser adicionada em outro stream).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='frete_motoristas_docs_delete') THEN
    CREATE POLICY "frete_motoristas_docs_delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'frete-motoristas-docs'
        AND (storage.foldername(name))[1] = current_empresa_id()::text
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
