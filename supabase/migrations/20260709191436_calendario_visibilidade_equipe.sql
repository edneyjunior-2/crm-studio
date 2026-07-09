-- Feature: toggle "Visível para a equipe" no popup de Novo Evento do calendário,
-- e migração da criação de evento do mecanismo DWD quebrado (nunca configurado em
-- produção) para o mecanismo OAuth por usuário (já funcionando). calendario_eventos
-- passa a ser a fonte de dados de leitura da tela /calendario, não só uma tabela
-- de tracking para autorização/notificações.

alter table calendario_eventos
  alter column calendar_id drop not null,
  add column descricao text,
  add column data_inicio timestamptz,
  add column data_fim timestamptz,
  add column visivel_equipe boolean not null default false,
  add column meet_link text;

-- data_inicio/data_fim são nullable de propósito: src/app/(crm)/processos/[id]/actions.ts
-- também insere em calendario_eventos (fluxo de audiências/prazos) sem preencher essas
-- colunas — not null quebraria esse insert existente. Linhas com data_inicio nula
-- simplesmente não aparecem no filtro de intervalo de datas da tela /calendario.

-- Antes: só o organizador via o próprio evento. Agora: organizador sempre vê; demais
-- membros da mesma empresa veem se visivel_equipe = true. Isolamento entre empresas
-- continua garantido pela policy RESTRICTIVE "tenant_isolation" (empresa_id =
-- current_empresa_id()), que já existe e não é tocada aqui — o efeito combinado é
-- (organizador OU visivel_equipe) E (mesma empresa).
drop policy calendario_eventos_select on calendario_eventos;
create policy calendario_eventos_select on calendario_eventos
  for select to authenticated
  using (auth.uid() = organizer_user_id or visivel_equipe = true);
