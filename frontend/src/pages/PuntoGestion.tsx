import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import DocumentosAdjuntos from '../components/DocumentosAdjuntos'
import {
  createCompromiso,
  createResolucion,
  deleteCompromiso,
  deleteResolucion,
  getCompromisosDePunto,
  getPersonas,
  getPunto,
  getResoluciones,
  updateCompromiso,
  updateResolucion,
} from '../api/reuniones'
import type {
  CompromisoGestion,
  CompromisoWritePayload,
  PersonaLite,
  PuntoGestion as Punto,
  ResolucionGestion,
  ResolucionWritePayload,
} from '../api/reuniones'
import { useAuth } from '../auth/AuthContext'

// Choices estables (espejo de los TextChoices de los modelos).
const RESULTADOS = [
  { value: 'APROBADA', label: 'Aprobada' },
  { value: 'RECHAZADA', label: 'Rechazada' },
  { value: 'POSPUESTA', label: 'Pospuesta' },
]

const ESTADOS_COMP = [
  { value: 'PENDIENTE', label: 'Por hacer' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'CUMPLIDO', label: 'Realizado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

const COLOR_RESULTADO: Record<string, string> = {
  APROBADA: 'var(--success)',
  RECHAZADA: 'var(--danger)',
  POSPUESTA: 'var(--warning)',
}

const COLOR_ESTADO_COMP: Record<string, string> = {
  PENDIENTE: 'var(--info)',
  EN_PROCESO: 'var(--warning)',
  CUMPLIDO: 'var(--success)',
  CANCELADO: 'var(--text-muted)',
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
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
    return ['No tenés permiso para gestionar esta reunión.']
  }
  return [fallback]
}

// ---- Formularios (estado) ----
type ResForm = { texto: string; resultado: string; por_unanimidad: boolean }
const RES_VACIO: ResForm = { texto: '', resultado: 'APROBADA', por_unanimidad: true }

type CompForm = {
  descripcion: string
  responsable: string
  resolucion: string
  fecha_limite: string
  para_proxima_reunion: boolean
  estado: string
}
const COMP_VACIO: CompForm = {
  descripcion: '',
  responsable: '',
  resolucion: '',
  fecha_limite: '',
  para_proxima_reunion: false,
  estado: 'PENDIENTE',
}

export default function PuntoGestion() {
  const navigate = useNavigate()
  const { id, puntoId } = useParams<{ id: string; puntoId: string }>()
  const reunionId = Number(id)
  const puntoPk = Number(puntoId)
  const { user } = useAuth()
  const puede = !!user?.puede_gestionar_reuniones

  const [punto, setPunto] = useState<Punto | null>(null)
  const [resoluciones, setResoluciones] = useState<ResolucionGestion[]>([])
  const [compromisos, setCompromisos] = useState<CompromisoGestion[]>([])
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Estado del formulario de resoluciones.
  const [resEditId, setResEditId] = useState<number | 'nuevo' | null>(null)
  const [resForm, setResForm] = useState<ResForm>({ ...RES_VACIO })
  const [resErrores, setResErrores] = useState<string[]>([])
  const [resGuardando, setResGuardando] = useState(false)

  // Estado del formulario de compromisos.
  const [compEditId, setCompEditId] = useState<number | 'nuevo' | null>(null)
  const [compForm, setCompForm] = useState<CompForm>({ ...COMP_VACIO })
  const [compErrores, setCompErrores] = useState<string[]>([])
  const [compGuardando, setCompGuardando] = useState(false)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    Promise.all([
      getPunto(puntoPk),
      getResoluciones(puntoPk),
      getCompromisosDePunto(puntoPk),
      getPersonas(),
    ])
      .then(([pt, res, comp, pers]) => {
        if (cancelado) return
        setPunto(pt)
        setResoluciones(res)
        setCompromisos(comp)
        setPersonas(pers)
      })
      .catch(() => {
        if (!cancelado) setErrorCarga('No se pudo cargar el punto.')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [puntoPk])

  // ---- Resoluciones ----
  function abrirResNuevo() {
    setResForm({ ...RES_VACIO })
    setResErrores([])
    setResEditId('nuevo')
  }
  function abrirResEdicion(r: ResolucionGestion) {
    setResForm({ texto: r.texto, resultado: r.resultado, por_unanimidad: r.por_unanimidad })
    setResErrores([])
    setResEditId(r.id)
  }
  function cerrarRes() {
    setResEditId(null)
    setResErrores([])
  }
  async function guardarRes(e: FormEvent) {
    e.preventDefault()
    setResErrores([])
    const payload: ResolucionWritePayload = {
      punto: puntoPk,
      texto: resForm.texto.trim(),
      resultado: resForm.resultado,
      por_unanimidad: resForm.por_unanimidad,
    }
    setResGuardando(true)
    try {
      if (resEditId === 'nuevo') {
        const creada = await createResolucion(payload)
        setResoluciones((prev) => [...prev, creada])
      } else if (typeof resEditId === 'number') {
        const act = await updateResolucion(resEditId, payload)
        setResoluciones((prev) => prev.map((x) => (x.id === act.id ? act : x)))
      }
      cerrarRes()
    } catch (err) {
      setResErrores(extraerErrores(err, 'No se pudo guardar la resolución.'))
    } finally {
      setResGuardando(false)
    }
  }
  async function eliminarRes(r: ResolucionGestion) {
    if (!window.confirm('¿Quitar esta resolución?')) return
    try {
      await deleteResolucion(r.id)
      setResoluciones((prev) => prev.filter((x) => x.id !== r.id))
      if (resEditId === r.id) cerrarRes()
    } catch (err) {
      setErrorCarga(extraerErrores(err, 'No se pudo quitar la resolución.').join(' '))
    }
  }

  // ---- Compromisos ----
  function abrirCompNuevo() {
    setCompForm({ ...COMP_VACIO })
    setCompErrores([])
    setCompEditId('nuevo')
  }
  function abrirCompEdicion(c: CompromisoGestion) {
    setCompForm({
      descripcion: c.descripcion,
      responsable: c.responsable ? String(c.responsable.id) : '',
      resolucion: c.resolucion ? String(c.resolucion) : '',
      fecha_limite: c.fecha_limite ?? '',
      para_proxima_reunion: c.para_proxima_reunion,
      estado: c.estado,
    })
    setCompErrores([])
    setCompEditId(c.id)
  }
  function cerrarComp() {
    setCompEditId(null)
    setCompErrores([])
  }
  async function guardarComp(e: FormEvent) {
    e.preventDefault()
    setCompErrores([])
    if (!compForm.responsable) {
      setCompErrores(['Elegí un responsable para el compromiso.'])
      return
    }
    const payload: CompromisoWritePayload = {
      punto: puntoPk,
      resolucion: compForm.resolucion ? Number(compForm.resolucion) : null,
      descripcion: compForm.descripcion.trim(),
      responsable: Number(compForm.responsable),
      fecha_limite: compForm.fecha_limite || null,
      para_proxima_reunion: compForm.para_proxima_reunion,
      estado: compForm.estado,
    }
    setCompGuardando(true)
    try {
      if (compEditId === 'nuevo') {
        const creado = await createCompromiso(payload)
        setCompromisos((prev) => [...prev, creado])
      } else if (typeof compEditId === 'number') {
        const act = await updateCompromiso(compEditId, payload)
        setCompromisos((prev) => prev.map((x) => (x.id === act.id ? act : x)))
      }
      cerrarComp()
    } catch (err) {
      setCompErrores(extraerErrores(err, 'No se pudo guardar el compromiso.'))
    } finally {
      setCompGuardando(false)
    }
  }
  async function eliminarComp(c: CompromisoGestion) {
    if (!window.confirm('¿Quitar este compromiso?')) return
    try {
      await deleteCompromiso(c.id)
      setCompromisos((prev) => prev.filter((x) => x.id !== c.id))
      if (compEditId === c.id) cerrarComp()
    } catch (err) {
      setErrorCarga(extraerErrores(err, 'No se pudo quitar el compromiso.').join(' '))
    }
  }

  if (!puede) {
    return (
      <Layout>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Resoluciones y compromisos
        </h1>
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No tenés permiso para gestionar esta reunión. Pedile a un administrador que te agregue al
            grupo «Gestores de reuniones».
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <button
        onClick={() => navigate(`/reuniones/${reunionId}/orden-del-dia`)}
        className="btn-ghost"
        style={{ border: 'none', padding: 0, color: 'var(--gold)', marginBottom: '0.75rem' }}
      >
        ← Volver al orden del día
      </button>
      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        Resoluciones y compromisos
      </h1>
      {punto && (
        <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          Punto {punto.orden}: {punto.titulo}
        </p>
      )}

      {errorCarga && (
        <div className="alert-error" style={{ marginTop: '1rem' }}>
          {errorCarga}
        </div>
      )}

      {cargando ? (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>
      ) : (
        <>
          {/* ===== Resoluciones ===== */}
          <section style={{ marginTop: '2rem' }}>
            <h2 className="serif" style={{ fontSize: '1.3rem', color: 'var(--gold)', margin: 0 }}>
              Resoluciones ({resoluciones.length})
            </h2>

            {resoluciones.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Todavía no hay resoluciones.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
                {resoluciones.map((r) => (
                  <div key={r.id}>
                    <div
                      className="card"
                      style={{ padding: '0.85rem 1.05rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.texto}</p>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
                          <span className="chip" style={{ color: COLOR_RESULTADO[r.resultado] ?? 'var(--text)' }}>
                            {r.resultado_display}
                          </span>
                          {r.por_unanimidad && (
                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>· por unanimidad</span>
                          )}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button className="btn-ghost" onClick={() => abrirResEdicion(r)} style={{ padding: '0.3rem 0.65rem' }}>
                          Editar
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => eliminarRes(r)}
                          style={{ padding: '0.3rem 0.65rem', color: 'var(--danger)' }}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    {resEditId === r.id && (
                      <FormResolucion
                        titulo="Editar resolución"
                        form={resForm}
                        setForm={setResForm}
                        errores={resErrores}
                        guardando={resGuardando}
                        onSubmit={guardarRes}
                        onCancel={cerrarRes}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {resEditId === 'nuevo' ? (
              <FormResolucion
                titulo="Nueva resolución"
                form={resForm}
                setForm={setResForm}
                errores={resErrores}
                guardando={resGuardando}
                onSubmit={guardarRes}
                onCancel={cerrarRes}
              />
            ) : (
              <button className="btn-gold" onClick={abrirResNuevo} style={{ marginTop: '1rem', padding: '0.55rem 1.1rem' }}>
                + Agregar resolución
              </button>
            )}
          </section>

          {/* ===== Compromisos ===== */}
          <section style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <h2 className="serif" style={{ fontSize: '1.3rem', color: 'var(--gold)', margin: 0 }}>
              Compromisos ({compromisos.length})
            </h2>

            {compromisos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Todavía no hay compromisos.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
                {compromisos.map((c) => (
                  <div key={c.id}>
                    <div
                      className="card"
                      style={{ padding: '0.85rem 1.05rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.descripcion}</p>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {c.responsable?.nombre_completo ?? 'sin responsable'}
                          {c.fecha_limite ? ` · vence ${formatearFecha(c.fecha_limite)}` : ''}
                          {c.para_proxima_reunion ? ' · para la próxima reunión' : ''}{' '}
                          <span
                            className="chip"
                            style={{ color: COLOR_ESTADO_COMP[c.estado] ?? 'var(--text)', marginLeft: '0.3rem' }}
                          >
                            {c.estado_display}
                          </span>
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button className="btn-ghost" onClick={() => abrirCompEdicion(c)} style={{ padding: '0.3rem 0.65rem' }}>
                          Editar
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => eliminarComp(c)}
                          style={{ padding: '0.3rem 0.65rem', color: 'var(--danger)' }}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                    {compEditId === c.id && (
                      <FormCompromiso
                        titulo="Editar compromiso"
                        form={compForm}
                        setForm={setCompForm}
                        personas={personas}
                        resoluciones={resoluciones}
                        errores={compErrores}
                        guardando={compGuardando}
                        onSubmit={guardarComp}
                        onCancel={cerrarComp}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {compEditId === 'nuevo' ? (
              <FormCompromiso
                titulo="Nuevo compromiso"
                form={compForm}
                setForm={setCompForm}
                personas={personas}
                resoluciones={resoluciones}
                errores={compErrores}
                guardando={compGuardando}
                onSubmit={guardarComp}
                onCancel={cerrarComp}
              />
            ) : (
              <button className="btn-gold" onClick={abrirCompNuevo} style={{ marginTop: '1rem', padding: '0.55rem 1.1rem' }}>
                + Agregar compromiso
              </button>
            )}
          </section>

          {/* ===== Documentos ===== */}
          <section style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <h2 className="serif" style={{ fontSize: '1.3rem', color: 'var(--gold)', margin: '0 0 1rem' }}>
              Documentos
            </h2>
            <DocumentosAdjuntos punto={puntoPk} puede={puede} />
          </section>
        </>
      )}
    </Layout>
  )
}

// ---- Formulario de resolución ----
function FormResolucion({
  titulo,
  form,
  setForm,
  errores,
  guardando,
  onSubmit,
  onCancel,
}: {
  titulo: string
  form: ResForm
  setForm: React.Dispatch<React.SetStateAction<ResForm>>
  errores: string[]
  guardando: boolean
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: '0.75rem' }}>
      <div
        className="card"
        style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderColor: 'var(--gold)' }}
      >
        <strong className="serif" style={{ color: 'var(--gold)' }}>
          {titulo}
        </strong>

        <Campo label="Texto de la resolución">
          <textarea
            className="input"
            rows={3}
            value={form.texto}
            onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
            required
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Campo>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Campo label="Resultado" style={{ flex: 1, minWidth: 160 }}>
            <select
              className="select"
              value={form.resultado}
              onChange={(e) => setForm((f) => ({ ...f, resultado: e.target.value }))}
            >
              {RESULTADOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Campo>
          <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.9rem', paddingBottom: '0.6rem' }}>
            <input
              type="checkbox"
              checked={form.por_unanimidad}
              onChange={(e) => setForm((f) => ({ ...f, por_unanimidad: e.target.checked }))}
            />
            <span>Aprobada por unanimidad</span>
          </label>
        </div>

        <Errores errores={errores} />

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

// ---- Formulario de compromiso ----
function FormCompromiso({
  titulo,
  form,
  setForm,
  personas,
  resoluciones,
  errores,
  guardando,
  onSubmit,
  onCancel,
}: {
  titulo: string
  form: CompForm
  setForm: React.Dispatch<React.SetStateAction<CompForm>>
  personas: PersonaLite[]
  resoluciones: ResolucionGestion[]
  errores: string[]
  guardando: boolean
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
}) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: '0.75rem' }}>
      <div
        className="card"
        style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderColor: 'var(--gold)' }}
      >
        <strong className="serif" style={{ color: 'var(--gold)' }}>
          {titulo}
        </strong>

        <Campo label="Descripción">
          <textarea
            className="input"
            rows={2}
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            required
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Campo>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Campo label="Responsable" style={{ flex: 1, minWidth: 180 }}>
            <select
              className="select"
              value={form.responsable}
              onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
              required
            >
              <option value="">— Elegí una persona —</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Estado" style={{ flex: 1, minWidth: 160 }}>
            <select
              className="select"
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
            >
              {ESTADOS_COMP.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Campo label="Fecha límite (opcional)" style={{ flex: 1, minWidth: 160 }}>
            <input
              type="date"
              className="input"
              value={form.fecha_limite}
              onChange={(e) => setForm((f) => ({ ...f, fecha_limite: e.target.value }))}
            />
          </Campo>
          <Campo label="Resolución asociada (opcional)" style={{ flex: 1, minWidth: 200 }}>
            <select
              className="select"
              value={form.resolucion}
              onChange={(e) => setForm((f) => ({ ...f, resolucion: e.target.value }))}
            >
              <option value="">— Sin resolución —</option>
              {resoluciones.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.texto.length > 60 ? `${r.texto.slice(0, 60)}…` : r.texto}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={form.para_proxima_reunion}
            onChange={(e) => setForm((f) => ({ ...f, para_proxima_reunion: e.target.checked }))}
          />
          <span>Llevar a la próxima reunión</span>
        </label>

        <Errores errores={errores} />

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

function Errores({ errores }: { errores: string[] }) {
  if (errores.length === 0) return null
  return (
    <div className="alert-error" style={{ margin: 0 }}>
      <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
        {errores.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  )
}

function Campo({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', ...style }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
