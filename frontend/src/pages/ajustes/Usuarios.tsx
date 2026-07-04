import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import {
  createUsuario,
  getGrupos,
  getPersonasAdmin,
  getUsuariosAdmin,
  updateUsuario,
} from '../../api/ajustes'
import type {
  GrupoLite,
  PersonaAdmin,
  UsuarioAdmin,
  UsuarioCreatePayload,
  UsuarioUpdatePayload,
} from '../../api/ajustes'

// ── Constantes ───────────────────────────────────────────────────────────────

const VACIO_CREAR: UsuarioCreatePayload = {
  email: '',
  password: '',
  persona: null,
  is_staff: false,
  grupos: [],
}

function aplanaErrores(err: unknown): string[] {
  if (!err || typeof err !== 'object') return ['Error inesperado.']
  const data = (err as { response?: { data?: unknown } }).response?.data
  if (!data) return ['No se pudo conectar con el servidor.']
  if (typeof data === 'string') return [data]
  if (Array.isArray(data)) return data.map(String)
  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).flatMap(([campo, msgs]) => {
      const lista = Array.isArray(msgs) ? msgs : [msgs]
      return lista.map((m) =>
        campo === 'non_field_errors' || campo === 'detail' ? String(m) : `${campo}: ${m}`,
      )
    })
  }
  return ['Error inesperado.']
}

function formatFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

// ── Tipos locales ─────────────────────────────────────────────────────────────

type FiltroActivo = 'todos' | 'activos' | 'inactivos'

type FormEditar = {
  persona: number | null
  is_active: boolean
  is_staff: boolean
  grupos: number[]
  password: string
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [personas, setPersonas] = useState<PersonaAdmin[]>([])
  const [grupos, setGrupos] = useState<GrupoLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Búsqueda y filtro
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<FiltroActivo>('todos')

  // Formulario — null=cerrado, 0=nuevo, id=editando
  const [editId, setEditId] = useState<number | null>(null)
  const [formCrear, setFormCrear] = useState<UsuarioCreatePayload>({ ...VACIO_CREAR })
  const [formEditar, setFormEditar] = useState<FormEditar>({
    persona: null,
    is_active: true,
    is_staff: false,
    grupos: [],
    password: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [erroresForm, setErroresForm] = useState<string[]>([])

  useEffect(() => {
    Promise.all([getUsuariosAdmin(), getPersonasAdmin(), getGrupos()])
      .then(([u, p, g]) => {
        setUsuarios(u)
        setPersonas(p)
        setGrupos(g)
      })
      .catch(() => setError('No se pudo cargar la lista de usuarios.'))
      .finally(() => setLoading(false))
  }, [])

  // Personas sin cuenta (o la del usuario que se está editando)
  const personasDisponibles = useMemo(() => {
    const usadasIds = new Set(
      usuarios
        .filter((u) => u.persona !== null && u.id !== editId)
        .map((u) => u.persona as number),
    )
    return personas.filter((p) => !usadasIds.has(p.id))
  }, [personas, usuarios, editId])

  // Filtrado
  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return usuarios.filter((u) => {
      const coincideBusqueda =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.nombre_completo ?? '').toLowerCase().includes(q)
      const coincideActivo =
        filtroActivo === 'todos' ||
        (filtroActivo === 'activos' && u.is_active) ||
        (filtroActivo === 'inactivos' && !u.is_active)
      return coincideBusqueda && coincideActivo
    })
  }, [usuarios, busqueda, filtroActivo])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function abrirNuevo() {
    setFormCrear({ ...VACIO_CREAR })
    setErroresForm([])
    setEditId(0)
  }

  function abrirEditar(u: UsuarioAdmin) {
    setFormEditar({
      persona: u.persona,
      is_active: u.is_active,
      is_staff: u.is_staff,
      grupos: u.grupos.map((g) => g.id),
      password: '',
    })
    setErroresForm([])
    setEditId(u.id)
  }

  function cerrar() {
    setEditId(null)
    setErroresForm([])
  }

  function toggleGrupoCrear(gid: number) {
    setFormCrear((f) => ({
      ...f,
      grupos: f.grupos.includes(gid) ? f.grupos.filter((x) => x !== gid) : [...f.grupos, gid],
    }))
  }

  function toggleGrupoEditar(gid: number) {
    setFormEditar((f) => ({
      ...f,
      grupos: f.grupos.includes(gid) ? f.grupos.filter((x) => x !== gid) : [...f.grupos, gid],
    }))
  }

  async function guardar() {
    setErroresForm([])
    setGuardando(true)
    try {
      if (editId === 0) {
        // Crear
        if (!formCrear.email.trim()) {
          setErroresForm(['El email es obligatorio.'])
          return
        }
        if (formCrear.password.length < 8) {
          setErroresForm(['La contraseña debe tener al menos 8 caracteres.'])
          return
        }
        const nuevo = await createUsuario({
          ...formCrear,
          email: formCrear.email.trim().toLowerCase(),
          persona: formCrear.persona,
        })
        setUsuarios((prev) => [...prev, nuevo].sort((a, b) => a.email.localeCompare(b.email)))
      } else if (editId !== null) {
        // Editar
        const payload: UsuarioUpdatePayload = {
          persona: formEditar.persona,
          is_active: formEditar.is_active,
          is_staff: formEditar.is_staff,
          grupos: formEditar.grupos,
        }
        if (formEditar.password.trim()) {
          payload.password = formEditar.password.trim()
        }
        const actualizado = await updateUsuario(editId, payload)
        setUsuarios((prev) =>
          prev
            .map((u) => (u.id === editId ? actualizado : u))
            .sort((a, b) => a.email.localeCompare(b.email)),
        )
      }
      cerrar()
    } catch (err) {
      setErroresForm(aplanaErrores(err))
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(u: UsuarioAdmin) {
    if (u.is_superuser) return
    try {
      const actualizado = await updateUsuario(u.id, { is_active: !u.is_active })
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? actualizado : x)))
    } catch {
      // silencioso — el estado no cambia
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const esNuevo = editId === 0

  return (
    <Layout>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Usuarios
        </h1>
        {editId === null && (
          <button onClick={abrirNuevo} className="btn-gold" style={{ padding: '0.55rem 1rem' }}>
            + Nuevo usuario
          </button>
        )}
      </div>
      <p style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Cuentas de acceso al portal. Los superusuarios solo se administran desde Django admin.
      </p>

      {/* Formulario */}
      {editId !== null && (
        <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--gold)' }}>
            {esNuevo ? 'Nuevo usuario' : 'Editar usuario'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Email — solo al crear */}
            {esNuevo ? (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email *</span>
                <input
                  className="input"
                  type="email"
                  value={formCrear.email}
                  onChange={(e) => setFormCrear((f) => ({ ...f, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  autoFocus
                />
              </label>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email</span>
                <span style={{ padding: '0.5rem 0', fontWeight: 600 }}>
                  {usuarios.find((u) => u.id === editId)?.email}
                </span>
              </div>
            )}

            {/* Contraseña */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {esNuevo ? 'Contraseña inicial *' : 'Nueva contraseña (opcional)'}
              </span>
              <input
                className="input"
                type="password"
                value={esNuevo ? formCrear.password : formEditar.password}
                onChange={(e) =>
                  esNuevo
                    ? setFormCrear((f) => ({ ...f, password: e.target.value }))
                    : setFormEditar((f) => ({ ...f, password: e.target.value }))
                }
                placeholder={esNuevo ? 'Mínimo 8 caracteres' : 'Dejar vacío para no cambiar'}
                autoFocus={!esNuevo}
              />
            </label>

            {/* Persona vinculada */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Persona vinculada</span>
              <select
                className="input"
                value={String(esNuevo ? formCrear.persona ?? '' : formEditar.persona ?? '')}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  esNuevo
                    ? setFormCrear((f) => ({ ...f, persona: v }))
                    : setFormEditar((f) => ({ ...f, persona: v }))
                }}
              >
                <option value="">— Sin vincular —</option>
                {personasDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre_completo}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Flags + grupos */}
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Checkboxes de flags */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={esNuevo ? formCrear.is_staff : formEditar.is_staff}
                  onChange={(e) =>
                    esNuevo
                      ? setFormCrear((f) => ({ ...f, is_staff: e.target.checked }))
                      : setFormEditar((f) => ({ ...f, is_staff: e.target.checked }))
                  }
                />
                <span>Staff (acceso a Ajustes)</span>
              </label>
              {!esNuevo && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formEditar.is_active}
                    onChange={(e) => setFormEditar((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  <span>Cuenta activa</span>
                </label>
              )}
            </div>

            {/* Grupos de permisos */}
            {grupos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Grupos de permisos</span>
                {grupos.map((g) => {
                  const checked = esNuevo
                    ? formCrear.grupos.includes(g.id)
                    : formEditar.grupos.includes(g.id)
                  return (
                    <label
                      key={g.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => esNuevo ? toggleGrupoCrear(g.id) : toggleGrupoEditar(g.id)}
                      />
                      <span>{g.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {erroresForm.length > 0 && (
            <ul className="alert-error" style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {erroresForm.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={guardar} disabled={guardando} className="btn-gold" style={{ padding: '0.5rem 1.2rem' }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={cerrar} disabled={guardando} className="btn-ghost" style={{ padding: '0.5rem 1rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Barra de búsqueda */}
      {!loading && !error && (
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Buscar por email o nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {(['todos', 'activos', 'inactivos'] as FiltroActivo[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroActivo(f)}
                className={filtroActivo === f ? 'btn-gold' : 'btn-ghost'}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                {f === 'todos' ? 'Todos' : f === 'activos' ? 'Activos' : 'Inactivos'}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? 'usuario' : 'usuarios'}
          </span>
        </div>
      )}

      {/* Estado carga / error */}
      {loading && <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>}
      {error && <p className="alert-error" style={{ marginTop: '1rem' }}>{error}</p>}

      {/* Tabla */}
      {!loading && !error && (
        <table className="tabla" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>Email / Nombre</th>
              <th>Persona</th>
              <th style={{ textAlign: 'center' }}>Estado</th>
              <th>Grupos</th>
              <th style={{ width: 140 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {busqueda || filtroActivo !== 'todos'
                    ? 'Sin resultados para ese filtro.'
                    : 'No hay usuarios registrados.'}
                </td>
              </tr>
            )}
            {usuariosFiltrados.map((u) => (
              <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.email}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    {u.nombre_completo !== u.email ? u.nombre_completo : ''}
                    {u.is_superuser && (
                      <span
                        className="chip"
                        style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--gold)' }}
                      >
                        Superadmin
                      </span>
                    )}
                    {u.is_staff && !u.is_superuser && (
                      <span
                        className="chip"
                        style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}
                      >
                        Staff
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Desde {formatFecha(u.date_joined)}
                  </div>
                </td>
                <td style={{ fontSize: '0.9rem', color: u.persona_nombre ? 'var(--text)' : 'var(--text-muted)' }}>
                  {u.persona_nombre ?? '—'}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span
                    className="chip"
                    style={{
                      fontSize: '0.78rem',
                      color: u.is_active ? 'var(--success)' : 'var(--text-muted)',
                    }}
                  >
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {u.grupos.length > 0
                    ? u.grupos.map((g) => g.name).join(', ')
                    : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {!u.is_superuser && (
                      <>
                        <button
                          onClick={() => abrirEditar(u)}
                          className="btn-ghost"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleActivo(u)}
                          className="btn-ghost"
                          style={{
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.82rem',
                            color: u.is_active ? 'var(--text-muted)' : 'var(--success)',
                          }}
                        >
                          {u.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </>
                    )}
                    {u.is_superuser && (
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Solo admin
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  )
}
