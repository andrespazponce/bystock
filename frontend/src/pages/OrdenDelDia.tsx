import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  createPunto,
  deletePunto,
  getEmpresas,
  getPuntos,
  getReunion,
  reordenarPuntos,
  updatePunto,
} from '../api/reuniones'
import type { EmpresaLite, PuntoGestion, PuntoWritePayload } from '../api/reuniones'
import { useAuth } from '../auth/AuthContext'

// Choices estables (espejo de los TextChoices del modelo PuntoOrden).
const ESTADOS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'TRATADO', label: 'Tratado' },
  { value: 'POSPUESTO', label: 'Pospuesto' },
  { value: 'INFORMATIVO', label: 'Informativo' },
]

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: 'var(--info)',
  TRATADO: 'var(--success)',
  POSPUESTO: 'var(--warning)',
  INFORMATIVO: 'var(--text-muted)',
}

// Estado vacío del formulario (alta o edición).
type FormState = {
  titulo: string
  desarrollo: string
  notas_crudas: string
  empresa: string
  estado: string
}
const VACIO: FormState = {
  titulo: '',
  desarrollo: '',
  notas_crudas: '',
  empresa: '',
  estado: 'PENDIENTE',
}

export default function OrdenDelDia() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const reunionId = Number(id)
  const { user } = useAuth()
  const puede = !!user?.puede_gestionar_reuniones

  const [etiqueta, setEtiqueta] = useState('')
  const [puntos, setPuntos] = useState<PuntoGestion[]>([])
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // Formulario: editandoId === 'nuevo' = alta; un número = edición de ese punto; null = cerrado.
  const [editandoId, setEditandoId] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState<FormState>({ ...VACIO })
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])
  const [reordenando, setReordenando] = useState(false)
  const [cambiandoId, setCambiandoId] = useState<number | null>(null)

  // Carga inicial: etiqueta de la reunión + puntos + empresas (para el selector).
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    Promise.all([getReunion(reunionId), getPuntos(reunionId), getEmpresas()])
      .then(([reunion, pts, emps]) => {
        if (cancelado) return
        setEtiqueta(`${reunion.etiqueta} — ${reunion.organo.nombre}`)
        setPuntos(pts)
        setEmpresas(emps)
      })
      .catch(() => {
        if (!cancelado) setErrorCarga('No se pudo cargar el orden del día.')
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

  function abrirEdicion(p: PuntoGestion) {
    setForm({
      titulo: p.titulo,
      desarrollo: p.desarrollo ?? '',
      notas_crudas: p.notas_crudas ?? '',
      empresa: p.empresa ? String(p.empresa.id) : '',
      estado: p.estado,
    })
    setErrores([])
    setEditandoId(p.id)
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
      return ['No tenés permiso para gestionar el orden del día.']
    }
    return [fallback]
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrores([])

    const payload: PuntoWritePayload = {
      reunion: reunionId,
      titulo: form.titulo.trim(),
      desarrollo: form.desarrollo.trim(),
      notas_crudas: form.notas_crudas.trim(),
      empresa: form.empresa ? Number(form.empresa) : null,
      estado: form.estado,
    }

    setGuardando(true)
    try {
      if (editandoId === 'nuevo') {
        const creado = await createPunto(payload)
        setPuntos((prev) => [...prev, creado])
      } else if (typeof editandoId === 'number') {
        const actualizado = await updatePunto(editandoId, payload)
        setPuntos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)))
      }
      cerrarForm()
    } catch (err) {
      setErrores(extraerErrores(err, 'No se pudo guardar el punto.'))
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(p: PuntoGestion) {
    if (!window.confirm(`¿Quitar el punto «${p.titulo}» del orden del día?`)) return
    try {
      await deletePunto(p.id)
      setPuntos((prev) => prev.filter((x) => x.id !== p.id))
      if (editandoId === p.id) cerrarForm()
    } catch (err) {
      setErrorCarga(extraerErrores(err, 'No se pudo quitar el punto.').join(' '))
    }
  }

  // Cambia el estado de un punto con un solo clic (sin abrir el formulario).
  // Es un toggle: si ya está en ese estado, vuelve a PENDIENTE (para deshacer).
  async function cambiarEstado(p: PuntoGestion, destino: string) {
    const nuevoEstado = p.estado === destino ? 'PENDIENTE' : destino
    setCambiandoId(p.id)
    setErrorCarga(null)
    try {
      const actualizado = await updatePunto(p.id, { estado: nuevoEstado })
      setPuntos((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)))
    } catch (err) {
      setErrorCarga(extraerErrores(err, 'No se pudo cambiar el estado.').join(' '))
    } finally {
      setCambiandoId(null)
    }
  }

  // Mueve un punto hacia arriba (dir=-1) o abajo (dir=+1) y persiste el nuevo orden.
  async function mover(indice: number, dir: -1 | 1) {
    const destino = indice + dir
    if (destino < 0 || destino >= puntos.length) return
    const nuevo = [...puntos]
    ;[nuevo[indice], nuevo[destino]] = [nuevo[destino], nuevo[indice]]
    setReordenando(true)
    setErrorCarga(null)
    try {
      const persistido = await reordenarPuntos(
        reunionId,
        nuevo.map((p) => p.id),
      )
      setPuntos(persistido)
    } catch (err) {
      setErrorCarga(extraerErrores(err, 'No se pudo reordenar.').join(' '))
    } finally {
      setReordenando(false)
    }
  }

  if (!puede) {
    return (
      <Layout>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Orden del día
        </h1>
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No tenés permiso para gestionar el orden del día. Pedile a un administrador que te agregue
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
        Orden del día
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
          {/* Lista de puntos */}
          {puntos.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Todavía no hay puntos cargados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {puntos.map((p, i) => (
                <div key={p.id}>
                  <div
                    className="card"
                    style={{
                      padding: '0.9rem 1.1rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    }}
                  >
                    {/* Controles de reordenamiento */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <button
                        className="btn-ghost"
                        onClick={() => mover(i, -1)}
                        disabled={i === 0 || reordenando}
                        title="Subir"
                        style={{ padding: '0.1rem 0.5rem', lineHeight: 1 }}
                      >
                        ↑
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => mover(i, 1)}
                        disabled={i === puntos.length - 1 || reordenando}
                        title="Bajar"
                        style={{ padding: '0.1rem 0.5rem', lineHeight: 1 }}
                      >
                        ↓
                      </button>
                    </div>

                    {/* Cuerpo del punto */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.2rem' }}>
                        {p.orden}. {p.titulo}{' '}
                        <span
                          className="chip"
                          style={{ color: COLOR_ESTADO[p.estado] ?? 'var(--text)', fontSize: '0.78rem' }}
                        >
                          {p.estado_display}
                        </span>
                        {p.empresa && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                            · {p.empresa.codigo}
                          </span>
                        )}
                      </h3>
                      {p.desarrollo && (
                        <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                          {p.desarrollo}
                        </p>
                      )}
                      {p.notas_crudas && (
                        <p
                          style={{
                            margin: '0.4rem 0 0',
                            whiteSpace: 'pre-wrap',
                            color: 'var(--text-muted)',
                            fontSize: '0.85rem',
                            fontStyle: 'italic',
                          }}
                        >
                          Notas: {p.notas_crudas}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        className={p.estado === 'TRATADO' ? 'btn-gold' : 'btn-ghost'}
                        onClick={() => cambiarEstado(p, 'TRATADO')}
                        disabled={cambiandoId === p.id}
                        style={{ padding: '0.35rem 0.7rem' }}
                        title={p.estado === 'TRATADO' ? 'Quitar «Tratado» (vuelve a Pendiente)' : 'Marcar como tratado'}
                      >
                        Tratado
                      </button>
                      <button
                        className={p.estado === 'POSPUESTO' ? 'btn-gold' : 'btn-ghost'}
                        onClick={() => cambiarEstado(p, 'POSPUESTO')}
                        disabled={cambiandoId === p.id}
                        style={{ padding: '0.35rem 0.7rem' }}
                        title={p.estado === 'POSPUESTO' ? 'Quitar «Pospuesto» (vuelve a Pendiente)' : 'Marcar como pospuesto'}
                      >
                        Pospuesto
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => navigate(`/reuniones/${reunionId}/puntos/${p.id}`)}
                        style={{ padding: '0.35rem 0.7rem' }}
                        title="Resoluciones y compromisos de este punto"
                      >
                        Resoluciones y compromisos
                      </button>
                      <button className="btn-ghost" onClick={() => abrirEdicion(p)} style={{ padding: '0.35rem 0.7rem' }}>
                        Editar
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => handleEliminar(p)}
                        style={{ padding: '0.35rem 0.7rem', color: 'var(--danger)' }}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>

                  {/* Formulario de edición inline */}
                  {editandoId === p.id && (
                    <FormPunto
                      titulo="Editar punto"
                      form={form}
                      set={set}
                      empresas={empresas}
                      errores={errores}
                      guardando={guardando}
                      onSubmit={handleSubmit}
                      onCancel={cerrarForm}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Alta de nuevo punto */}
          {editandoId === 'nuevo' ? (
            <FormPunto
              titulo="Nuevo punto"
              form={form}
              set={set}
              empresas={empresas}
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
              + Agregar punto
            </button>
          )}
        </div>
      )}
    </Layout>
  )
}

// Formulario reutilizable para alta y edición de un punto.
function FormPunto({
  titulo,
  form,
  set,
  empresas,
  errores,
  guardando,
  onSubmit,
  onCancel,
}: {
  titulo: string
  form: FormState
  set: <K extends keyof FormState>(campo: K, valor: string) => void
  empresas: EmpresaLite[]
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

        <Campo label="Título">
          <input
            type="text"
            className="input"
            value={form.titulo}
            onChange={(e) => set('titulo', e.target.value)}
            required
          />
        </Campo>

        <Campo label="Desarrollo (opcional)">
          <textarea
            className="input"
            rows={3}
            value={form.desarrollo}
            onChange={(e) => set('desarrollo', e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Campo>

        <Campo label="Notas crudas (insumo de redacción, opcional)">
          <textarea
            className="input"
            rows={2}
            value={form.notas_crudas}
            onChange={(e) => set('notas_crudas', e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Campo>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Campo label="Empresa (opcional)" style={{ flex: 1, minWidth: 160 }}>
            <select className="select" value={form.empresa} onChange={(e) => set('empresa', e.target.value)}>
              <option value="">— Sin empresa —</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre} ({emp.codigo})
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Estado" style={{ flex: 1, minWidth: 160 }}>
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
