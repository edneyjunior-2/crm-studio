-- Perf/LGPD: 8 tabelas multi-tenant com FK empresa_id SEM índice → seq scan no
-- cascade de purga de empresa e em filtros por tenant. Adiciona os índices.

create index if not exists idx_eventos_webhook_empresa            on public.eventos_webhook(empresa_id);
create index if not exists idx_movimentacoes_processo_empresa     on public.movimentacoes_processo(empresa_id);
create index if not exists idx_mov_internas_processo_empresa      on public.movimentacoes_internas_processo(empresa_id);
create index if not exists idx_processos_documentos_empresa       on public.processos_documentos(empresa_id);
create index if not exists idx_obras_etapas_empresa               on public.obras_etapas(empresa_id);
create index if not exists idx_obras_medicoes_empresa             on public.obras_medicoes(empresa_id);
create index if not exists idx_orcamento_itens_empresa            on public.orcamento_itens(empresa_id);
create index if not exists idx_bug_reports_empresa                on public.bug_reports(empresa_id);

notify pgrst, 'reload schema';
