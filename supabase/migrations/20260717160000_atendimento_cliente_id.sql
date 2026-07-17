-- Vincula conversas do Atendimento a um Cliente cadastrado.
--
-- `conversations` é tabela compartilhada com o app-sdr (empresa_id já foi
-- adicionado a ela via 20260619180000_clientes_sdr_agenda.sql). Esta coluna
-- deixa o Atendimento mostrar o nome do contato em vez do número cru, e
-- permite iniciar conversas a partir de um Cliente já cadastrado.
--
-- on delete set null (não cascade): excluir o Cliente não deve apagar o
-- histórico da conversa, só desvincular — ela volta a mostrar o número.

alter table public.conversations
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

create index if not exists idx_conversations_cliente on public.conversations(cliente_id);

notify pgrst, 'reload schema';
