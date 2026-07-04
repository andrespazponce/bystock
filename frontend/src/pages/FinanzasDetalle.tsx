import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../auth/AuthContext'
import {
  type ReporteFinanciero,
  type MensajeConsulta,
  getReporte,
  eliminarReporte,
  descargarReporte,
  getConsultas,
  enviarConsulta,
  responderConsulta,
} from '../api/finanzas'

const seccion: React.CSSProperties = {
  marginTop: '2rem',
  paddingTop: '1rem',
  borderTop: '1px solid var(--border)',
}

function Fila({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '0.95rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: '180px', flexShrink: 0 }}>{label}</span>
      <span>{valor}</span>
    </div>
  )
}

function _puede_gestionar(user: { is_staff?: boolean } | null): boolean {
  return !!user?.is_staff
}

export default function FinanzasDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const esGestor = _puede_gestionar(user)

  const [reporte, setReporte] = useState<ReporteFinanciero | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)

  // Consultas
  const [consultas, setConsultas] = useState<MensajeConsulta[]>([])
  const [cargandoConsultas, setCargandoConsultas] = useState(true)
  const [mensajeNuevo, setMensajeNuevo] = useState('')
  const [enviandoConsulta, setEnviandoConsulta] = useState(false)
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null)
  const [respondiendo, setRespondiendo] = useState<number | null>(null)
  const [textRespuesta, setTextRespuesta] = useState('')

  const reporteId = parseInt(id!)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    getReporte(reporteId)
      .then(data => { if (!cancelado) setReporte(data) })
      .catch(() => { if (!cancelado) setError('No se pudo cargar el reporte.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [reporteId])

  useEffect(() => {
    if (!reporte) return
    setCargandoConsultas(true)
    getConsultas(reporteId)
      .then(setConsultas)
      .catch(() => {})
      .finally(() => setCargandoConsultas(false))
  }, [reporte, reporteId])

  async function handleDescargar() {
    if (!reporte) return
    setDescargando(true)
    try {
      await descargarReporte(reporte.url_descarga)
    } catch {
      alert('Error al descargar.')
    } finally {
      setDescargando(false)
    }
  }

  async function handleEliminar() {
    if (!reporte) return
    setErrorBaja(null)
    try {
      await eliminarReporte(reporte.id)
      navigate('/finanzas')
    } catch {
      setErrorBaja('No se pudo eliminar el reporte.')
    }
  }

  async function handleEnviarConsulta(e: React.FormEvent) {
    e.preventDefault()
    if (!mensajeNuevo.trim()) return
    setEnviandoConsulta(true)
    setErrorConsulta(null)
    try {
      const nueva = await enviarConsulta(reporteId, mensajeNuevo.trim())
      setConsultas(prev => [nueva, ...prev])
      setMensajeNuevo('')
    } catch {
      setErrorConsulta('No se pudo enviar la consulta.')
    } finally {
      setEnviandoConsulta(false)
    }
  }

  async function handleResponder(consultaId: number) {
    if (!textRespuesta.trim()) return
    try {
      const actualizada = await responderConsulta(consultaId, textRespuesta.trim())
      setConsultas(prev => prev.map(c => c.id === consultaId ? actualizada : c))
      setRespondiendo(null)
      setTextRespuesta('')
    } catch {
      alert('No se pudo guardar la respuesta.')
    }
  }

  if (cargando) {
    return <Layout><p style={{ color: 'var(--text-muted)' }}>Cargando…</p></Layout>
  }

  if (error || !reporte) {
    return (
      <Layout>
        <p className="alert-error">{error ?? 'No se encontró el reporte.'}</p>
        <p style={{ marginTop: '1rem' }}><Link to="/finanzas">← Volver</Link></p>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Barra superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/finanzas')} className="btn-ghost">← Volver</button>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {esGestor && (
            <button onClick={() => navigate(`/finanzas/${reporte.id}/editar`)} className="btn-ghost" style={{ padding: '0.5rem 1rem' }}>
              Editar
            </button>
          )}
          <button
            className="btn-gold"
            style={{ padding: '0.5rem 1.2rem' }}
            disabled={descargando}
            onClick={handleDescargar}
          >
            {descargando ? 'Descargando…' : '⬇ Descargar'}
          </button>
        </div>
      </div>

      {/* Título */}
      <h1 className="serif" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--gold-strong)' }}>
        {reporte.tipo_display}
        {reporte.titulo && <span style={{ fontWeight: 400, color: 'var(--text)', fontSize: '1.3rem' }}> — {reporte.titulo}</span>}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
        {reporte.empresa_nombre} · {reporte.periodo_label}
        {!reporte.publicado && (
          <span style={{
            marginLeft: '0.75rem',
            padding: '0.15rem 0.55rem',
            borderRadius: 8,
            background: 'var(--warning-soft, rgba(255,190,0,0.12))',
            color: 'var(--warning)',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}>
            No publicado
          </span>
        )}
      </p>

      {/* Datos generales */}
      <section style={seccion}>
        <h2 className="serif" style={{ fontSize: '1.15rem', color: 'var(--gold)', margin: '0 0 0.75rem' }}>
          Información del reporte
        </h2>
        <Fila label="Empresa" valor={reporte.empresa_nombre} />
        <Fila label="Tipo" valor={reporte.tipo_display} />
        <Fila label="Período" valor={`${reporte.periodo_tipo_display} · ${reporte.periodo_label}`} />
        {reporte.descripcion && (
          <Fila label="Descripción" valor={<span style={{ whiteSpace: 'pre-wrap' }}>{reporte.descripcion}</span>} />
        )}
        <Fila label="Subido por" valor={reporte.subido_por || '—'} />
        <Fila label="Fecha de subida" valor={new Date(reporte.creado_en).toLocaleString('es-BO')} />
        {esGestor && (
          <Fila
            label="Hash SHA-256"
            valor={
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {reporte.sha256 || '—'}
              </span>
            }
          />
        )}
      </section>

      {/* Sección de consultas */}
      <section style={seccion}>
        <h2 className="serif" style={{ fontSize: '1.15rem', color: 'var(--gold)', margin: '0 0 1rem' }}>
          Consultas
        </h2>

        {/* Formulario nueva consulta */}
        <form onSubmit={handleEnviarConsulta} style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Enviar una consulta sobre este reporte
          </label>
          <textarea
            value={mensajeNuevo}
            onChange={e => setMensajeNuevo(e.target.value)}
            rows={3}
            placeholder="Escribe tu pregunta o comentario…"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: '0.9rem',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          {errorConsulta && <p className="alert-error" style={{ marginTop: '0.4rem' }}>{errorConsulta}</p>}
          <button
            type="submit"
            className="btn-gold"
            style={{ marginTop: '0.5rem', padding: '0.45rem 1rem' }}
            disabled={enviandoConsulta || !mensajeNuevo.trim()}
          >
            {enviandoConsulta ? 'Enviando…' : 'Enviar consulta'}
          </button>
        </form>

        {/* Lista de consultas */}
        {cargandoConsultas && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando consultas…</p>}
        {!cargandoConsultas && consultas.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin consultas aún.</p>
        )}
        {consultas.map(c => (
          <div
            key={c.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '1rem',
              marginBottom: '0.75rem',
              background: 'var(--surface)',
            }}
          >
            {/* Mensaje del socio */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.usuario_nombre}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {new Date(c.fecha_consulta).toLocaleString('es-BO')}
              </span>
            </div>
            <p style={{ margin: '0.4rem 0 0', whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{c.mensaje}</p>

            {/* Respuesta */}
            {c.respondido && c.respuesta && (
              <div style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '0.85rem' }}>
                    Respuesta de {c.respondido_por_nombre ?? 'Administración'}
                  </span>
                  {c.fecha_respuesta && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(c.fecha_respuesta).toLocaleString('es-BO')}
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{c.respuesta}</p>
              </div>
            )}

            {/* Pendiente */}
            {!c.respondido && (
              <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                Pendiente de respuesta
              </p>
            )}

            {/* Acción responder (solo gestores) */}
            {esGestor && !c.respondido && respondiendo !== c.id && (
              <button
                className="btn-ghost"
                style={{ marginTop: '0.5rem', padding: '0.3rem 0.75rem', fontSize: '0.82rem' }}
                onClick={() => { setRespondiendo(c.id); setTextRespuesta('') }}
              >
                Responder
              </button>
            )}
            {esGestor && respondiendo === c.id && (
              <div style={{ marginTop: '0.75rem' }}>
                <textarea
                  value={textRespuesta}
                  onChange={e => setTextRespuesta(e.target.value)}
                  rows={3}
                  placeholder="Escribe tu respuesta…"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    color: 'var(--text)',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <button
                    className="btn-gold"
                    style={{ padding: '0.35rem 0.9rem', fontSize: '0.85rem' }}
                    disabled={!textRespuesta.trim()}
                    onClick={() => handleResponder(c.id)}
                  >
                    Guardar respuesta
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                    onClick={() => setRespondiendo(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Eliminar (solo gestores) */}
      {esGestor && (
        <section style={{ ...seccion, marginTop: '2rem' }}>
          {errorBaja && <p className="alert-error" style={{ marginBottom: '0.75rem' }}>{errorBaja}</p>}
          {!confirmandoBaja ? (
            <button
              className="btn-ghost"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => setConfirmandoBaja(true)}
            >
              🗑 Eliminar reporte
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--danger)' }}>¿Confirmar eliminación?</span>
              <button className="btn-ghost" onClick={() => setConfirmandoBaja(false)}>Cancelar</button>
              <button
                className="btn-ghost"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={handleEliminar}
              >
                Sí, eliminar
              </button>
            </div>
          )}
        </section>
      )}
    </Layout>
  )
}
