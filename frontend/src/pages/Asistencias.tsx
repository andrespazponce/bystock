import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  createAsistencia,
  deleteAsistencia,
  getAsistencias,
  getPersonas,
  getReunion,
  updateAsistencia,
} from '../api/reuniones'
import type { AsistenciaGestion, AsistenciaWritePayload, PersonaLite } from '../api/reuniones'
import { useAuth } from '../auth/AuthContext'

// Choices estables (espejo de los TextChoices del modelo Asistencia).
const CALIDADES = [
  { value: 'MIEMBRO', label: 'Miembro del órgano' },
  { value: 'SOCIO', label: 'Socio invitado' },
  { value: 'SECRETARIO', label: 'Secretario de actas' },
  { value: 'INVITADO', label: 'Invitado externo' },
]
const ESTADOS = [
  { value: 'PRESENTE', label: 'Presente' },
  { value: 'AUSENTE', label: 'Ausente' },
  { value: 'EXCUSA', label: 'Con excusa' },
  { value: 'DELEGO', label: 'Delegó' },
]

const COLOR_ESTADO: Record<string, string> = {
  PRESENTE: 'var(--success)',
  AUSENTE: 'var(--danger)',
  EXCUSA: 'var(--warning)',
  DELEGO: 'var(--info)',
}

type FormState = {
  persona: string
  calidad: string
  estado: string
}
const VACIO: FormState = {
  persona: '',
  calidad: 'MIEMBRO',
  estado: 'PRESENTE',
}

export default function Asistencias() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const reunionId = Number(id)
  const { user } = useAuth()
  const puede = !!user?.puede_gestionar_reuniones

  const [etiqueta, setEtiqueta] = useState('')
  const [asistencias, setAsistencias] = useState<AsistenciaGestion[]>([])
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // editandoId === 'nuevo' = alta; un número = edición; null = cerrado.
  const [editandoId, setEditandoId] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState<FormState>({ ...VACIO })
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])

  // Carga inicial: etiqueta de la reunión + asistencias + personas (para el selector).
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    Promise.all([getReunion(reunionId), getAsistencias(reunionId), getPersonas()])
      .then(([reunion, asis, pers]) => {
        if (cancelado) return
        setEtiqueta(`${reunion.etiqueta} — ${reunion.organo.nombre}`)
        setAsistencias(asis)
        setPersonas(pers)
      })
      .catch(() => {
        if (!cancelado) setErrorCarga('No se pudieron cargar las asistencias.')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [reunionId])

  function set<K extends keyof FormState>(campo: K, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function abrirNuevo() {
    setForm({ ...VACIO })
    setErrores([])
    setEditandoId('nuevo')
  }

  function abrirEdicion(a: AsistenciaGestion) {
    setForm({ persona: String(a.persona.id), calidad: a.calidad, estado: a.estado })
    setErrores([])
    setEditandoId(a.id)
  }

  function cerrarForm() {
    setEditandoId(null)
    setErrores([])
  }

  function extraerErrores(err: unknown, fallback: string): string[] {
    if (axios.isAxiosError(err) && err.response?.status === 400 && err.response.data) {
      const data = err.response.data as Record<string, unknown>
      const msgs: string[] = []
      for (const valor of Object.values(data)) {
        if (Array.isArray(valor)) msgs.push(...valor.map(String))
        else if (valor) msgs.push(String(valor))
      }
      return msgs.length ? msgs : [fallback]
    }
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      return ['No tenés permiso para gestionar las asistencias.']
    }
    return [fallback]
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrores([])

    const payload: AsistenciaWritePayload = {
      reunion: reunionId,
      persona: Number(form.persona),
      calidad: form.calidad,
      estado: form.estado,
    }

    setGuardando(true)
    try {
      if (editandoId === 'nuevo') {
        const creada = await createAsistencia(payload)
        setAsistencias((prev) =>
          [...prev, creada].sort((a, b) =>
            a.persona.nombre_completo.localeCompare(b.persona.nombre_completo),
          ),
        )
      } else if (typeof editandoId === 'number') {
        const actualizada = await updateAsistencia(editandoId, payload)
        setAsistencias((prev) => prev.map((a) => (a.id === actualizada.id ? actualizada : a)))
      }
      cerrarForm()
    } catch (err) {
      setErrores(extraerErrores(err, 'No se pudo guardar la asistencia.'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(a: AsistenciaGestion) {
    if (!window.confirm(`¿Quitar a «${a.persona.nombre_completo}» de la lista de asistentes?`)) return
    try {
      await deleteAsistencia(a.id)
      setAsistencias((prev) => prev.filter((x) => x.id !== a.id))
      if (editandoId === a.id) cerrarForm()
    } catch (err) {
      setErrorCarga(extraerErrores(err, 'No se pudo quitar la asistencia.').join(' '))
    }
  }

  // Personas que todavía no están en la lista (para el selector de ALTA).
  const idsEnLista = new Set(asistencias.map((a) => a.persona.id))
  const personasDisponibles =
    editandoId === 'nuevo' ? personas.filter((p) => !idsEnLista.has(p.id)) : personas

  if (!puede) {
    return (
      <Layout>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Asistentes
        </h1>
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No tenés permiso para gestionar las asistencias. Pedile a un administrador que te agregue
            al grupo «Gestores de reuniones».
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <button
        onClick={() => navigate(`/reuniones/${reunionId}`)}
        className="btn-ghost"
        style={{ border: 'none', padding: 0, color: 'var(--gold)', marginBottom: '0.75rem' }}
      >
        ← Volver a la reunión
      </button>
      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        Asistentes
      </h1>
      {etiqueta && <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>{etiqueta}</p>}

      {errorCarga && (
        <div className="alert-error" style={{ marginTop: '1rem' }}>
          {errorCarga}
        </div>
      )}

      {cargando ? (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>
      ) : (
        <div style={{ marginTop: '1.5rem' }}>
          {asistencias.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Todavía no hay asistentes registrados.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Calidad</th>
                  <th>Estado</th>
                  <th style={{ width: 1 }}></th>
                </tr>
              </thead>
              <tbody>
                {asistencias.map((a) => (
                  <tr key={a.id}>
                    <td>{a.persona.nombre_completo}</td>
                    <td>{a.calidad_display}</td>
                    <td>
                      <span style={{ color: COLOR_ESTADO[a.estado] ?? 'var(--text)' }}>{a.estado_display}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button className="btn-ghost" onClick={() => abrirEdicion(a)} style={{ padding: '0.3rem 0.7rem' }}>
                          Editar
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => handleEliminar(a)}
                          style={{ padding: '0.3rem 0.7rem', color: 'var(--danger)' }}
                        >
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Formulario de alta / edición */}
          {editandoId !== null ? (
            <FormAsistencia
              titulo={editandoId === 'nuevo' ? 'Nuevo asistente' : 'Editar asistente'}
              form={form}
              set={set}
              personas={personasDisponibles}
              bloquearPersona={editandoId !== 'nuevo'}
              errores={errores}
              guardando={guardando}
              onSubmit={handleSubmit}
              onCancel={cerrarForm}
            />
          ) : (
            <button
              className="btn-gold"
              onClick={abrirNuevo}
              style={{ marginTop: '1.25rem', padding: '0.6rem 1.2rem' }}
            >
              + Agregar asistente
            </button>
          )}
        </div>
      )}
    </Layout>
  )
}

// Formulario reutilizable para alta y edición de una asistencia.
function FormAsistencia({
  titulo,
  form,
  set,
  personas,
  bloquearPersona,
  errores,
  guardando,
  onSubmit,
  onCancel,
}: {
  titulo: string
  form: FormState
  set: <K extends keyof FormState>(campo: K, valor: string) => void
  personas: PersonaLite[]
  bloquearPersona: boolean
  errores: string[]
  guardando: boolean
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: '1.25rem' }}>
      <div
        className="card"
        style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderColor: 'var(--gold)' }}
      >
        <strong className="serif" style={{ color: 'var(--gold)' }}>
          {titulo}
        </strong>

        <Campo label="Persona">
          <select
            className="select"
            value={form.persona}
            onChange={(e) => set('persona', e.target.value)}
            disabled={bloquearPersona}
            required
          >
            <option value="" disabled>
              Elegí una persona…
            </option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_completo}
                {p.es_socio ? ' · socio' : ''}
              </option>
            ))}
          </select>
        </Campo>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Campo label="Calidad" style={{ flex: 1, minWidth: 180 }}>
            <select className="select" value={form.calidad} onChange={(e) => set('calidad', e.target.value)}>
              {CALIDADES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Estado" style={{ flex: 1, minWidth: 180 }}>
            <select className="select" value={form.estado} onChange={(e) => set('estado', e.target.value)}>
              {ESTADOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        {errores.length > 0 && (
          <div className="alert-error" style={{ margin: 0 }}>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {errores.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={guardando} className="btn-gold" style={{ padding: '0.55rem 1.1rem' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost" style={{ padding: '0.55rem 1.1rem' }}>
            Cancelar
          </button>
        </div>
      </div>
    </form>
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
