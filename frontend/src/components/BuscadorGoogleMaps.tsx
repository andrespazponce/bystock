/**
 * BuscadorGoogleMaps
 *
 * Buscador de ubicaciones usando Google Maps Places API.
 * Usa la API funcional de @googlemaps/js-api-loader v2+ (setOptions + importLibrary).
 * Requiere VITE_GOOGLE_MAPS_API_KEY en frontend/.env
 * Restringido a Bolivia. Completa: dirección, ciudad, departamento, lat, lng.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { DEPARTAMENTOS_BOLIVIA } from '../api/activos'

export interface DatosUbicacion {
  direccion: string
  ciudad: string
  departamento: string
  latitud: string
  longitud: string
}

interface Props {
  onSeleccionar: (datos: DatosUbicacion) => void
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

// Configura la API una sola vez (singleton)
let placesPromise: Promise<google.maps.PlacesLibrary> | null = null

function cargarPlaces(): Promise<google.maps.PlacesLibrary> {
  if (!placesPromise) {
    setOptions({
      key: API_KEY ?? '',
      v: 'weekly',
      language: 'es',
      region: 'BO',
    })
    placesPromise = importLibrary('places') as Promise<google.maps.PlacesLibrary>
  }
  return placesPromise
}

/** Normaliza el nombre del departamento. */
function normalizarDepartamento(raw: string | undefined): string {
  if (!raw) return ''
  const limpio = raw
    .replace(/^Departamento de /i, '')
    .replace(/^Depto\. de /i, '')
    .trim()
  return (
    DEPARTAMENTOS_BOLIVIA.find(
      d =>
        d.toLowerCase() === limpio.toLowerCase() ||
        limpio.toLowerCase().includes(d.toLowerCase()) ||
        d.toLowerCase().includes(limpio.toLowerCase()),
    ) ?? limpio
  )
}

/** Extrae ciudad y departamento de address_components de Google Places. */
function extraerCiudadDpto(
  components: google.maps.GeocoderAddressComponent[],
): { ciudad: string; departamento: string } {
  let ciudad = ''
  let departamento = ''
  for (const c of components) {
    const tipos = c.types
    if (!ciudad && (tipos.includes('locality') || tipos.includes('administrative_area_level_2'))) {
      ciudad = c.long_name
    }
    if (!departamento && tipos.includes('administrative_area_level_1')) {
      departamento = normalizarDepartamento(c.long_name)
    }
  }
  return { ciudad, departamento }
}

const DEBOUNCE_MS = 350
const MIN_CHARS = 3

export default function BuscadorGoogleMaps({ onSeleccionar }: Props) {
  const [query, setQuery] = useState('')
  const [predicciones, setPredicciones] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [seleccionado, setSeleccionado] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [apiLista, setApiLista] = useState(false)

  const contenedorRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)

  // Cargar Places API al montar
  useEffect(() => {
    if (!API_KEY) {
      setError('Falta VITE_GOOGLE_MAPS_API_KEY en frontend/.env')
      return
    }
    cargarPlaces()
      .then(places => {
        autocompleteRef.current = new places.AutocompleteService()
        const div = mapDivRef.current ?? document.createElement('div')
        placesServiceRef.current = new places.PlacesService(div)
        setApiLista(true)
      })
      .catch(() => {
        setError('No se pudo cargar Google Maps. Verificá la API key y que Places API esté habilitada.')
      })
  }, [])

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
    if (texto.length < MIN_CHARS || !autocompleteRef.current) {
      setPredicciones([])
      setAbierto(false)
      return
    }
    setBuscando(true)
    setError(null)
    try {
      const resultado = await new Promise<google.maps.places.AutocompletePrediction[]>(
        (resolve, reject) => {
          autocompleteRef.current!.getPlacePredictions(
            {
              input: texto,
              componentRestrictions: { country: 'bo' },
            } as google.maps.places.AutocompletionRequest,
            (preds, status) => {
              const ok = google.maps.places.PlacesServiceStatus.OK
              const zero = google.maps.places.PlacesServiceStatus.ZERO_RESULTS
              if (status === ok || status === zero) resolve(preds ?? [])
              else reject(new Error(status))
            },
          )
        },
      )
      setPredicciones(resultado)
      setAbierto(resultado.length > 0)
    } catch {
      setError('Error al buscar. Intentá de nuevo.')
      setPredicciones([])
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

  function handleSeleccionar(prediccion: google.maps.places.AutocompletePrediction) {
    if (!placesServiceRef.current) return
    setAbierto(false)
    setPredicciones([])
    setBuscando(true)

    placesServiceRef.current.getDetails(
      {
        placeId: prediccion.place_id,
        fields: ['formatted_address', 'geometry', 'address_components'],
      },
      (place, status) => {
        setBuscando(false)
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          setError('No se pudieron obtener los detalles del lugar.')
          return
        }
        const { ciudad, departamento } = extraerCiudadDpto(place.address_components ?? [])
        const datos: DatosUbicacion = {
          direccion: place.formatted_address ?? prediccion.description,
          ciudad,
          departamento,
          latitud: String(place.geometry?.location?.lat() ?? ''),
          longitud: String(place.geometry?.location?.lng() ?? ''),
        }
        const nombre = prediccion.structured_formatting.main_text
        setQuery(nombre)
        setSeleccionado(nombre)
        onSeleccionar(datos)
      },
    )
  }

  function handleLimpiar() {
    setQuery('')
    setSeleccionado('')
    setPredicciones([])
    setAbierto(false)
    setError(null)
  }

  function renderResaltado(
    texto: string,
    matched: google.maps.places.PredictionSubstring[],
  ): React.ReactNode {
    if (!matched.length) return texto
    const nodes: React.ReactNode[] = []
    let last = 0
    for (const m of matched) {
      if (m.offset > last) nodes.push(texto.slice(last, m.offset))
      nodes.push(
        <strong key={m.offset} style={{ color: 'var(--gold)' }}>
          {texto.slice(m.offset, m.offset + m.length)}
        </strong>,
      )
      last = m.offset + m.length
    }
    if (last < texto.length) nodes.push(texto.slice(last))
    return nodes
  }

  return (
    <div ref={contenedorRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {/* Div oculto requerido por PlacesService */}
      <div ref={mapDivRef} style={{ display: 'none' }} />

      <div style={{ position: 'relative' }}>
        {/* Ícono lupa */}
        <svg
          width={15} height={15} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            position: 'absolute', left: '0.75rem', top: '50%',
            transform: 'translateY(-50%)',
            color: buscando ? 'var(--gold)' : 'var(--text-muted)',
            pointerEvents: 'none', transition: 'color 0.2s',
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
          onFocus={() => { if (predicciones.length > 0) setAbierto(true) }}
          placeholder={apiLista ? 'Buscar dirección, barrio, lugar…' : 'Cargando Google Maps…'}
          disabled={!apiLista && !error}
          autoComplete="off"
          style={{ paddingLeft: '2.25rem', paddingRight: query ? '2.2rem' : undefined }}
        />

        {query && (
          <button type="button" onClick={handleLimpiar} style={{
            position: 'absolute', right: '0.5rem', top: '50%',
            transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '1.15rem',
            lineHeight: 1, padding: '0.2rem 0.3rem',
          }} title="Limpiar">×</button>
        )}

        {/* Dropdown */}
        {abierto && predicciones.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            zIndex: 1000, overflow: 'hidden',
          }}>
            {predicciones.map((p, i) => (
              <button
                key={p.place_id} type="button"
                onClick={() => handleSeleccionar(p)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '0.65rem 1rem', background: 'none', border: 'none',
                  borderBottom: i < predicciones.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.1rem',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--gold-soft)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
                  📍 {renderResaltado(
                    p.structured_formatting.main_text,
                    p.structured_formatting.main_text_matched_substrings ?? [],
                  )}
                </span>
                {p.structured_formatting.secondary_text && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {p.structured_formatting.secondary_text}
                  </span>
                )}
              </button>
            ))}
            {/* Logo Google (requerido por ToS) */}
            <div style={{
              padding: '0.3rem 0.75rem', display: 'flex', justifyContent: 'flex-end',
              alignItems: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg)',
            }}>
              <img
                src="https://developers.google.com/static/maps/documentation/images/google_on_white.png"
                alt="Powered by Google" style={{ height: 14, opacity: 0.7 }}
              />
            </div>
          </div>
        )}
      </div>

      {buscando && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Buscando…</p>
      )}
      {!buscando && query.length >= MIN_CHARS && !abierto && predicciones.length === 0 && !seleccionado && !error && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Sin resultados para "{query}". Intentá con más detalles o completá manualmente.
        </p>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</p>
      )}
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
      {!seleccionado && !error && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Escribí {MIN_CHARS}+ caracteres. Al seleccionar un lugar se completan los campos automáticamente.
        </p>
      )}
    </div>
  )
}
