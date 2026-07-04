import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../auth/AuthContext'
import {
  type Activo,
  type ActivoDocumento,
  LABEL_CATEGORIA,
  LABEL_TIPO,
  deleteActivo,
  getActivo,
  getActivoDocumentos,
} from '../api/activos'

const COLOR_ESTADO: Record<string, string> = {
  ACTIVO: 'var(--success)',
  EN_MANTENIMIENTO: 'var(--warning)',
  VENDIDO: 'var(--text-muted)',
  BAJA: 'var(--danger)',
}

const COLOR_ESTADO_INMUEBLE: Record<string, string> = {
  SIN_PROYECTO: 'var(--text-muted)',
  POR_REGULARIZAR: 'var(--danger)',
  EN_PROYECTO: 'var(--info)',
  PROYECTO_TERMINADO: 'var(--success)',
}

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

function IconoArchivo({ ext }: { ext: string }) {
  const iconos: Record<string, string> = {
    pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', webp: '🖼️',
    doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', zip: '📦',
  }
  return <span>{iconos[ext] ?? '📎'}</span>
}

export default function ActivoDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const puedeGestionar = !!user?.is_staff

  const [activo, setActivo] = useState<Activo | null>(null)
  const [documentos, setDocumentos] = useState<ActivoDocumento[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [errorBaja, setErrorBaja] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    Promise.all([
      getActivo(parseInt(id!)),
      getActivoDocumentos(parseInt(id!)),
    ])
      .then(([a, docs]) => {
        if (cancelado) return
        setActivo(a)
        setDocumentos(docs)
      })
      .catch(err => {
        if (cancelado) return
        setError(err?.response?.status === 404 ? 'El activo no existe.' : 'No se pudo cargar el activo.')
      })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [id])

  async function darDeBaja() {
    if (!activo) return
    setErrorBaja(null)
    try {
      await deleteActivo(activo.id)
      navigate('/activos')
    } catch {
      setErrorBaja('No se pudo dar de baja el activo.')
    }
  }

  if (cargando) {
    return <Layout><p style={{ color: 'var(--text-muted)' }}>Cargando…</p></Layout>
  }

  if (error || !activo) {
    return (
      <Layout>
        <p className="alert-error">{error ?? 'No se pudo cargar el activo.'}</p>
        <p style={{ marginTop: '1rem' }}><Link to="/activos">← Volver a la lista</Link></p>
      </Layout>
    )
  }

  const esInmueble = activo.categoria === 'INMUEBLE'
  const esMovil = activo.categoria === 'VEHICULO' || activo.categoria === 'MAQUINARIA'

  return (
    <Layout>
      {/* Navegación superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem' }}>
        <button onClick={() => navigate('/activos')} className="btn-ghost">← Volver</button>
        {puedeGestionar && (
          <button
            onClick={() => navigate(`/activos/${activo.id}/editar`)}
            className="btn-gold"
            style={{ padding: '0.5rem 1rem' }}
          >
            Editar
          </button>
        )}
      </div>

      {/* Título */}
      <h1 className="serif" style={{ fontSize: '1.7rem', margin: 0, color: 'var(--gold-strong)' }}>
        {activo.nombre}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
        {LABEL_CATEGORIA[activo.categoria]} · {LABEL_TIPO[activo.tipo]} · {activo.empresa_nombre}
        {' · '}
        <span style={{ color: COLOR_ESTADO[activo.estado] ?? 'var(--text)', fontWeight: 600 }}>
          {activo.estado_display}
        </span>
      </p>

      {/* Datos generales */}
      <section style={seccion}>
        <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: '0 0 0.75rem' }}>
          Datos generales
        </h2>
        <Fila label="Empresa" valor={activo.empresa_nombre} />
        <Fila label="Categoría" valor={activo.categoria_display} />
        <Fila label="Tipo" valor={activo.tipo_display} />
        <Fila label="Estado" valor={
          <span style={{ color: COLOR_ESTADO[activo.estado] }}>{activo.estado_display}</span>
        } />
        <Fila label="Valor" valor={
          activo.valor
            ? `USD ${parseFloat(activo.valor).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : <span style={{ color: 'var(--text-muted)' }}>—</span>
        } />
        <Fila label="Fecha de adquisición" valor={activo.fecha_adquisicion ?? '—'} />
      </section>

      {/* Datos inmueble */}
      {esInmueble && (
        <section style={seccion}>
          <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: '0 0 0.75rem' }}>
            Datos del inmueble
          </h2>
          <Fila label="Estado del inmueble" valor={
            <span style={{ color: COLOR_ESTADO_INMUEBLE[activo.estado_inmueble] ?? 'var(--text)', fontWeight: 600 }}>
              {activo.estado_inmueble_display}
            </span>
          } />
          {activo.area_m2 && (
            <Fila label="Área" valor={
              `${parseFloat(activo.area_m2).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`
            } />
          )}
          {activo.nro_catastral && <Fila label="N° catastral" valor={activo.nro_catastral} />}
          {activo.nro_habitaciones != null && (
            <Fila label="N° habitaciones" valor={activo.nro_habitaciones} />
          )}
        </section>
      )}

      {/* Datos vehículo / maquinaria */}
      {esMovil && (activo.placa || activo.marca || activo.nro_serie) && (
        <section style={seccion}>
          <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: '0 0 0.75rem' }}>
            {activo.categoria === 'VEHICULO' ? 'Datos del vehículo' : 'Datos de la maquinaria'}
          </h2>
          {activo.placa && <Fila label="Placa / matrícula" valor={activo.placa} />}
          {activo.marca && <Fila label="Marca" valor={activo.marca} />}
          {activo.modelo_descripcion && <Fila label="Modelo" valor={activo.modelo_descripcion} />}
          {activo.anio && <Fila label="Año" valor={activo.anio} />}
          {activo.color && <Fila label="Color" valor={activo.color} />}
          {activo.nro_serie && <Fila label="N° serie / chasis" valor={activo.nro_serie} />}
        </section>
      )}

      {/* Ubicación */}
      <section style={seccion}>
        <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: '0 0 0.75rem' }}>
          Ubicación
        </h2>
        {(activo.departamento || activo.ciudad) && (
          <Fila
            label="Departamento / Ciudad"
            valor={[activo.departamento, activo.ciudad].filter(Boolean).join(' · ')}
          />
        )}
        {activo.direccion
          ? <Fila label="Dirección" valor={activo.direccion} />
          : !activo.departamento && !activo.ciudad && (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Sin ubicación registrada.</p>
          )
        }
        {activo.latitud && activo.longitud && (
          <Fila
            label="Coordenadas"
            valor={
              <a
                href={`https://www.google.com/maps?q=${activo.latitud},${activo.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--gold)' }}
              >
                {parseFloat(activo.latitud).toFixed(5)}, {parseFloat(activo.longitud).toFixed(5)} ↗
              </a>
            }
          />
        )}
        {!activo.latitud && !activo.longitud && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Sin coordenadas.{' '}
            {puedeGestionar && (
              <Link to={`/activos/${activo.id}/editar`}>Agregar →</Link>
            )}
          </p>
        )}
      </section>

      {/* Documentos */}
      <section style={seccion}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: 0 }}>
            Documentos adjuntos
          </h2>
          {puedeGestionar && (
            <Link
              to={`/activos/${activo.id}/editar`}
              style={{ fontSize: '0.82rem', color: 'var(--gold)' }}
            >
              + Subir documento
            </Link>
          )}
        </div>

        {documentos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Sin documentos adjuntos.
            {puedeGestionar && (
              <> <Link to={`/activos/${activo.id}/editar`} style={{ color: 'var(--gold)' }}>Agregar desde la edición →</Link></>
            )}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {documentos.map(doc => (
              <a
                key={doc.id}
                href={doc.url_archivo}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  textDecoration: 'none',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <IconoArchivo ext={doc.extension} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.titulo || doc.nombre_archivo}
                  </div>
                  {doc.titulo && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.nombre_archivo}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--gold)', flexShrink: 0 }}>↓ Ver</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Notas */}
      {activo.notas && (
        <section style={seccion}>
          <h2 className="serif" style={{ fontSize: '1.2rem', color: 'var(--gold)', margin: '0 0 0.75rem' }}>
            Notas
          </h2>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{activo.notas}</p>
        </section>
      )}

      {/* Metadatos */}
      <section style={{ ...seccion, marginTop: '2.5rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
          Registrado: {new Date(activo.creado_en).toLocaleString('es-BO')}
          {' · '}
          Última modificación: {new Date(activo.modificado_en).toLocaleString('es-BO')}
        </p>
      </section>

      {/* Dar de baja */}
      {puedeGestionar && (
        <section style={{ ...seccion, marginTop: '2rem' }}>
          {errorBaja && <p className="alert-error" style={{ marginBottom: '0.75rem' }}>{errorBaja}</p>}
          {!confirmandoBaja ? (
            <button
              className="btn-ghost"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => setConfirmandoBaja(true)}
            >
              🗑 Dar de baja activo
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--danger)' }}>¿Confirmar baja?</span>
              <button className="btn-ghost" onClick={() => setConfirmandoBaja(false)}>Cancelar</button>
              <button
                className="btn-ghost"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={darDeBaja}
              >
                Sí, dar de baja
              </button>
            </div>
          )}
        </section>
      )}
    </Layout>
  )
}
