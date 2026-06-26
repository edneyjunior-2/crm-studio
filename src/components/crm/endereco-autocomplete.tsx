'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { MapPin, Loader2 } from 'lucide-react'

export interface EnderecoSelecionado {
  endereco: string
  cidade:   string
  estado:   string
  cep:      string
}

interface Props {
  onSelect:    (dados: EnderecoSelecionado) => void
  placeholder?: string
  className?:   string
}

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export function EnderecoAutocomplete({ onSelect, placeholder = 'Buscar endereço no Google…', className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef    = useRef<google.maps.places.Autocomplete | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready,   setReady]   = useState(false)

  useEffect(() => {
    if (!MAPS_KEY) return

    setLoading(true)
    setOptions({ key: MAPS_KEY, v: 'weekly', language: 'pt-BR', region: 'BR' })

    importLibrary('places').then((placesLib) => {
      if (!inputRef.current) return

      const { Autocomplete } = placesLib as google.maps.PlacesLibrary
      const ac = new Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'br' },
        fields: ['address_components'],
      })
      acRef.current = ac

      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (!place.address_components) return

        let numero = ''
        let rua    = ''
        let cidade = ''
        let estado = ''
        let cep    = ''

        for (const comp of place.address_components) {
          const types = comp.types
          if (types.includes('street_number'))               numero = comp.long_name
          if (types.includes('route'))                       rua    = comp.long_name
          if (types.includes('locality'))                    cidade = comp.long_name
          if (types.includes('administrative_area_level_1')) estado = comp.short_name
          if (types.includes('postal_code'))                 cep    = comp.long_name.replace('-', '')
        }

        onSelect({
          endereco: [rua, numero].filter(Boolean).join(', '),
          cidade,
          estado,
          cep,
        })
      })

      setReady(true)
      setLoading(false)
    }).catch(() => setLoading(false))

    return () => {
      if (acRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(acRef.current)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!MAPS_KEY) return null

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        disabled={!ready && loading}
        className={`w-full rounded-lg border border-dashed border-primary/40 bg-primary/5 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 disabled:opacity-50 ${className ?? ''}`}
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
