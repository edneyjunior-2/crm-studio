-- Flag de triagem: negócio auto-desqualificado pelo SDR (ou manualmente), aguardando
-- revisão humana. NÃO é um estágio do funil — some do Kanban e aparece só na 3ª aba
-- do Histórico. Ortogonal a pipeline_estagios.tipo (não dispara automação financeira).
alter table public.negocios
  add column if not exists desqualificado boolean not null default false;

-- Índice parcial: só as linhas desqualificadas (conjunto pequeno) — acelera a aba do histórico.
create index if not exists idx_negocios_desqualificado
  on public.negocios (empresa_id)
  where desqualificado = true;

notify pgrst, 'reload schema';
