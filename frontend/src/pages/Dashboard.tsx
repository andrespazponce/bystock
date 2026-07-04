import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getReunion, getReuniones } from '../api/reuniones'
import type { ReunionDetalle, Reunion, Compromiso } from '../api/reuniones'
import { getCompromisos } from '../api/compromisos'
import { getDocumentos } from '../api/documentos'
import { useAuth } from '../auth/AuthContext'

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

const MESES_CORTOS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const COLOR_ESTADO: Record<string, string> = {
  CONVOCADA: 'var(--info)',
  REALIZADA: 'var(--success)',
  CANCELADA: 'var(--danger)',
}

const COLOR_RESULTADO: Record<string, string> = {
  APROBADA: 'var(--success)',
  RECHAZADA: 'var(--danger)',
  POSPUESTA: 'var(--info)',
}

interface Metricas {
  reuniones: number
  pendientes: number
  vencidos: number
  documentos: number
}

interface MisPendientes {
  total: number
  vencidos: number
}

type ResolucionConPunto = {
  id: number
  texto: string
  resultado: string
  resultado_display: string
  por_unanimidad: boolean
  puntoTitulo: string
}

type CompromisoConPunto = Compromiso & { puntoTitulo: string }

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const personaId = user?.persona_id ?? null

  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [ultima, setUltima] = useState<ReunionDetalle | null>(null)
  const [historial, setHistorial] = useState<Reunion[]>([])
  const [mios, setMios] = useState<MisPendientes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(null)

    Promise.all([
      getReuniones({}),
      getCompromisos({ abierto: true }),
      getCompromisos({ vencido: true }),
      getDocumentos({}),
      personaId != null
        ? getCompromisos({ responsable: personaId, abierto: true })
        : Promise.resolve(null),
      personaId != null
        ? getCompromisos({ responsable: personaId, vencido: true })
        : Promise.resolve(null),
    ])
      .then(async ([reuniones, pendientes, vencidos, documentos, misPend, misVenc]) => {
        if (cancelado) return
        setMetricas({
          reuniones: reuniones.count,
          pendientes: pendientes.count,
          vencidos: vencidos.count,
          documentos: documentos.count,
        })
        if (misPend) {
          setMios({ total: misPend.count, vencidos: misVenc ? misVenc.count : 0 })
        }
        // Historial: últimas 6 reuniones para la columna lateral
        setHistorial(reuniones.results.slice(0, 6))
        // Detalle completo de la más reciente (incluye puntos, resoluciones, compromisos)
        const reciente = reuniones.results[0]
        if (reciente) {
          const detalle = await getReunion(reciente.id)
          if (!cancelado) setUltima(detalle)
        }
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el panel.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [personaId])

  // Resoluciones de todos los puntos de la última reunión
  const todasResoluciones: ResolucionConPunto[] = ultima?.puntos.flatMap((p) =>
    p.resoluciones.map((r) => ({ ...r, puntoTitulo: p.titulo }))
  ) ?? []

  // Compromisos no completados de todos los puntos de la última reunión
  const compromisosPendientes: CompromisoConPunto[] = ultima?.puntos.flatMap((p) =>
    p.compromisos
      .filter((c) => c.estado !== 'COMPLETADO')
      .map((c) => ({ ...c, puntoTitulo: p.titulo }))
  ) ?? []

  return (
    <Layout>
      <style>{`
        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (min-width: 900px) {
          .dashboard-grid {
            grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          }
        }
        .timeline-btn {
          display: flex;
          align-items: stretch;
          gap: 0.75rem;
          width: 100%;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }
        .timeline-btn:hover p { color: var(--gold) !important; }
      `}</style>

      <p style={{ margin: 0, color: 'var(--gold)', fontSize: '0.8rem', letterSpacing: '0.1em', fontWeight: 600 }}>
        PORTAL DEL DIRECTORIO
      </p>
      <h1 className="serif" style={{ fontSize: '2rem', margin: '0.25rem 0 0', color: 'var(--gold-strong)' }}>
        Memoria Corporativa
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
        INCERPAZ / GIPRO — Registro histórico del Directorio
      </p>

      {loading && <p style={{ marginTop: '2rem', color: 'var(--text-muted)' }}>Cargando…</p>}
      {error && <p className="alert-error" style={{ marginTop: '2rem' }}>{error}</p>}

      {/* Aviso: mis compromisos pendientes */}
      {!loading && !error && mios && mios.total > 0 && (
        <button
          onClick={() => navigate('/mis-compromisos')}
          className="card"
          style={{
            marginTop: '1.5rem',
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            borderLeft: `3px solid ${mios.vencidos > 0 ? 'var(--danger)' : 'var(--gold)'}`,
          }}
        >
          <span style={{ fontSize: '1rem', fontWeight: 700, color: mios.vencidos > 0 ? 'var(--danger)' : 'var(--gold)' }}>
            {mios.vencidos > 0 ? '!' : '·'}
          </span>
          <span style={{ flex: 1 }}>
            Tienes <strong style={{ color: 'var(--gold-strong)' }}>{mios.total}</strong>{' '}
            {mios.total === 1 ? 'compromiso abierto' : 'compromisos abiertos'} a tu cargo
            {mios.vencidos > 0 && (
              <>
                {' '}—{' '}
                <strong style={{ color: 'var(--danger)' }}>
                  {mios.vencidos} vencido{mios.vencidos === 1 ? '' : 's'}
                </strong>
              </>
            )}.
          </span>
          <span style={{ color: 'var(--gold)', whiteSpace: 'nowrap' }}>Ver →</span>
        </button>
      )}

      {!loading && !error && metricas && (
        <>
          {/* Tarjetas de métricas */}
          <div
            style={{
              marginTop: '2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
            }}
          >
            <TarjetaMetrica titulo="Reuniones registradas" valor={metricas.reuniones} onClick={() => navigate('/reuniones')} />
            <TarjetaMetrica titulo="Compromisos abiertos" valor={metricas.pendientes} onClick={() => navigate('/compromisos')} />
            <TarjetaMetrica
              titulo="Compromisos vencidos"
              valor={metricas.vencidos}
              acento={metricas.vencidos > 0 ? 'var(--danger)' : undefined}
              onClick={() => navigate('/compromisos')}
            />
            <TarjetaMetrica titulo="Documentos" valor={metricas.documentos} onClick={() => navigate('/documentos')} />
          </div>

          {/* Grid principal: última reunión + historial lateral */}
          <div className="dashboard-grid" style={{ marginTop: '2.5rem' }}>

            {/* ── Columna principal: última reunión ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '0.85rem', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>
                  ÚLTIMA REUNIÓN
                </h2>
                <button onClick={() => navigate('/reuniones')} className="btn-ghost" style={{ border: 'none', color: 'var(--gold)' }}>
                  Ver todas →
                </button>
              </div>

              {!ultima ? (
                <p style={{ color: 'var(--text-muted)' }}>Todavía no hay reuniones registradas.</p>
              ) : (
                <div className="card" style={{ padding: '1.5rem' }}>

                  {/* Cabecera de la reunión */}
                  <p style={{ margin: 0, color: 'var(--gold)', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.06em' }}>
                    {ultima.etiqueta}
                  </p>
                  <h3 className="serif" style={{ fontSize: '1.4rem', margin: '0.35rem 0 0' }}>
                    {ultima.organo.nombre}{' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>({ultima.organo.empresa.codigo})</span>
                  </h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', marginBottom: 0, fontSize: '0.9rem' }}>
                    {formatearFecha(ultima.fecha)} · {ultima.tipo_display} ·{' '}
                    <span style={{ color: COLOR_ESTADO[ultima.estado] ?? 'var(--text)', fontWeight: 600 }}>
                      {ultima.estado_display}
                    </span>
                  </p>

                  {/* ── Orden del día punto a punto ── */}
                  {ultima.puntos.length > 0 && (
                    <div style={{ marginTop: '1.75rem' }}>
                      <p style={{
                        fontSize: '0.72rem', letterSpacing: '0.09em', color: 'var(--text-muted)',
                        fontWeight: 700, margin: '0 0 0.85rem', textTransform: 'uppercase'
                      }}>
                        Orden del día — {ultima.puntos.length} punto{ultima.puntos.length !== 1 ? 's' : ''}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                        {ultima.puntos.map((p, i) => {
                          // Mostrar resumen IA si existe, si no un extracto del desarrollo
                          const extracto = p.resumen
                            ? p.resumen
                            : p.desarrollo
                              ? p.desarrollo.slice(0, 220) + (p.desarrollo.length > 220 ? '…' : '')
                              : null
                          return (
                            <div key={p.id} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                              {/* Número del punto */}
                              <div style={{
                                minWidth: '1.6rem', height: '1.6rem', borderRadius: '50%',
                                background: 'rgba(201,168,76,0.10)',
                                border: '1px solid rgba(201,168,76,0.28)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.68rem', color: 'var(--gold)', fontWeight: 700,
                                flexShrink: 0, marginTop: '0.1rem',
                              }}>
                                {i + 1}
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.35 }}>
                                  {p.titulo}
                                </p>
                                {extracto && (
                                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                                    {extracto}
                                  </p>
                                )}
                                {/* Mini-chips de resoluciones del punto */}
                                {p.resoluciones.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                                    {p.resoluciones.map((r) => (
                                      <span key={r.id} style={{
                                        padding: '0.1rem 0.45rem', borderRadius: '3px',
                                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em',
                                        background: `${COLOR_RESULTADO[r.resultado] ?? 'var(--text-muted)'}1a`,
                                        color: COLOR_RESULTADO[r.resultado] ?? 'var(--text-muted)',
                                        border: `1px solid ${COLOR_RESULTADO[r.resultado] ?? 'var(--border)'}33`,
                                      }}>
                                        {r.resultado_display}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Resoluciones tomadas ── */}
                  {todasResoluciones.length > 0 && (
                    <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                      <p style={{
                        fontSize: '0.72rem', letterSpacing: '0.09em', color: 'var(--text-muted)',
                        fontWeight: 700, margin: '0 0 0.85rem', textTransform: 'uppercase'
                      }}>
                        Resoluciones tomadas — {todasResoluciones.length}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {todasResoluciones.map((r) => (
                          <div key={r.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <span style={{
                              display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '3px',
                              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                              whiteSpace: 'nowrap', flexShrink: 0,
                              background: `${COLOR_RESULTADO[r.resultado] ?? 'var(--text-muted)'}1a`,
                              color: COLOR_RESULTADO[r.resultado] ?? 'var(--text-muted)',
                              border: `1px solid ${COLOR_RESULTADO[r.resultado] ?? 'var(--border)'}33`,
                              marginTop: '0.15rem',
                            }}>
                              {r.resultado_display}
                            </span>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>
                                {r.texto.length > 240 ? r.texto.slice(0, 240) + '…' : r.texto}
                                {r.por_unanimidad && (
                                  <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    · por unanimidad
                                  </span>
                                )}
                              </p>
                              <p style={{ margin: '0.2rem 0 0', fontSize: '0.73rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                                {r.puntoTitulo}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Compromisos pendientes ── */}
                  {compromisosPendientes.length > 0 && (
                    <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                      <p style={{
                        fontSize: '0.72rem', letterSpacing: '0.09em', color: 'var(--text-muted)',
                        fontWeight: 700, margin: '0 0 0.85rem', textTransform: 'uppercase'
                      }}>
                        Pendientes — {compromisosPendientes.length}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {compromisosPendientes.map((c) => (
                          <div key={c.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <div style={{
                              width: '0.4rem', height: '0.4rem', borderRadius: '50%',
                              background: c.estado === 'VENCIDO' ? 'var(--danger)' : 'var(--gold)',
                              flexShrink: 0, marginTop: '0.45rem',
                            }} />
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.4 }}>
                                {c.descripcion}
                              </p>
                              <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {c.responsable ? c.responsable.nombre_completo : 'Sin responsable asignado'}
                                {c.fecha_limite && (
                                  <>
                                    {' '}·{' '}
                                    <span style={{ color: c.estado === 'VENCIDO' ? 'var(--danger)' : 'inherit' }}>
                                      {formatearFecha(c.fecha_limite)}
                                    </span>
                                  </>
                                )}
                                {c.para_proxima_reunion && (
                                  <span style={{ marginLeft: '0.4rem', color: 'var(--gold)', fontSize: '0.72rem' }}>
                                    · para próxima reunión
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '1.5rem' }}>
                    <button onClick={() => navigate(`/reuniones/${ultima.id}`)} className="btn-gold">
                      Ver reunión completa →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Columna lateral: historial ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '0.85rem', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>
                  HISTORIAL
                </h2>
                <button onClick={() => navigate('/reuniones')} className="btn-ghost" style={{ border: 'none', color: 'var(--gold)' }}>
                  Ver todas →
                </button>
              </div>
              <div className="card" style={{ padding: '1.25rem 1rem' }}>
                {historial.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Sin reuniones.</p>
                ) : (
                  <div>
                    {historial.map((r, i) => {
                      const partes = (r.fecha ?? '').split('-')
                      const ano = partes[0] ?? ''
                      const mes = parseInt(partes[1] ?? '0')
                      const dia = partes[2] ?? ''
                      const esUltima = i === 0
                      return (
                        <button
                          key={r.id}
                          className="timeline-btn"
                          onClick={() => navigate(`/reuniones/${r.id}`)}
                        >
                          {/* Línea de tiempo */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '1rem', flexShrink: 0 }}>
                            <div style={{
                              width: esUltima ? '0.6rem' : '0.45rem',
                              height: esUltima ? '0.6rem' : '0.45rem',
                              borderRadius: '50%',
                              background: esUltima ? 'var(--gold)' : 'var(--border)',
                              border: `2px solid ${esUltima ? 'var(--gold)' : 'var(--border)'}`,
                              marginTop: '0.5rem',
                              flexShrink: 0,
                              boxShadow: esUltima ? '0 0 6px rgba(201,168,76,0.4)' : 'none',
                            }} />
                            {i < historial.length - 1 && (
                              <div style={{ flex: 1, width: '1px', background: 'var(--border)', minHeight: '1.5rem' }} />
                            )}
                          </div>
                          {/* Contenido */}
                          <div style={{ paddingBottom: i < historial.length - 1 ? '1rem' : 0, paddingTop: '0.2rem', flex: 1 }}>
                            <p style={{
                              margin: 0, fontSize: '0.82rem', lineHeight: 1.3,
                              fontWeight: esUltima ? 700 : 400,
                              color: esUltima ? 'var(--text)' : 'var(--text-muted)',
                              transition: 'color 0.15s',
                            }}>
                              {r.etiqueta}
                            </p>
                            {dia && (
                              <p style={{ margin: '0.15rem 0 0', fontSize: '0.73rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                                {dia} {MESES_CORTOS[mes]} {ano}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </Layout>
  )
}

function TarjetaMetrica({
  titulo,
  valor,
  acento,
  onClick,
}: {
  titulo: string
  valor: number
  acento?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        textAlign: 'left',
        padding: '1.25rem',
        cursor: 'pointer',
        background: 'var(--surface)',
        color: 'var(--text)',
      }}
    >
      <div className="serif" style={{ fontSize: '2.2rem', fontWeight: 700, color: acento ?? 'var(--gold-strong)' }}>
        {valor}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{titulo}</div>
    </button>
  )
}
