/** Máscaras de documento (CNPJ/CPF) — mesmo espírito do formatBRLInput usado
 * nos campos de valor: formata PROGRESSIVAMENTE enquanto o usuário digita. */

export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '')
}

/** '53322759000157' (ou parcial) -> '53.322.759/0001-57' */
export function formatCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  let out = d
  out = out.replace(/^(\d{2})(\d)/, '$1.$2')
  out = out.replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
  out = out.replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, '$1/$2')
  out = out.replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, '$1-$2')
  return out
}

/** '12345678900' (ou parcial) -> '123.456.789-00' */
export function formatCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  let out = d
  out = out.replace(/^(\d{3})(\d)/, '$1.$2')
  out = out.replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
  out = out.replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2')
  return out
}

/** Para exibição quando não se sabe se é CPF ou CNPJ (conta os dígitos). */
export function formatDocumento(value: string): string {
  const d = onlyDigits(value)
  if (d.length > 11) return formatCNPJ(d)
  if (d.length > 0) return formatCPF(d)
  return value ?? ''
}
