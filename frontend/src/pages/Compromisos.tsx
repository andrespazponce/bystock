import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import TableroCompromisos from '../components/TableroCompromisos'
import { getCompromisos, updateCompromisoEstado } from '../api/compromisos'
import type { Compromiso, CompromisoFiltros } from '../api/compromisos'
import { useAuth } from '../auth/AuthContext'

const PAGE_SIZE = 20
const VISTA_KEY = 'compromisos_vista'

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: 'var(--warning)',
  EN_PROCESO: 'var(--info)',
  CUMPLIDO: 'var(--success)',
  CANCELADO: 'var(--text-muted)',
}

// Estados "abiertos" (trabajo por resolver): un compromiso aquí puede estar vencido.
const ABIERTOS = ['PENDIENTE', 'EN_PROCESO']

// Filtros rápidos: cada uno arma los params que se mandan al backend.
type FiltroRapido = 'TODOS' | 'PENDIENTES' | 'VENCIDOS' | 'PROXIMA'
const FILTROS: { clave: FiltroRapido; label: string; params: CompromisoFiltros }[] = [
  { clave: 'TODOS', label: 'Todos', params: {} },
  { clave: 'PENDIENTES', label: 'Pendientes', params: { estado: 'PENDIENTE' } },
  { clave: 'VENCIDOS', label: 'Vencidos', params: { vencido: true } },
  { clave: 'PROXIMA', label: 'Para la próxima', params: { para_proxima_reunion: true } },
]

const BTN_ACCION = { padding: '0.3rem 0.7rem', fontSize: '0.85rem' } as const

type Vista = 'lista' | 'tablero'

export default function Compromisos() {
  const { user } = useAuth()
  const puedeGestionar = !!user?.puede_gestionar_compromisos

  const [vista, setVista] = useState<Vista>(
    () => (localStorage.getItem(VISTA_KEY) === 'tablero' ? 'tablero' : 'lista'),
  )

  function cambiarVista(v: Vista) {
    localStorage.setItem(VISTA_KEY, v)
    setVista(v)
  }

  return (
    <Layout>
      {/* Cabecera: título + selector de vista */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Compromisos
        </h1>
        <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
          {(['lista', 'tablero'] as Vista[]).map((v) => {
            const activo = vista === v
            return (
              <button
                key={v}
                onClick={() => cambiarVista(v)}
                style={{
                  padding: '0.35rem 0.9rem',
                  cursor: 'pointer',
                  border: 'none',
                  borderRadius: 6,
                  background: activo ? 'var(--gold-soft)' : 'transparent',
                  color: activo ? 'var(--gold)' : 'var(--text-muted)',
                  fontWeight: activo ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            )
          })}
        </div>
      </div>

      {vista === 'lista' ? (
        <VistaLista puedeGestionar={puedeGestionar} />
      ) : (
        <TableroCompromisos puedeGestionar={puedeGestionar} />
      )}
    </Layout>
  )
}

// ===================== VISTA LISTA (tabla con filtros) =====================

function VistaLista({ puedeGestionar }: { puedeGestionar: boolean }) {
  const navigate = useNavigate()

  const [filtro, setFiltro] = useState<FiltroRapido>('PENDIENTES')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Compromiso[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(null)
    const params = FILTROS.find((f) => f.clave === filtro)?.params ?? {}
    getCompromisos({ ...params, page })
      .then((data) => {
        if (cancelado) return
        setItems(data.results)
        setCount(data.count)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar los compromisos.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [filtro, page])

  async function cambiarEstado(c: Compromiso, estado: string) {
    setGuardando(c.id)
    try {
      const actualizado = await updateCompromisoEstado(c.id, estado)
      setItems((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? {
                ...x,
                estado: actualizado.estado,
                estado_display: actualizado.estado_display,
                // Si pasa a un estado cerrado (Realizado/Cancelado) deja de estar vencido.
                vencido: ABIERTOS.includes(estado) ? x.vencido : false,
              }
            : x,
        ),
      )
    } catch {
      setError('No se pudo actualizar el compromiso.')
    } finally {
      setGuardando(null)
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <>
      {/* Filtros rápidos */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {FILTROS.map((f) => {
          const activo = filtro === f.clave
          return (
            <button
              key={f.clave}
              onClick={() => {
                setPage(1)
                setFiltro(f.clave)
              }}
              style={{
                padding: '0.4rem 0.9rem',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: activo ? 'var(--gold)' : 'var(--border)',
                background: activo ? 'var(--gold-soft)' : 'transparent',
                color: activo ? 'var(--gold)' : 'var(--text-muted)',
                borderRadius: 6,
                fontWeight: activo ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading && <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>}
      {error && <p className="alert-error" style={{ marginTop: '1.5rem' }}>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>No hay compromisos para este filtro.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <table className="tabla" style={{ marginTop: '1.5rem' }}>
          <thead>
            <tr>
              <th>Compromiso</th>
              <th>Responsable</th>
              <th>Vence</th>
              <th>Estado</th>
              <th>Origen</th>
              {puedeGestionar && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                className="clicable"
                onClick={() => navigate(`/reuniones/${c.reunion_id}`)}
                title="Ver la reunión de origen"
              >
                <td>{c.descripcion}</td>
                <td>{c.responsable?.nombre_completo ?? '—'}</td>
                <td style={{ color: c.vencido ? 'var(--danger)' : 'var(--text)', fontWeight: c.vencido ? 600 : 400 }}>
                  {formatearFecha(c.fecha_limite)}
                  {c.vencido && ' (vencido)'}
                </td>
                <td>
                  <span style={{ color: COLOR_ESTADO[c.estado] ?? 'var(--text)' }}>{c.estado_display}</span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {c.reunion_etiqueta} · {c.organo}
                </td>
                {puedeGestionar && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {c.estado === 'PENDIENTE' && (
                        <button className="btn-ghost" disabled={guardando === c.id} onClick={() => cambiarEstado(c, 'EN_PROCESO')} style={BTN_ACCION}>
                          Iniciar
                        </button>
                      )}
                      {ABIERTOS.includes(c.estado) && (
                        <>
                          <button className="btn-gold" disabled={guardando === c.id} onClick={() => cambiarEstado(c, 'CUMPLIDO')} style={BTN_ACCION}>
                            {guardando === c.id ? '…' : 'Realizado'}
                          </button>
                          <button className="btn-ghost" disabled={guardando === c.id} onClick={() => cambiarEstado(c, 'CANCELADO')} style={BTN_ACCION}>
                            Cancelar
                          </button>
                        </>
                      )}
                      {!ABIERTOS.includes(c.estado) && (
                        <button className="btn-ghost" disabled={guardando === c.id} onClick={() => cambiarEstado(c, 'PENDIENTE')} style={BTN_ACCION}>
                          {guardando === c.id ? '…' : 'Reabrir'}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && count > PAGE_SIZE && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost">
            ← Anterior
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Página {page} de {totalPaginas} ({count} compromisos)
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} disabled={page >= totalPaginas} className="btn-ghost">
            Siguiente →
          </button>
        </div>
      )}
    </>
  )
}
