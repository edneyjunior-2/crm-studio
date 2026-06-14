-- ============================================================================
-- CRM Studio — Módulo RH: Documentos de Colaboradores (LGPD-by-design)
-- ============================================================================
-- NÃO APLICAR AUTOMATICAMENTE — migration a ser aplicada pelo Opus após revisão.
--
-- CONTROLES DE LGPD IMPLEMENTADOS:
--
--   Art. 7º / Art. 11 (Base Legal):
--     Tabela `colaborador_documentos` com flag `sensivel` para dados de saúde/ASO.
--     Apenas admin acessa; base legal = cumprimento de obrigação legal (CLT) e
--     legítimo interesse do empregador.
--
--   Art. 46 (Segurança e Sigilo):
--     Bucket `rh-documentos` privado (public=false) no Supabase Storage.
--     RLS em `storage.objects` isola por empresa via path `<empresa_id>/...`.
--     URLs assinadas com expiração de 60 s (geradas na server action).
--     Anon sem acesso algum.
--
--   Art. 6º, inc. VIII (Accountability / Prestação de Contas):
--     Tabela de auditoria `colaborador_documentos_acessos` registra toda
--     operação de upload, download e deleção com user_id e timestamp.
--     RLS RESTRICTIVE por empresa_id.
--
--   Art. 9º (Direito de Acesso e Transparência):
--     Log de acesso permite ao controlador demonstrar quem acessou qual documento
--     e quando — base para resposta a titulares e autoridades (ANPD).
--
-- RETENÇÃO (a ser definida pelo controlador):
--     Expurgo automático NÃO foi implementado (fora do escopo M7).
--     O controlador (empresa-cliente) deve definir o prazo de retenção conforme
--     a legislação trabalhista (CLT, eSocial) e a LGPD (Art. 15).
-- ============================================================================

-- ============================================================================
-- 1) Tabela principal: colaborador_documentos
-- ============================================================================
-- Art. 7º/11: base legal registrada via tipo + flag sensivel.
-- Art. 46: storage_path aponta para objeto no bucket privado.
-- ============================================================================
create table if not exists public.colaborador_documentos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id),
  colaborador_id  uuid not null references public.colaboradores(id) on delete cascade,
  tipo            text not null,            -- ex: 'cnh', 'rg', 'aso', 'contrato', 'ferias', 'outro'
  nome_original   text not null,            -- nome do arquivo como veio do upload
  storage_path    text not null,            -- caminho completo: <empresa_id>/<colaborador_id>/<uuid>-<nome>
  sensivel        boolean not null default false,  -- true = dado pessoal sensível (saúde/ASO)
  mime            text,
  tamanho_bytes   bigint,
  uploaded_by     uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

alter table public.colaborador_documentos enable row level security;

create index if not exists idx_colabdoc_empresa
  on public.colaborador_documentos(empresa_id);
create index if not exists idx_colabdoc_colaborador
  on public.colaborador_documentos(colaborador_id);

-- Trigger: carimba empresa_id do usuário autenticado (anti-spoofing)
drop trigger if exists trg_set_empresa on public.colaborador_documentos;
create trigger trg_set_empresa
  before insert on public.colaborador_documentos
  for each row execute function public.set_empresa_id();

-- RLS RESTRICTIVE: isola por tenant
drop policy if exists tenant_isolation on public.colaborador_documentos;
create policy tenant_isolation on public.colaborador_documentos
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- RBAC PERMISSIVE: somente admin lê/escreve (RH = admin-only)
drop policy if exists admin_only on public.colaborador_documentos;
create policy admin_only on public.colaborador_documentos
  as permissive for all
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ============================================================================
-- 2) Bucket privado no Supabase Storage
--    Art. 46: armazenamento seguro, sem acesso público.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rh-documentos',
  'rh-documentos',
  false,                                    -- privado: sem URL pública
  52428800,                                 -- 50 MB por arquivo
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- Revogar acesso de anon ao bucket (Art. 46)
revoke all on storage.buckets from anon;

-- ============================================================================
-- 3) RLS em storage.objects — isolamento por empresa_id no path
--    Art. 46: acesso ao Storage somente por admin da empresa dona do path.
--    Path esperado: <empresa_id>/<colaborador_id>/<uuid>-<nome_original>
--    (storage.foldername(name))[1] = primeiro segmento = empresa_id
-- ============================================================================

-- SELECT (download via signed URL server-side — anon sem acesso)
drop policy if exists rh_docs_select on storage.objects;
create policy rh_docs_select on storage.objects
  as permissive for select
  to authenticated
  using (
    bucket_id = 'rh-documentos'
    and (storage.foldername(name))[1] = public.current_empresa_id()::text
    and public.get_my_role() = 'admin'
  );

-- INSERT (upload)
drop policy if exists rh_docs_insert on storage.objects;
create policy rh_docs_insert on storage.objects
  as permissive for insert
  to authenticated
  with check (
    bucket_id = 'rh-documentos'
    and (storage.foldername(name))[1] = public.current_empresa_id()::text
    and public.get_my_role() = 'admin'
  );

-- UPDATE (não utilizado diretamente, mas RLS deve existir)
drop policy if exists rh_docs_update on storage.objects;
create policy rh_docs_update on storage.objects
  as permissive for update
  to authenticated
  using (
    bucket_id = 'rh-documentos'
    and (storage.foldername(name))[1] = public.current_empresa_id()::text
    and public.get_my_role() = 'admin'
  )
  with check (
    bucket_id = 'rh-documentos'
    and (storage.foldername(name))[1] = public.current_empresa_id()::text
    and public.get_my_role() = 'admin'
  );

-- DELETE
drop policy if exists rh_docs_delete on storage.objects;
create policy rh_docs_delete on storage.objects
  as permissive for delete
  to authenticated
  using (
    bucket_id = 'rh-documentos'
    and (storage.foldername(name))[1] = public.current_empresa_id()::text
    and public.get_my_role() = 'admin'
  );

-- Bloquear anon completamente
drop policy if exists rh_docs_anon_deny on storage.objects;
create policy rh_docs_anon_deny on storage.objects
  as restrictive for all
  to anon
  using (false);

-- ============================================================================
-- 4) Log de auditoria de acesso a documentos
--    Art. 6º inc. VIII (Accountability): registro de quem acessou, quando e como.
--    Art. 9º (Transparência): base para resposta a titulares e ANPD.
-- ============================================================================
create table if not exists public.colaborador_documentos_acessos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id),
  documento_id uuid not null references public.colaborador_documentos(id) on delete cascade,
  acao         text not null
                 check (acao in ('upload', 'download', 'delete')),
  user_id      uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

alter table public.colaborador_documentos_acessos enable row level security;

create index if not exists idx_colabdoc_acessos_empresa
  on public.colaborador_documentos_acessos(empresa_id);
create index if not exists idx_colabdoc_acessos_documento
  on public.colaborador_documentos_acessos(documento_id);
create index if not exists idx_colabdoc_acessos_user
  on public.colaborador_documentos_acessos(user_id);

-- Trigger: carimba empresa_id
drop trigger if exists trg_set_empresa on public.colaborador_documentos_acessos;
create trigger trg_set_empresa
  before insert on public.colaborador_documentos_acessos
  for each row execute function public.set_empresa_id();

-- RLS RESTRICTIVE: isola por tenant
drop policy if exists tenant_isolation on public.colaborador_documentos_acessos;
create policy tenant_isolation on public.colaborador_documentos_acessos
  as restrictive for all
  using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- RBAC PERMISSIVE: admin pode ler e inserir (a deleção é proibida — imutabilidade do log)
drop policy if exists admin_select on public.colaborador_documentos_acessos;
create policy admin_select on public.colaborador_documentos_acessos
  as permissive for select
  using (public.get_my_role() = 'admin');

drop policy if exists admin_insert on public.colaborador_documentos_acessos;
create policy admin_insert on public.colaborador_documentos_acessos
  as permissive for insert
  with check (public.get_my_role() = 'admin');

-- ============================================================================
-- Notifica o PostgREST para recarregar o schema
-- ============================================================================
notify pgrst, 'reload schema';
