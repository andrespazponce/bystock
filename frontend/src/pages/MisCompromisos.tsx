import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import TableroCompromisos from '../components/TableroCompromisos'
import { getCompromisos, updateCompromisoEstado } from '../api/compromisos'
import type { Compromiso } from '../api/compromisos'
import { useAuth } from '../auth/AuthContext'

const VISTA_KEY = 'mis_compromisos_vista'

function formatearFecha(iso: string | null): string {
  if (!iso) return 'Sin fecha'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

type Vista = 'lista' | 'tablero'

export default function MisCompromisos() {
  const { user } = useAuth()
  const personaId = user?.persona_id ?? null
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
        <div>
          <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
            Mis compromisos
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem', marginBottom: 0 }}>
            Los compromisos donde figuras como responsable.
          </p>
        </div>
        {personaId != null && (
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
        )}
      </div>

      {/* Caso: cuenta sin persona vinculada (ej. un admin técnico). */}
      {personaId == null ? (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Tu cuenta no está vinculada a una persona, por lo que no tienes compromisos asignados.
          </p>
        </div>
      ) : vista === 'lista' ? (
        <VistaListaPersonal personaId={personaId} puedeGestionar={puedeGestionar} />
      ) : (
        // Mismo tablero que el general, pero acotado a MIS compromisos.
        <TableroCompromisos puedeGestionar={puedeGestionar} filtroBase={{ responsable: personaId }} />
      )}
    </Layout>
  )
}

// ===================== VISTA LISTA (personal, con resumen) =====================

function VistaListaPersonal({ personaId, puedeGestionar }: { personaId: number; puedeGestionar: boolean }) {
  const navigate = useNavigate()

  const [items, setItems] = useState<Compromiso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)

  // Trae TODOS mis compromisos abiertos (responsable = mi persona).
  // El volumen por persona es pequeño, así que recorremos las páginas si las hubiera.
  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const acumulado: Compromiso[] = []
      let page = 1
      // Bucle de paginación: seguimos mientras el backend indique "next".
      // `abierto` = Por hacer o En proceso (lo que aún tengo que resolver).
      while (true) {
        const data = await getCompromisos({ responsable: personaId, abierto: true, page })
        acumulado.push(...data.results)
        if (!data.next) break
        page += 1
      }
      // Orden: primero los que tienen fecha límite (más próxima arriba), luego sin fecha.
      acumulado.sort((a, b) => {
        if (!a.fecha_limite) return 1
        if (!b.fecha_limite) return -1
        return a.fecha_limite.localeCompare(b.fecha_limite)
      })
      setItems(acumulado)
    } catch {
      setError('No se pudieron cargar tus compromisos.')
    } finally {
      setLoading(false)
    }
  }, [personaId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Marcar cumplido: lo quitamos de la lista (ya no es abierto).
  async function marcarCumplido(c: Compromiso) {
    setGuardando(c.id)
    try {
      await updateCompromisoEstado(c.id, 'CUMPLIDO')
      setItems((prev) => prev.filter((x) => x.id !== c.id))
    } catch {
      setError('No se pudo actualizar el compromiso.')
    } finally {
      setGuardando(null)
    }
  }

  const vencidos = items.filter((c) => c.vencido).length
  const proxima = items.filter((c) => c.para_proxima_reunion).length

  if (loading) return <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>
  if (error) return <p className="alert-error" style={{ marginTop: '1.5rem' }}>{error}</p>

  return (
    <>
      {/* Resumen */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Resumen valor={items.length} texto="abiertos" />
        <Resumen valor={vencidos} texto="vencidos" acento={vencidos > 0 ? 'var(--danger)' : undefined} />
        <Resumen valor={proxima} texto="para la próxima reunión" acento={proxima > 0 ? 'var(--info)' : undefined} />
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>
            ¡Al día! No tienes compromisos pendientes.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((c) => (
            <div
              key={c.id}
              className="card"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                borderLeft: `3px solid ${c.vencido ? 'var(--danger)' : 'var(--gold)'}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>{c.descripcion}</p>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
                  <span
                    className="chip"
                    style={{
                      borderColor: c.estado === 'EN_PROCESO' ? 'var(--info)' : 'var(--warning)',
                      color: c.estado === 'EN_PROCESO' ? 'var(--info)' : 'var(--warning)',
                    }}
                  >
                    {c.estado_display}
                  </span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      color: c.vencido ? 'var(--danger)' : 'var(--text-muted)',
                      fontWeight: c.vencido ? 600 : 400,
                    }}
                  >
                    {c.vencido ? 'Vencido — ' : 'Vence: '}
                    {formatearFecha(c.fecha_limite)}
                  </span>
                  {c.para_proxima_reunion && (
                    <span className="chip" style={{ borderColor: 'var(--info)', color: 'var(--info)' }}>
                      Para la próxima reunión
                    </span>
                  )}
                </div>

                {/* Origen (clicable) */}
                <button
                  onClick={() => navigate(`/reuniones/${c.reunion_id}`)}
                  className="btn-ghost"
                  style={{ border: 'none', padding: 0, marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}
                  title="Ver la reunión de origen"
                >
                  {c.reunion_etiqueta} · {c.organo} →
                </button>
              </div>

              {puedeGestionar && (
                <button
                  className="btn-gold"
                  disabled={guardando === c.id}
                  onClick={() => marcarCumplido(c)}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {guardando === c.id ? '…' : 'Cumplido'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Resumen({ valor, texto, acento }: { valor: number; texto: string; acento?: string }) {
  return (
    <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
      <span className="serif" style={{ fontSize: '1.6rem', fontWeight: 700, color: acento ?? 'var(--gold-strong)' }}>
        {valor}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{texto}</span>
    </div>
  )
}
