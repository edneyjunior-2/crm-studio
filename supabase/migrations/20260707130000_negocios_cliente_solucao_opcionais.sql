-- Feature: obrigatórios configuráveis do pipeline (negocio-form) — permite criar
-- um negócio "lead rápido" (só título) quando a empresa desliga exige_cliente
-- e/ou exige_produto em empresas.config.pipeline (ver src/lib/pipeline-config.ts
-- e src/app/(crm)/configuracoes/pipeline-config-actions.ts).
--
-- negocios.cliente_id e negocios.solucao_id são NOT NULL desde o schema original
-- (001_initial_schema.sql) — isso bloqueia a gravação de um negócio sem
-- cliente/produto mesmo com os flags desligados na UI (o INSERT falha com
-- 23502 "null value in column ... violates not-null constraint"). Relaxa para
-- NULLABLE, mantendo as FKs (negocios_cliente_id_fkey / negocios_solucao_id_fkey)
-- intactas — um negócio com cliente_id/solucao_id preenchido continua exigindo
-- que a referência exista.
--
-- NÃO relaxa responsavel_id: createNegocio/updateNegocio sempre resolvem um
-- responsável (o escolhido, validado contra o tenant, ou o criador como
-- fallback) antes de gravar — a coluna nunca recebe NULL.
--
-- ATENÇÃO — esta migration foi ESCRITA mas NÃO APLICADA por este agente (fora
-- do escopo da tarefa). Até ser aplicada no banco, criar um negócio com
-- exige_cliente=false ou exige_produto=false e deixar o campo vazio falha com
-- o erro de not-null acima (a UI mostra a mensagem crua do Postgres). Revisar
-- e aplicar antes de liberar a Feature A/B da spec pipeline-config-negocio.

alter table public.negocios alter column cliente_id drop not null;
alter table public.negocios alter column solucao_id drop not null;

notify pgrst, 'reload schema';
