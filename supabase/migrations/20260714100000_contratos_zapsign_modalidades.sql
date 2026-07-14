-- Troca o nível binário (avançada/qualificada) por modalidades explícitas que
-- o admin escolhe por empresa: 3 gratuitas (simples/email/sms) + qualificada
-- (paga, ICP-Brasil, mantida por decisão deliberada pra advocacia). Nenhuma
-- modalidade paga além de qualificada é exposta (sem WhatsApp, sem biometria)
-- — decisão do dono em 2026-07-14. Ver spec
-- .claude/specs/contratos-assinatura-zapsign.md.

alter table public.contratos_gerados
  drop constraint if exists contratos_gerados_zapsign_nivel_check;

alter table public.contratos_gerados
  add constraint contratos_gerados_zapsign_nivel_check
    check (zapsign_nivel in ('simples', 'email', 'sms', 'qualificada'));

notify pgrst, 'reload schema';
