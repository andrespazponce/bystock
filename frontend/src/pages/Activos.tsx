import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../auth/AuthContext'
import {
  type ActivoResumen,
  type Categoria,
  type Estado,
  LABEL_CATEGORIA,
  LABEL_ESTADO,
  LABEL_TIPO,
  getActivos,
} from '../api/activos'

const COLOR_ESTADO: Record<Estado, string> = {
  ACTIVO: 'var(--success)',
  EN_MANTENIMIENTO: 'var(--warning)',
  VENDIDO: 'var(--text-muted)',
  BAJA: 'var(--danger)',
}

const ICONO_CATEGORIA: Record<string, string> = {
  INMUEBLE: '🏠',
  VEHICULO: '🚗',
  MAQUINARIA: '⚙️',
}

export default function Activos() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const puedeGestionar = !!user?.is_staff

  const [activos, setActivos] = useState<ActivoResumen[]>([])
  const [count, setCount] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function cargar(params: Record<string, string> = {}) {
    setCargando(true)
    setError(null)
    try {
      const res = await getActivos(params)
      // getActivos ya extrae .results si hay paginación
      setActivos(Array.isArray(res) ? res : [])
      setCount(Array.isArray(res) ? res.length : 0)
    } catch {
      setError('No se pudo cargar la lista de activos.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  function buildParams(b = busqueda, c = filtroCategoria, e = filtroEstado) {
    const p: Record<string, string> = {}
    if (b) p.search = b
    if (c) p.categoria = c
    if (e) p.estado = e
    return p
  }

  function onBusqueda(val: string) {
    setBusqueda(val)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => cargar(buildParams(val)), 400)
  }

  function onCategoria(val: string) {
    setFiltroCategoria(val)
    cargar(buildParams(busqueda, val, filtroEstado))
  }

  function onEstado(val: string) {
    setFiltroEstado(val)
    cargar(buildParams(busqueda, filtroCategoria, val))
  }

  const categorias: Categoria[] = ['INMUEBLE', 'VEHICULO', 'MAQUINARIA']
  const estados: Estado[] = ['ACTIVO', 'EN_MANTENIMIENTO', 'VENDIDO', 'BAJA']

  return (
    <Layout>
      {/* ── Cabecera ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Activos
        </h1>
        {puedeGestionar && (
          <button
            className="btn-gold"
            style={{ padding: '0.55rem 1rem' }}
            onClick={() => navigate('/activos/nuevo')}
          >
            + Registrar activo
          </button>
        )}
      </div>

      {/* ── Filtros ── */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="Buscar por nombre, placa, serie…"
          value={busqueda}
          onChange={e => onBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <select className="select" value={filtroCategoria} onChange={e => onCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => (
            <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>
          ))}
        </select>
        <select className="select" value={filtroEstado} onChange={e => onEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {estados.map(e => (
            <option key={e} value={e}>{LABEL_ESTADO[e]}</option>
          ))}
        </select>
        <button
          className="btn-ghost"
          disabled={cargando}
          onClick={() => cargar(buildParams())}
          title="Recargar"
        >
          {cargando ? 'Cargando…' : '↻ Actualizar'}
        </button>
      </div>

      {/* ── Estados ── */}
      {error && (
        <p className="alert-error" style={{ marginTop: '1.5rem' }}>{error}</p>
      )}
      {cargando && (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>
      )}
      {!cargando && !error && activos.length === 0 && (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>
          No hay activos registrados con esos filtros.
        </p>
      )}

      {/* ── Tabla ── */}
      {!cargando && !error && activos.length > 0 && (
        <>
          <table className="tabla" style={{ marginTop: '1.5rem' }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Valor (Bs.)</th>
                <th>Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {activos.map(a => (
                <tr
                  key={a.id}
                  className="clicable"
                  onClick={() => navigate(`/activos/${a.id}`)}
                  title="Ver detalle"
                >
                  <td style={{ fontWeight: 600 }}>
                    {ICONO_CATEGORIA[a.categoria]} {a.nombre}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{a.empresa_nombre}</td>
                  <td>{LABEL_TIPO[a.tipo]}</td>
                  <td>
                    <span style={{ color: COLOR_ESTADO[a.estado] }}>
                      {a.estado_display}
                    </span>
                  </td>
                  <td>
                    {a.valor
                      ? parseFloat(a.valor).toLocaleString('es-BO')
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td>
                    {a.tiene_ubicacion
                      ? <span style={{ color: 'var(--success)' }}>📍</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin coords</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {count} activo{count !== 1 ? 's' : ''} encontrado{count !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </Layout>
  )
}
