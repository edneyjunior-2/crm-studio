import type { Moeda } from '@/types'

export const MOEDAS: { value: Moeda; label: string; simbolo: string; flag: string }[] = [
  { value: 'BRL', label: 'Real Brasileiro',  simbolo: 'R$', flag: '🇧🇷' },
  { value: 'USD', label: 'Dólar Americano',  simbolo: '$',  flag: '🇺🇸' },
  { value: 'EUR', label: 'Euro',             simbolo: '€',  flag: '🇪🇺' },
  { value: 'GBP', label: 'Libra Esterlina',  simbolo: '£',  flag: '🇬🇧' },
  { value: 'ARS', label: 'Peso Argentino',   simbolo: '$',  flag: '🇦🇷' },
]

const LOCALE: Record<Moeda, string> = {
  BRL: 'pt-BR',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  ARS: 'es-AR',
}

export function formatMoeda(valor: number, moeda: Moeda = 'BRL'): string {
  return new Intl.NumberFormat(LOCALE[moeda], {
    style: 'currency',
    currency: moeda,
  }).format(valor)
}

