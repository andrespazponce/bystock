import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Layout from '../components/Layout'
import {
  getActivosMapa,
  LABEL_TIPO,
  type ActivoResumen,
  type Categoria,
} from '../api/activos'

// ── Fix: Leaflet no encuentra sus iconos por defecto en Vite ─────────────────
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// ── Colores por categoría ────────────────────────────────────────────────────
const COLOR_CATEGORIA: Record<Categoria, string> = {
  INMUEBLE: '#C9A84C',    // dorado
  VEHICULO: '#4A90D9',    // azul
  MAQUINARIA: '#5CA85C',  // verde
}

const ICONO_CATEGORIA: Record<Categoria, string> = {
  INMUEBLE: '🏠',
  VEHICULO: '🚗',
  MAQUINARIA: '⚙️',
}

const LABEL_CATEGORIA_ES: Record<Categoria, string> = {
  INMUEBLE: 'Inmueble',
  VEHICULO: 'Vehículo',
  MAQUINARIA: 'Maquinaria',
}

const COLOR_ESTADO_MAP: Record<string, string> = {
  ACTIVO: '#5CA85C',
  EN_MANTENIMIENTO: '#E8A838',
  VENDIDO: '#888',
  BAJA: '#D05050',
}

// ── Ícono personalizado con forma de pin ─────────────────────────────────────
function crearIcono(categoria: Categoria): L.DivIcon {
  const color = COLOR_CATEGORIA[categoria] ?? '#888'
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:30px;height:36px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 36" width="30" height="36">
          <ellipse cx="15" cy="34" rx="6" ry="2" fill="rgba(0,0,0,0.18)"/>
          <path d="M15 0C8.37 0 3 5.37 3 12c0 8.25 12 24 12 24S27 20.25 27 12C27 5.37 21.63 0 15 0z"
                fill="${color}" stroke="white" stroke-width="1.5"/>
          <circle cx="15" cy="12" r="5.5" fill="white" fill-opacity="0.9"/>
        </svg>
      </div>
    `,
    iconSize: [30, 36],
    iconAnchor: [15, 36],
    popupAnchor: [0, -38],
  })
}

// ── Componente que ajusta el mapa a los bounds de los activos ────────────────
function FitBounds({ activos }: { activos: ActivoResumen[] }) {
  const map = useMap()

  useEffect(() => {
    if (activos.length === 0) return
    const puntos: [number, number][] = activos.map(a => [
      parseFloat(a.latitud!),
      parseFloat(a.longitud!),
    ])
    if (puntos.length === 1) {
      map.setView(puntos[0], 15)
    } else {
      map.fitBounds(L.latLngBounds(puntos), { padding: [60, 60], maxZoom: 16 })
    }
  }, [activos, map])

  return null
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function MapaActivos() {
  const navigate = useNavigate()
  const [activos, setActivos] = useState<ActivoResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getActivosMapa()
      .then(setActivos)
      .catch(() => setError('No se pudieron cargar los activos con ubicación.'))
      .finally(() => setCargando(false))
  }, [])

  const activosConUbicacion = activos.filter(a => a.latitud && a.longitud)

  return (
    <Layout>
      {/* ── Cabecera ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <p className="section-label" style={{ marginBottom: '0.35rem' }}>Paz Holding</p>
          <h1
            className="serif"
            style={{ fontSize: '1.8rem', margin: 0, fontWeight: 400, color: 'var(--text)' }}
          >
            Mapa de Activos
          </h1>
          {!cargando && !error && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              {activosConUbicacion.length} activo{activosConUbicacion.length !== 1 ? 's' : ''}{' '}
              con ubicación registrada
            </p>
          )}
        </div>

        {/* Leyenda de categorías */}
        {!cargando && activosConUbicacion.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              padding: '0.5rem 0.85rem',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            {(['INMUEBLE', 'VEHICULO', 'MAQUINARIA'] as Categoria[]).map((cat) => {
              const qty = activosConUbicacion.filter(a => a.categoria === cat).length
              if (qty === 0) return null
              return (
                <div
                  key={cat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: COLOR_CATEGORIA[cat],
                      flexShrink: 0,
                    }}
                  />
                  <span>{ICONO_CATEGORIA[cat]} {LABEL_CATEGORIA_ES[cat]}</span>
                  <span
                    style={{
                      background: 'var(--gold-soft)',
                      color: 'var(--gold)',
                      borderRadius: 99,
                      padding: '0 6px',
                      fontWeight: 600,
                      fontSize: '0.72rem',
                    }}
                  >
                    {qty}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Estados ── */}
      {error && <p className="alert-error">{error}</p>}
      {cargando && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
          Cargando activos…
        </p>
      )}

      {/* ── Sin ubicaciones ── */}
      {!cargando && !error && activosConUbicacion.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📍</div>
          <p style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text)' }}>
            Ningún activo tiene coordenadas registradas
          </p>
          <p style={{ fontSize: '0.85rem' }}>
            Editá un activo y agregá su latitud/longitud para verlo en el mapa.
          </p>
          <button
            className="btn-gold"
            style={{ marginTop: '1.25rem' }}
            onClick={() => navigate('/activos')}
          >
            Ver lista de activos
          </button>
        </div>
      )}

      {/* ── Mapa ── */}
      {!cargando && !error && (
        <div
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}
        >
          <MapContainer
            center={[-17.0, -65.0]}
            zoom={6}
            style={{ height: 'calc(100vh - 270px)', minHeight: 440, width: '100%' }}
            zoomControl={true}
          >
            <LayersControl position="topright">
              {/* Capa base: OpenStreetMap */}
              <LayersControl.BaseLayer checked name="🗺️ Mapa">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
              </LayersControl.BaseLayer>

              {/* Capa base: Esri World Imagery (satélite) */}
              <LayersControl.BaseLayer name="🛰️ Satélite">
                <TileLayer
                  attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {/* Markers */}
            {activosConUbicacion.map((a) => (
              <Marker
                key={a.id}
                position={[parseFloat(a.latitud!), parseFloat(a.longitud!)]}
                icon={crearIcono(a.categoria)}
              >
                <Popup minWidth={200} maxWidth={280}>
                  <div style={{ fontFamily: 'inherit', padding: '0.1rem' }}>
                    {/* Nombre */}
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.97rem',
                        color: '#1a1a1a',
                        marginBottom: '0.15rem',
                      }}
                    >
                      {a.nombre}
                    </div>

                    {/* Empresa */}
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#666',
                        marginBottom: '0.5rem',
                        borderBottom: '1px solid #eee',
                        paddingBottom: '0.4rem',
                      }}
                    >
                      {a.empresa_nombre}
                    </div>

                    {/* Tipo */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Tipo</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {ICONO_CATEGORIA[a.categoria]} {LABEL_TIPO[a.tipo]}
                      </span>
                    </div>

                    {/* Estado */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>Estado</span>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: COLOR_ESTADO_MAP[a.estado] ?? '#888',
                          background: `${COLOR_ESTADO_MAP[a.estado] ?? '#888'}18`,
                          borderRadius: 99,
                          padding: '1px 8px',
                        }}
                      >
                        {a.estado_display}
                      </span>
                    </div>

                    {/* Dirección */}
                    {a.direccion && (
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#888',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          gap: '0.3rem',
                        }}
                      >
                        <span>📍</span>
                        <span>{a.direccion}</span>
                      </div>
                    )}

                    {/* CTA */}
                    <button
                      onClick={() => navigate(`/activos/${a.id}`)}
                      style={{
                        background: '#C9A84C',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        padding: '0.4rem 0',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        width: '100%',
                        fontWeight: 600,
                        marginTop: '0.2rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Ver detalle →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Auto-fit bounds cuando cargan los datos */}
            <FitBounds activos={activosConUbicacion} />
          </MapContainer>
        </div>
      )}
    </Layout>
  )
}
