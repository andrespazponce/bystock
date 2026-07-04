import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import {
  agregarUsuarioAGrupo,
  getGrupoDetalle,
  getGrupos,
  getUsuariosAdmin,
  quitarUsuarioDeGrupo,
} from '../../api/ajustes'
import type { GrupoDetalle, UsuarioAdmin } from '../../api/ajustes'

// ── Componente ───────────────────────────────────────────────────────────────

export default function Grupos() {
  const [grupos, setGrupos] = useState<GrupoDetalle[]>([])
  const [todosUsuarios, setTodosUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Por grupo: qué usuario se está por agregar
  const [seleccion, setSeleccion] = useState<Record<number, string>>({})
  // Por (grupoId + userId): está operando
  const [operando, setOperando] = useState<string | null>(null)
  // Por grupo: error
  const [errores, setErrores] = useState<Record<number, string>>({})

  useEffect(() => {
    Promise.all([getGrupos(), getUsuariosAdmin()])
      .then(async ([listaGrupos, usuarios]) => {
        setTodosUsuarios(usuarios)
        const detalles = await Promise.all(listaGrupos.map((g) => getGrupoDetalle(g.id)))
        setGrupos(detalles)
      })
      .catch(() => setError('No se pudo cargar la información de grupos.'))
      .finally(() => setLoading(false))
  }, [])

  function setError1(grupoId: number, msg: string) {
    setErrores((prev) => ({ ...prev, [grupoId]: msg }))
  }

  function clearError(grupoId: number) {
    setErrores((prev) => {
      const next = { ...prev }
      delete next[grupoId]
      return next
    })
  }

  async function agregar(grupoId: number) {
    const uid = Number(seleccion[grupoId])
    if (!uid) return
    const key = `add-${grupoId}-${uid}`
    setOperando(key)
    clearError(grupoId)
    try {
      const actualizado = await agregarUsuarioAGrupo(grupoId, uid)
      setGrupos((prev) => prev.map((g) => (g.id === grupoId ? actualizado : g)))
      setSeleccion((prev) => ({ ...prev, [grupoId]: '' }))
    } catch {
      setError1(grupoId, 'No se pudo agregar el usuario.')
    } finally {
      setOperando(null)
    }
  }

  async function quitar(grupoId: number, usuarioId: number) {
    const key = `rm-${grupoId}-${usuarioId}`
    setOperando(key)
    clearError(grupoId)
    try {
      const actualizado = await quitarUsuarioDeGrupo(grupoId, usuarioId)
      setGrupos((prev) => prev.map((g) => (g.id === grupoId ? actualizado : g)))
    } catch {
      setError1(grupoId, 'No se pudo quitar el usuario.')
    } finally {
      setOperando(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Cabecera */}
      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        Grupos
      </h1>
      <p style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Perfiles de permisos del portal. Agrega o quita usuarios de cada grupo para controlar qué pueden hacer.
      </p>

      {loading && <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>}
      {error && <p className="alert-error" style={{ marginTop: '1rem' }}>{error}</p>}

      {!loading && !error && (
        <div style={{
          marginTop: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: '1.5rem',
        }}>
          {grupos.map((grupo) => (
            <TarjetaGrupo
              key={grupo.id}
              grupo={grupo}
              todosUsuarios={todosUsuarios}
              seleccionado={seleccion[grupo.id] ?? ''}
              onSeleccionar={(v) => setSeleccion((prev) => ({ ...prev, [grupo.id]: v }))}
              onAgregar={() => agregar(grupo.id)}
              onQuitar={(uid) => quitar(grupo.id, uid)}
              operando={operando}
              error={errores[grupo.id]}
            />
          ))}
        </div>
      )}
    </Layout>
  )
}

// ── TarjetaGrupo ─────────────────────────────────────────────────────────────

interface TarjetaGrupoProps {
  grupo: GrupoDetalle
  todosUsuarios: UsuarioAdmin[]
  seleccionado: string
  onSeleccionar: (v: string) => void
  onAgregar: () => void
  onQuitar: (uid: number) => void
  operando: string | null
  error?: string
}

function TarjetaGrupo({
  grupo,
  todosUsuarios,
  seleccionado,
  onSeleccionar,
  onAgregar,
  onQuitar,
  operando,
  error,
}: TarjetaGrupoProps) {
  const idsEnGrupo = useMemo(
    () => new Set(grupo.usuarios.map((u) => u.id)),
    [grupo.usuarios],
  )

  // Usuarios que se pueden agregar: activos, no superusuarios, no ya en el grupo
  const disponibles = useMemo(
    () => todosUsuarios.filter((u) => !u.is_superuser && u.is_active && !idsEnGrupo.has(u.id)),
    [todosUsuarios, idsEnGrupo],
  )

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Encabezado */}
      <div>
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', color: 'var(--gold)' }}>
          {grupo.name}
        </h2>
        {grupo.descripcion && (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {grupo.descripcion}
          </p>
        )}
      </div>

      {/* Miembros actuales */}
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Miembros ({grupo.usuarios.length})
        </div>
        {grupo.usuarios.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Sin miembros asignados.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {grupo.usuarios.map((u) => {
              const keyRm = `rm-${grupo.id}-${u.id}`
              const estaQuitando = operando === keyRm
              return (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.4rem 0.6rem',
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius)',
                    opacity: estaQuitando ? 0.5 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </div>
                    {u.persona_nombre && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {u.persona_nombre}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onQuitar(u.id)}
                    disabled={operando !== null}
                    className="btn-ghost"
                    style={{ padding: '0.2rem 0.55rem', fontSize: '0.78rem', flexShrink: 0, color: 'var(--text-muted)' }}
                    title="Quitar del grupo"
                  >
                    {estaQuitando ? '…' : '✕'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Agregar usuario */}
      {disponibles.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Agregar usuario
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="input"
              style={{ flex: 1 }}
              value={seleccionado}
              onChange={(e) => onSeleccionar(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {disponibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.persona_nombre ? `${u.persona_nombre} (${u.email})` : u.email}
                </option>
              ))}
            </select>
            <button
              onClick={onAgregar}
              disabled={!seleccionado || operando !== null}
              className="btn-gold"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.88rem', flexShrink: 0 }}
            >
              {operando?.startsWith(`add-${grupo.id}`) ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {disponibles.length === 0 && grupo.usuarios.length > 0 && (
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Todos los usuarios activos ya están en este grupo.
        </p>
      )}

      {error && (
        <p className="alert-error" style={{ margin: 0, fontSize: '0.85rem' }}>{error}</p>
      )}
    </div>
  )
}
