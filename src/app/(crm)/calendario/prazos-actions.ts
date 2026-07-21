'use server'

// Actions da aba agregada de Prazos do Calendário (visão cross-processo,
// escopada por empresa via listarPrazosEmpresa em src/lib/processos-prazos-calendario.ts).
// Co-localizadas aqui (não dentro de processos/[id]/) pelo mesmo motivo já
// documentado em processos-prazos-calendario.ts: evitar acoplar o módulo
// Calendário ao módulo Processos, que é lane de outro stream em paralelo.
//
// Estilo (auth check, retorno `{ error? }`, uso de revalidatePath) copiado de
// processos/[id]/prazos-actions.ts — não importado de lá, só o padrão reaproveitado.
//
// RLS (já existente, sem migration nova — ver
// supabase/migrations/20260624000003_processos_prazos.sql e
// 20260707140000_acesso_parceiro.sql):
//   - tenant_isolation (RESTRICTIVE, todas operações): empresa_id = current_empresa_id()
//   - update_auth: PERMISSIVE para qualquer autenticado não-parceiro
//   - delete_admin: RESTRICTIVE a role = 'admin' (não ampliar — UI esconde o botão
//     de excluir para não-admin; a action ainda depende da RLS como última barreira)
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function atualizarPrazoCalendario(
  prazoId: string,
  descricao: string,
  dataPrazo: string, // 'YYYY-MM-DD'
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }
  if (!descricao.trim() || !dataPrazo) return { error: 'Descrição e data são obrigatórios.' }

  const { data, error } = await supabase
    .from('processos_prazos')
    .update({ descricao: descricao.trim(), data_prazo: dataPrazo })
    .eq('id', prazoId)
    .select('id, processo_id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Prazo não encontrado ou sem permissão.' }

  revalidatePath('/calendario')
  revalidatePath(`/processos/${data[0].processo_id}`)
  return {}
}

export async function excluirPrazoCalendario(prazoId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase
    .from('processos_prazos')
    .delete()
    .eq('id', prazoId)
    .select('id, processo_id')

  if (error) return { error: error.message }
  // RLS admin-only (delete_admin): 0 linhas afetadas = sem permissão (usuário
  // não-admin conseguiu chamar a action apesar do botão escondido, ou tentou
  // via devtools) — mesma mensagem de processos/[id]/prazos-actions.ts.
  if (!data?.length) return { error: 'Apenas administradores podem excluir prazos.' }

  revalidatePath('/calendario')
  revalidatePath(`/processos/${data[0].processo_id}`)
  return {}
}

export async function marcarPrazoCalendarioCumprido(
  prazoId: string,
  cumprido: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase
    .from('processos_prazos')
    .update({ cumprido })
    .eq('id', prazoId)
    .select('id, processo_id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Prazo não encontrado ou sem permissão.' }

  revalidatePath('/calendario')
  revalidatePath(`/processos/${data[0].processo_id}`)
  return {}
}
