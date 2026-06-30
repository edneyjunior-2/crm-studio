'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { NegocioProduto } from '@/types'

export async function getNegocioProdutos(negocioId: string): Promise<NegocioProduto[]> {
  const supabase = await createClient()
  const auth = await getAuthUser()
  if (!auth.user) redirect('/login')

  const { data, error } = await supabase
    .from('negocio_produtos')
    .select('*')
    .eq('negocio_id', negocioId)
    .order('ordem', { ascending: true })

  if (error) return []
  return (data ?? []) as NegocioProduto[]
}
