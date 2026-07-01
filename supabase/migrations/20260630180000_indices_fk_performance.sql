-- Índices em FKs de negócio usadas em join/filtro/embed (performance).
-- Pula created_by (auditoria) e schemas auth/storage (gerenciados pelo Supabase).
create index if not exists idx_followups_negocio          on public.followups (negocio_id);
create index if not exists idx_followups_responsavel       on public.followups (responsavel_id);
create index if not exists idx_negocios_parceiro           on public.negocios (parceiro_id);
create index if not exists idx_negocios_indicado_por       on public.negocios (indicado_por);
create index if not exists idx_clientes_responsavel        on public.clientes (responsavel_id);
create index if not exists idx_clientes_parceiro           on public.clientes (parceiro_id);
create index if not exists idx_clientes_indicado_por       on public.clientes (indicado_por);
create index if not exists idx_negocio_produtos_solucao    on public.negocio_produtos (solucao_id);
create index if not exists idx_movimentacoes_conta_pagar   on public.movimentacoes (conta_pagar_id);
create index if not exists idx_movimentacoes_conta_receber on public.movimentacoes (conta_receber_id);
create index if not exists idx_obras_medicoes_orcamento    on public.obras_medicoes (orcamento_id);
create index if not exists idx_orcamentos_cliente          on public.orcamentos (cliente_id);
create index if not exists idx_processos_cliente           on public.processos_juridicos (cliente_id);
create index if not exists idx_processos_advogado          on public.processos_juridicos (advogado_id);
create index if not exists idx_processos_prazos_resp       on public.processos_prazos (responsavel_id);
create index if not exists idx_comissoes_parceiro          on public.comissoes_comercial (parceiro_id);
create index if not exists idx_contas_pagar_fornecedor     on public.contas_pagar (fornecedor_id);
create index if not exists idx_obras_responsavel           on public.obras (responsavel_id);
create index if not exists idx_calendario_eventos_organizer on public.calendario_eventos (organizer_user_id);

notify pgrst, 'reload schema';
