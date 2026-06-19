-- =============================================================================
-- Purga de contas canceladas (retenção 90 dias) — habilita o cascade.
--
-- Converte as 28 FKs ->empresas de NO ACTION para ON DELETE CASCADE (deletar a
-- empresa apaga TODOS os dados do tenant) e destrava os 5 RESTRICT do schema
-- (RESTRICT é checado imediatamente e travaria o cascade; vira NO ACTION, checado
-- no fim do statement, quando as linhas filhas já foram apagadas). Para exclusão
-- avulsa o efeito é o mesmo do RESTRICT (continua impedindo órfãos).
--
-- Só a PURGA (cron) deleta empresas; nenhum fluxo normal apaga empresa.
-- Idempotente (drop if exists) e transacional (tudo-ou-nada).
-- =============================================================================

begin;

alter table public.agenda_bloqueios drop constraint if exists agenda_bloqueios_empresa_id_fkey;
alter table public.agenda_bloqueios add constraint agenda_bloqueios_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.atividades drop constraint if exists atividades_empresa_id_fkey;
alter table public.atividades add constraint atividades_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.ausencias drop constraint if exists ausencias_empresa_id_fkey;
alter table public.ausencias add constraint ausencias_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.bancos drop constraint if exists bancos_empresa_id_fkey;
alter table public.bancos add constraint bancos_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.calendario_contatos drop constraint if exists calendario_contatos_empresa_id_fkey;
alter table public.calendario_contatos add constraint calendario_contatos_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.calendario_eventos drop constraint if exists calendario_eventos_empresa_id_fkey;
alter table public.calendario_eventos add constraint calendario_eventos_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.calendario_notas drop constraint if exists calendario_notas_empresa_id_fkey;
alter table public.calendario_notas add constraint calendario_notas_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.calendario_notificacoes drop constraint if exists calendario_notificacoes_empresa_id_fkey;
alter table public.calendario_notificacoes add constraint calendario_notificacoes_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.clientes drop constraint if exists clientes_empresa_id_fkey;
alter table public.clientes add constraint clientes_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.colaborador_documentos drop constraint if exists colaborador_documentos_empresa_id_fkey;
alter table public.colaborador_documentos add constraint colaborador_documentos_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.colaborador_documentos_acessos drop constraint if exists colaborador_documentos_acessos_empresa_id_fkey;
alter table public.colaborador_documentos_acessos add constraint colaborador_documentos_acessos_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.colaboradores drop constraint if exists colaboradores_empresa_id_fkey;
alter table public.colaboradores add constraint colaboradores_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.comissoes_comercial drop constraint if exists comissoes_comercial_empresa_id_fkey;
alter table public.comissoes_comercial add constraint comissoes_comercial_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.contas_pagar drop constraint if exists contas_pagar_empresa_id_fkey;
alter table public.contas_pagar add constraint contas_pagar_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.contas_receber drop constraint if exists contas_receber_empresa_id_fkey;
alter table public.contas_receber add constraint contas_receber_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.eventos_webhook drop constraint if exists eventos_webhook_empresa_id_fkey;
alter table public.eventos_webhook add constraint eventos_webhook_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.fluxo_cards drop constraint if exists fluxo_cards_empresa_id_fkey;
alter table public.fluxo_cards add constraint fluxo_cards_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.fluxo_colunas drop constraint if exists fluxo_colunas_empresa_id_fkey;
alter table public.fluxo_colunas add constraint fluxo_colunas_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.fluxos drop constraint if exists fluxos_empresa_id_fkey;
alter table public.fluxos add constraint fluxos_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.followups drop constraint if exists followups_empresa_id_fkey;
alter table public.followups add constraint followups_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.fornecedores drop constraint if exists fornecedores_empresa_id_fkey;
alter table public.fornecedores add constraint fornecedores_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.lancamentos_folha drop constraint if exists lancamentos_folha_empresa_id_fkey;
alter table public.lancamentos_folha add constraint lancamentos_folha_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.movimentacoes drop constraint if exists movimentacoes_empresa_id_fkey;
alter table public.movimentacoes add constraint movimentacoes_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.negocios drop constraint if exists negocios_empresa_id_fkey;
alter table public.negocios add constraint negocios_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.parceiros drop constraint if exists parceiros_empresa_id_fkey;
alter table public.parceiros add constraint parceiros_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.parceiros_comissao drop constraint if exists parceiros_comissao_empresa_id_fkey;
alter table public.parceiros_comissao add constraint parceiros_comissao_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.profiles drop constraint if exists profiles_empresa_id_fkey;
alter table public.profiles add constraint profiles_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.solucoes drop constraint if exists solucoes_empresa_id_fkey;
alter table public.solucoes add constraint solucoes_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;

-- Destrava os 5 RESTRICT (-> NO ACTION) que travariam o cascade:
alter table public.atividades drop constraint if exists atividades_responsavel_id_fkey;
alter table public.atividades add constraint atividades_responsavel_id_fkey foreign key (responsavel_id) references public.profiles(id);
alter table public.negocios drop constraint if exists negocios_responsavel_id_fkey;
alter table public.negocios add constraint negocios_responsavel_id_fkey foreign key (responsavel_id) references public.profiles(id);
alter table public.negocios drop constraint if exists negocios_cliente_id_fkey;
alter table public.negocios add constraint negocios_cliente_id_fkey foreign key (cliente_id) references public.clientes(id);
alter table public.negocios drop constraint if exists negocios_solucao_id_fkey;
alter table public.negocios add constraint negocios_solucao_id_fkey foreign key (solucao_id) references public.solucoes(id);
alter table public.movimentacoes drop constraint if exists movimentacoes_banco_id_fkey;
alter table public.movimentacoes add constraint movimentacoes_banco_id_fkey foreign key (banco_id) references public.bancos(id);

commit;

notify pgrst, 'reload schema';
