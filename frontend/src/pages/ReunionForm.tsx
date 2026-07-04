import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { createReunion, getOrganos, getReunion, updateReunion } from '../api/reuniones'
import type { Organo, ReunionWritePayload } from '../api/reuniones'
import { useAuth } from '../auth/AuthContext'

// Choices estables (espejo de los TextChoices del modelo).
const TIPOS = [
  { value: 'ORDINARIA', label: 'Ordinaria' },
  { value: 'EXTRAORDINARIA', label: 'Extraordinaria' },
]
const MODALIDADES = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'MIXTA', label: 'Mixta' },
]
const ESTADOS = [
  { value: 'CONVOCADA', label: 'Convocada' },
  { value: 'REALIZADA', label: 'Realizada' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

// Estado inicial del formulario (creación). Strings vacíos = campos opcionales sin cargar.
const VACIO = {
  organo: '',
  numero: '',
  gestion: String(new Date().getFullYear()),
  fecha: '',
  fecha_fin: '',
  hora_inicio: '',
  hora_fin: '',
  lugar: '',
  tipo: 'ORDINARIA',
  modalidad: 'PRESENCIAL',
  estado: 'CONVOCADA',
  observaciones: '',
}

export default function ReunionForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const esEdicion = id != null
  const { user } = useAuth()
  const puede = !!user?.puede_gestionar_reuniones

  const [form, setForm] = useState({ ...VACIO })
  const [organos, setOrganos] = useState<Organo[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])

  // Carga inicial: lista de órganos y, si es edición, los datos de la reunión.
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    Promise.all([getOrganos(), esEdicion ? getReunion(Number(id)) : Promise.resolve(null)])
      .then(([orgs, reunion]) => {
        if (cancelado) return
        setOrganos(orgs)
        if (reunion) {
          setForm({
            organo: String(reunion.organo.id),
            numero: String(reunion.numero),
            gestion: String(reunion.gestion),
            fecha: reunion.fecha ?? '',
            fecha_fin: reunion.fecha_fin ?? '',
            hora_inicio: reunion.hora_inicio ?? '',
            hora_fin: reunion.hora_fin ?? '',
            lugar: reunion.lugar ?? '',
            tipo: reunion.tipo,
            modalidad: reunion.modalidad,
            estado: reunion.estado,
            observaciones: reunion.observaciones ?? '',
          })
        }
      })
      .catch(() => {
        if (!cancelado) setErrores(['No se pudieron cargar los datos del formulario.'])
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [id, esEdicion])

  function set<K extends keyof typeof VACIO>(campo: K, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrores([])

    // Armamos el payload: opcionales vacíos -> null; lugar/observaciones -> ''.
    const payload: ReunionWritePayload = {
      organo: Number(form.organo),
      numero: Number(form.numero),
      gestion: Number(form.gestion),
      fecha: form.fecha,
      fecha_fin: form.fecha_fin || null,
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      lugar: form.lugar.trim(),
      tipo: form.tipo,
      modalidad: form.modalidad,
      estado: form.estado,
      observaciones: form.observaciones.trim(),
    }

    setGuardando(true)
    try {
      const guardada = esEdicion
        ? await updateReunion(Number(id), payload)
        : await createReunion(payload)
      navigate(`/reuniones/${guardada.id}`)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400 && err.response.data) {
        const data = err.response.data as Record<string, unknown>
        const msgs: string[] = []
        for (const valor of Object.values(data)) {
          if (Array.isArray(valor)) msgs.push(...valor.map(String))
          else if (valor) msgs.push(String(valor))
        }
        setErrores(msgs.length ? msgs : ['No se pudo guardar la reunión.'])
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setErrores(['No tenés permiso para guardar reuniones.'])
      } else {
        setErrores(['No se pudo guardar la reunión. Intentá de nuevo.'])
      }
    } finally {
      setGuardando(false)
    }
  }

  if (!puede) {
    return (
      <Layout>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          {esEdicion ? 'Editar reunión' : 'Nueva reunión'}
        </h1>
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No tenés permiso para crear ni editar reuniones. Pedile a un administrador que te agregue
            al grupo «Gestores de reuniones».
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <button
        onClick={() => navigate(esEdicion ? `/reuniones/${id}` : '/reuniones')}
        className="btn-ghost"
        style={{ border: 'none', padding: 0, color: 'var(--gold)', marginBottom: '0.75rem' }}
      >
        ← Volver
      </button>
      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        {esEdicion ? 'Editar reunión' : 'Nueva reunión'}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
        Datos de la reunión. El orden del día y los asistentes se cargan después, desde el detalle.
      </p>

      {cargando ? (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', maxWidth: 640 }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Campo label="Órgano">
              <select className="select" value={form.organo} onChange={(e) => set('organo', e.target.value)} required>
                <option value="" disabled>
                  Elegí un órgano…
                </option>
                {organos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} ({o.empresa.codigo})
                  </option>
                ))}
              </select>
            </Campo>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Campo label="Número" style={{ flex: 1, minWidth: 120 }}>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={form.numero}
                  onChange={(e) => set('numero', e.target.value)}
                  required
                />
              </Campo>
              <Campo label="Gestión (año)" style={{ flex: 1, minWidth: 120 }}>
                <input
                  type="number"
                  min={2000}
                  className="input"
                  value={form.gestion}
                  onChange={(e) => set('gestion', e.target.value)}
                  required
                />
              </Campo>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Campo label="Fecha de inicio" style={{ flex: 1, minWidth: 160 }}>
                <input type="date" className="input" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} required />
              </Campo>
              <Campo label="Fecha de fin (opcional)" style={{ flex: 1, minWidth: 160 }}>
                <input type="date" className="input" value={form.fecha_fin} onChange={(e) => set('fecha_fin', e.target.value)} />
              </Campo>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Campo label="Hora de inicio (opcional)" style={{ flex: 1, minWidth: 160 }}>
                <input type="time" className="input" value={form.hora_inicio} onChange={(e) => set('hora_inicio', e.target.value)} />
              </Campo>
              <Campo label="Hora de fin (opcional)" style={{ flex: 1, minWidth: 160 }}>
                <input type="time" className="input" value={form.hora_fin} onChange={(e) => set('hora_fin', e.target.value)} />
              </Campo>
            </div>

            <Campo label="Lugar (opcional)">
              <input
                type="text"
                className="input"
                value={form.lugar}
                onChange={(e) => set('lugar', e.target.value)}
                placeholder="Sala de Directorio, oficina central…"
              />
            </Campo>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Campo label="Tipo" style={{ flex: 1, minWidth: 140 }}>
                <select className="select" value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Modalidad" style={{ flex: 1, minWidth: 140 }}>
                <select className="select" value={form.modalidad} onChange={(e) => set('modalidad', e.target.value)}>
                  {MODALIDADES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Estado" style={{ flex: 1, minWidth: 140 }}>
                <select className="select" value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                  {ESTADOS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>

            <Campo label="Observaciones (opcional)">
              <textarea
                className="input"
                rows={3}
                value={form.observaciones}
                onChange={(e) => set('observaciones', e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </Campo>

            {errores.length > 0 && (
              <div className="alert-error" style={{ margin: 0 }}>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {errores.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button type="submit" disabled={guardando} className="btn-gold" style={{ padding: '0.65rem 1.25rem', fontSize: '1rem' }}>
                {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear reunión'}
              </button>
              <button
                type="button"
                onClick={() => navigate(esEdicion ? `/reuniones/${id}` : '/reuniones')}
                className="btn-ghost"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}
    </Layout>
  )
}

function Campo({
  label,
  children,
  style,
}: {
  label: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', ...style }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
