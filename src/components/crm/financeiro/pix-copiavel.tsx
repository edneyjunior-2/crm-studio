'use client'

import { useState } from 'react'
import { QrCode, Copy, Check } from 'lucide-react'

const PIX_TIPO_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave Aleatória',
}

interface PixCopiavelProps {
  tipo: string | null
  chave: string
}

export function PixCopiavel({ tipo, chave }: PixCopiavelProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(chave).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 hover:bg-blue-100 transition-colors cursor-pointer"
    >
      <QrCode className="size-3 shrink-0" />
      {tipo ? `${PIX_TIPO_LABELS[tipo] ?? tipo}: ` : ''}
      <span className="font-mono">{chave}</span>
      {copied
        ? <Check className="size-3 shrink-0 text-emerald-600" />
        : <Copy className="size-3 shrink-0 opacity-50" />}
    </button>
  )
}
