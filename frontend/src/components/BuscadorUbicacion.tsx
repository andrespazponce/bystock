/**
 * BuscadorUbicacion
 *
 * Buscador de ubicaciones usando Nominatim (OpenStreetMap).
 * 100% gratuito, sin API key, restringido a Bolivia.
 *
 * Al seleccionar un resultado, llama a `onSeleccionar` con los datos
 * de ubicación extraídos: dirección, ciudad, departamento, lat, lng.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { DEPARTAMENTOS_BOLIVIA } from '../api/activos'

export interface DatosUbicacion {
  direccion: string
  ciudad: string
  departamento: string
  latitud: string
  longitud: string
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    suburb?: string
    neighbourhood?: string
    state?: string
    province?: string
    road?: string
    country?: string
  }
}

interface Props {
  onSeleccionar: (datos: DatosUbicacion) => void
}

/** Normaliza el nombre del departamento retornado por Nominatim. */
function normalizarDepartamento(raw: string | undefined): string {
  if (!raw) return ''
  const limpio = raw
    .replace(/^Departamento de /i, '')
    .replace(/^Depto\. de /i, '')
    .trim()
  return DEPARTAMENTOS_BOLIVIA.find(
    d =>
      d.toLowerCase() === limpio.toLowerCase() ||
      limpio.toLowerCase().includes(d.toLowerCase()) ||
      d.toLowerCase().includes(limpio.toLowerCase()),
  ) ?? limpio
}

/** Extrae ciudad, departamento y dirección limpia de un resultado de Nominatim. */
function extraerDatos(r: NominatimResult): DatosUbicacion {
  const a = r.address

  // Ciudad: prefiere city > town > village > municipality > suburb
  const ciudad = a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? ''

  // Departamento
  const departamento = normalizarDepartamento(a.state ?? a.province)

  // Dirección: display_name de Nominatim es muy verbosa (incluye país, etc.)
  // Tomamos solo la parte antes de ", Bolivia" para que quede más limpia
  const direccion = r.display_name.replace(/,\s*Bolivia$/i, '').trim()

  return {
    direccion,
    ciudad,
    departamento,
    latitud: r.lat,
    longitud: r.lon,
  }
}

const DEBOUNCE_MS = 450
const MIN_CHARS = 3

export default function BuscadorUbicacion({ onSeleccionar }: Props) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<NominatimResult[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [seleccionado, setSeleccionado] = useState('')
  const [error, setError] = useState<string | null>(null)

  const contenedorRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controlRef = useRef<AbortController | null>(null)

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  const buscar = useCallback(async (texto: string) => {
    if (texto.length < MIN_CHARS) {
      setResultados([])
      setAbierto(false)
      return
    }

    // Cancelar petición anterior si sigue en vuelo
    controlRef.current?.abort()
    controlRef.current = new AbortController()

    setBuscando(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        q: texto,
        countrycodes: 'bo',
        format: 'json',
        addressdetails: '1',
        limit: '6',
        'accept-language': 'es',
      })
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          signal: controlRef.current.signal,
          headers: { 'Accept-Language': 'es' },
        },
      )
      if (!res.ok) throw new Error('Error de red')
      const data: NominatimResult[] = await res.json()
      setResultados(data)
      setAbierto(data.length > 0)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('No se pudo conectar con el servicio de búsqueda.')
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    setSeleccionado('')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(v), DEBOUNCE_MS)
  }

  function handleSeleccionar(r: NominatimResult) {
    const datos = extraerDatos(r)
    setQuery(r.display_name.split(',')[0]) // muestra solo el nombre del lugar
    setSeleccionado(r.display_name.split(',')[0])
    setAbierto(false)
    setResultados([])
    onSeleccionar(datos)
  }

  function handleLimpiar() {
    setQuery('')
    setSeleccionado('')
    setResultados([])
    setAbierto(false)
    setError(null)
  }

  return (
    <div ref={contenedorRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>

      {/* Input de búsqueda */}
      <div style={{ position: 'relative' }}>
        {/* Ícono lupa */}
        <svg
          width={15} height={15}
          viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: 'absolute', left: '0.75rem', top: '50%',
            transform: 'translateY(-50%)',
            color: buscando ? 'var(--gold)' : 'var(--text-muted)',
            pointerEvents: 'none',
            transition: 'color 0.2s',
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          className="input"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (resultados.length > 0) setAbierto(true) }}
          placeholder="Buscar dirección, barrio, lugar…"
          autoComplete="off"
          style={{ paddingLeft: '2.25rem', paddingRight: query ? '2.2rem' : undefined }}
        />

        {/* Botón limpiar */}
        {query && (
          <button
            type="button"
            onClick={handleLimpiar}
            style={{
              position: 'absolute', right: '0.5rem', top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '1.15rem',
              lineHeight: 1, padding: '0.2rem 0.3rem',
            }}
            title="Limpiar"
          >
            ×
          </button>
        )}

        {/* Dropdown de resultados */}
        {abierto && resultados.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0, right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
              zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            {resultados.map((r, i) => {
              const partes = r.display_name.split(', ')
              const nombre = partes[0]
              const detalle = partes.slice(1).join(', ').replace(/,?\s*Bolivia$/, '')
              return (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => handleSeleccionar(r)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.65rem 1rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: i < resultados.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.1rem',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--gold-soft)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
                    📍 {nombre}
                  </span>
                  {detalle && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {detalle}
                    </span>
                  )}
                </button>
              )
            })}
            {/* Crédito Nominatim (requerido por su política de uso) */}
            <div style={{
              padding: '0.3rem 1rem',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg)',
            }}>
              © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>OpenStreetMap</a> contributors
            </div>
          </div>
        )}
      </div>

      {/* Indicadores de estado */}
      {buscando && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Buscando…
        </p>
      )}
      {!buscando && query.length >= MIN_CHARS && !abierto && resultados.length === 0 && !seleccionado && !error && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Sin resultados para "{query}". Intentá con más detalles o completá los campos manualmente.
        </p>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</p>
      )}

      {/* Confirmación de selección */}
      {seleccionado && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.65rem', borderRadius: 6,
          background: 'var(--gold-soft)', fontSize: '0.8rem', color: 'var(--gold)',
        }}>
          <span>✓</span>
          <span>Datos cargados desde <strong>{seleccionado}</strong> — podés ajustar los campos abajo</span>
        </div>
      )}

      {/* Ayuda */}
      {!seleccionado && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Escribí {MIN_CHARS}+ caracteres. Al seleccionar un lugar se completan los campos automáticamente.
        </p>
      )}
    </div>
  )
}
