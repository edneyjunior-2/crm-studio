-- Foto de perfil do usuário — coluna + bucket de Storage.
--
-- Guarda apenas o PATH interno do Storage (avatar_path), nunca uma URL
-- pública direta: o bucket é privado (mesmo padrão de timbrados/
-- frete-motoristas-docs/processos-docs) e a URL é sempre resolvida sob
-- demanda via createSignedUrl (ver src/lib/avatar.ts). Isso permite trocar de
-- bucket/CDN sem migração e evita expor um link permanente e não-revogável.
--
-- Path do objeto: <empresa_id>/<user_id>/<uuid>.<ext> — o 1º nível de pasta
-- isola por tenant (leitura liberada pra colegas da mesma empresa, igual à
-- regra de tenant_isolation_profiles), o 2º nível restringe upload/troca ao
-- próprio dono do avatar.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text;

-- ---------------------------------------------------------------------------
-- Bucket privado no Supabase Storage
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false,
  3145728, -- 3 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas do Storage — escopo por pasta (path = <empresa_id>/<user_id>/<uuid>.<ext>).
-- SELECT liberado pra qualquer colega autenticado da mesma empresa (o avatar
-- é dado sensível-leve, não documento privado). INSERT/UPDATE/DELETE restrito
-- ao próprio usuário dono do avatar, dentro da própria empresa.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_select') THEN
    CREATE POLICY "avatars_select"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = current_empresa_id()::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_insert') THEN
    CREATE POLICY "avatars_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = current_empresa_id()::text
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_update') THEN
    CREATE POLICY "avatars_update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = current_empresa_id()::text
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = current_empresa_id()::text
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;

  -- DELETE: usado pela troca de foto (remove o arquivo anterior e, em caso de
  -- falha no UPDATE de profiles, o próprio arquivo recém-subido — órfão).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_delete') THEN
    CREATE POLICY "avatars_delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = current_empresa_id()::text
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
