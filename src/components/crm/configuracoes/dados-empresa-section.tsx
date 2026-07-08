'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  salvarDadosEmpresa,
  salvarTimbrado,
  removerTimbrado,
  obterTimbradoAtual,
} from '@/app/(crm)/configuracoes/actions'
import { formatCNPJ } from '@/lib/masks'

interface DadosEmpresaSectionProps {
  nomeFantasia: string | null
  razaoSocial: string | null
  cnpj: string | null
}

export function DadosEmpresaSection({
  nomeFantasia,
  razaoSocial,
  cnpj,
}: DadosEmpresaSectionProps) {
  const [nomeFant, setNomeFant] = useState(nomeFantasia ?? '')
  const [razao, setRazao] = useState(razaoSocial ?? '')
  const [cnpjVal, setCnpjVal] = useState(cnpj ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startTransition(async () => {
      const result = await salvarDadosEmpresa({
        nome_fantasia: nomeFant || null,
        razao_social:  razao    || null,
        cnpj:          cnpjVal  || null,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Dados da empresa salvos com sucesso.')
    })
  }

  // Timbrado (cabeçalho institucional dos documentos). A seção auto-busca a
  // URL atual via server action — configuracoes/page.tsx não passa prop pra
  // isso (fora da lane desta spec).
  const [timbradoUrl, setTimbradoUrl] = useState<string | null>(null)
  const [carregandoTimbrado, setCarregandoTimbrado] = useState(true)
  const [isPendingTimbrado, startTimbradoTransition] = useTransition()
  const timbradoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ativo = true
    obterTimbradoAtual()
      .then((res) => {
        if (ativo) setTimbradoUrl(res.url)
      })
      .finally(() => {
        if (ativo) setCarregandoTimbrado(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  function handleTimbradoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const file = timbradoInputRef.current?.files?.[0]
    if (!file) {
      toast.error('Selecione um arquivo PNG ou JPG.')
      return
    }
    const formData = new FormData()
    formData.set('timbrado', file)
    startTimbradoTransition(async () => {
      const result = await salvarTimbrado(formData)
      if (timbradoInputRef.current) timbradoInputRef.current.value = ''
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Timbrado salvo.')
      const atualizado = await obterTimbradoAtual()
      setTimbradoUrl(atualizado.url)
    })
  }

  function handleRemoverTimbrado() {
    startTimbradoTransition(async () => {
      const result = await removerTimbrado()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setTimbradoUrl(null)
      toast.success('Timbrado removido.')
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-4 text-muted-foreground" />
          <h3 className="text-base font-medium text-foreground">Dados da empresa</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Estas informações aparecem nos documentos gerados (orçamentos, contratos etc.).
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
              <Input
                id="nome_fantasia"
                value={nomeFant}
                onChange={(e) => setNomeFant(e.target.value)}
                placeholder="Como sua empresa é conhecida"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="razao_social">Razão Social <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="razao_social"
                value={razao}
                onChange={(e) => setRazao(e.target.value)}
                placeholder="Razão Social Ltda."
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cnpj">CNPJ <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="cnpj"
                value={cnpjVal}
                onChange={(e) => setCnpjVal(formatCNPJ(e.target.value))}
                placeholder="00.000.000/0001-00"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isPending ? 'Salvando…' : 'Salvar dados'}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="text-sm font-medium text-foreground">Timbrado (cabeçalho dos documentos)</h4>
            <p className="text-xs text-muted-foreground">
              Imagem que aparece no topo de todos os documentos exportados (orçamentos, extratos).
              PNG ou JPG, até 2 MB. Recomendado: faixa horizontal (ex.: 1200×200).
            </p>
          </div>

          {carregandoTimbrado ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              {timbradoUrl && (
                <div className="flex flex-col gap-2">
                  {/* Preview do timbrado: vem de signed URL do Supabase Storage (bucket privado) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={timbradoUrl}
                    alt="Timbrado atual"
                    className="max-h-24 max-w-full rounded-lg border border-border object-contain"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={isPendingTimbrado}
                    onClick={handleRemoverTimbrado}
                  >
                    {isPendingTimbrado && <Loader2 className="size-4 animate-spin" />}
                    Remover
                  </Button>
                </div>
              )}

              <form onSubmit={handleTimbradoSubmit} className="flex flex-col gap-2 sm:max-w-xs">
                <Label htmlFor="timbrado">Arquivo (PNG ou JPG, até 2 MB)</Label>
                <Input
                  ref={timbradoInputRef}
                  id="timbrado"
                  name="timbrado"
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={isPendingTimbrado}
                />
                <Button type="submit" size="sm" className="w-fit" disabled={isPendingTimbrado}>
                  {isPendingTimbrado && <Loader2 className="size-4 animate-spin" />}
                  {timbradoUrl ? 'Trocar timbrado' : 'Enviar timbrado'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
