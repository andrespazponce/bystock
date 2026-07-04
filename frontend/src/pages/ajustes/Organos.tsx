import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import {
  createMiembro,
  createOrgano,
  deleteMiembro,
  getOrganosAdmin,
  getMiembros,
  updateMiembro,
  updateOrgano,
} from '../../api/ajustes'
import { getEmpresasAdmin } from '../../api/ajustes'
import type { EmpresaAdmin, MiembroAdmin, MiembroPayload, OrganoAdmin, OrganoPayload } from '../../api/ajustes'
import { getPersonas } from '../../api/reuniones'
import type { PersonaLite } from '../../api/reuniones'

// ── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_ORGANO = [
  { value: 'DIRECTORIO', label: 'Directorio' },
  { value: 'COMITE', label: 'Comité' },
]

const ROLES_MIEMBRO = [
  { value: 'PRESIDENTE', label: 'Presidente' },
  { value: 'VICEPRESIDENTE', label: 'Vicepresidente' },
  { value: 'SECRETARIO', label: 'Secretario' },
  { value: 'VOCAL', label: 'Vocal' },
  { value: 'MIEMBRO', label: 'Miembro' },
]

const VACIO_ORGANO: OrganoPayload = { empresa: 0, nombre: '', tipo: 'DIRECTORIO', descripcion: '', activo: true }

function vacioMiembro(organoId: number): MiembroPayload {
  return { organo: organoId, persona: 0, rol: 'MIEMBRO', fecha_inicio: null, fecha_fin: null, activo: true }
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
      return lista.map((m) => (campo === 'non_field_errors' || campo === 'detail' ? String(m) : `${campo}: ${m}`))
    })
  }
  return ['Error inesperado.']
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// ── Sub-componente: sección de miembros de un órgano ─────────────────────────

function SeccionMiembros({
  organoId,
  personas,
}: {
  organoId: number
  personas: PersonaLite[]
}) {
  const [miembros, setMiembros] = useState<MiembroAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editMId, setEditMId] = useState<number | null>(null) // null=cerrado, 0=nuevo, id=editando
  const [formM, setFormM] = useState<MiembroPayload>(vacioMiembro(organoId))
  const [guardandoM, setGuardandoM] = useState(false)
  const [erroresM, setErroresM] = useState<string[]>([])

  useEffect(() => {
    getMiembros(organoId)
      .then(setMiembros)
      .catch(() => setError('No se pudieron cargar los miembros.'))
      .finally(() => setLoading(false))
  }, [organoId])

  function abrirNuevo() {
    setFormM(vacioMiembro(organoId))
    setErroresM([])
    setEditMId(0)
  }

  function abrirEditar(m: MiembroAdmin) {
    setFormM({
      organo: organoId,
      persona: m.persona.id,
      rol: m.rol,
      fecha_inicio: m.fecha_inicio,
      fecha_fin: m.fecha_fin,
      activo: m.activo,
    })
    setErroresM([])
    setEditMId(m.id)
  }

  function cerrar() {
    setEditMId(null)
    setErroresM([])
  }

  async function guardar() {
    if (!formM.persona) { setErroresM(['Seleccioná una persona.']); return }
    setGuardandoM(true)
    setErroresM([])
    try {
      if (editMId === 0) {
        const nuevo = await createMiembro(formM)
        setMiembros((prev) => [...prev, nuevo])
      } else if (editMId !== null) {
        const actualizado = await updateMiembro(editMId, formM)
        setMiembros((prev) => prev.map((m) => (m.id === editMId ? actualizado : m)))
      }
      cerrar()
    } catch (err) {
      setErroresM(aplanaErrores(err))
    } finally {
      setGuardandoM(false)
    }
  }

  async function quitar(id: number) {
    if (!confirm('¿Quitar este miembro del órgano?')) return
    try {
      await deleteMiembro(id)
      setMiembros((prev) => prev.filter((m) => m.id !== id))
    } catch {
      setError('No se pudo quitar el miembro.')
    }
  }

  // Personas ya asignadas (excluir del selector al agregar)
  const idsAsignados = new Set(miembros.map((m) => m.persona.id))

  return (
    <div style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', padding: '1rem 1.2rem 1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>
          Miembros {miembros.length > 0 && `(${miembros.length})`}
        </span>
        {editMId === null && (
          <button onClick={abrirNuevo} className="btn-ghost" style={{ padding: '0.25rem 0.7rem', fontSize: '0.82rem' }}>
            + Agregar miembro
          </button>
        )}
      </div>

      {loading && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando…</p>}
      {error && <p className="alert-error" style={{ margin: '0 0 0.5rem' }}>{error}</p>}

      {/* Tabla de miembros */}
      {!loading && miembros.length > 0 && (
        <table className="tabla" style={{ marginBottom: editMId !== null ? '1rem' : 0 }}>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Rol</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Activo</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {miembros.map((m) => (
              <tr key={m.id} style={{ opacity: m.activo ? 1 : 0.5 }}>
                <td style={{ fontWeight: 500 }}>{m.persona.nombre_completo}</td>
                <td>{m.rol_display}</td>
                <td style={{ fontSize: '0.85rem' }}>{formatFecha(m.fecha_inicio)}</td>
                <td style={{ fontSize: '0.85rem' }}>{formatFecha(m.fecha_fin)}</td>
                <td style={{ color: m.activo ? 'var(--success)' : 'var(--text-muted)' }}>
                  {m.activo ? 'Sí' : 'No'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={() => abrirEditar(m)} className="btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}>
                      Editar
                    </button>
                    <button onClick={() => quitar(m.id)} className="btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', color: 'var(--danger)' }}>
                      Quitar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && miembros.length === 0 && editMId === null && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>Sin miembros aún.</p>
      )}

      {/* Formulario de miembro */}
      {editMId !== null && (
        <div className="card" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.9rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gold)' }}>
            {editMId === 0 ? 'Agregar miembro' : 'Editar miembro'}
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Persona *</span>
              <select
                className="select"
                value={formM.persona || ''}
                onChange={(e) => setFormM((f) => ({ ...f, persona: Number(e.target.value) }))}
                disabled={editMId !== 0} // no cambiar persona al editar
              >
                <option value="">— Seleccionar —</option>
                {personas
                  .filter((p) => editMId === 0 ? !idsAsignados.has(p.id) : true)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre_completo}</option>
                  ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Rol</span>
              <select
                className="select"
                value={formM.rol}
                onChange={(e) => setFormM((f) => ({ ...f, rol: e.target.value }))}
              >
                {ROLES_MIEMBRO.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fecha de inicio</span>
              <input
                type="date"
                className="input"
                value={formM.fecha_inicio ?? ''}
                onChange={(e) => setFormM((f) => ({ ...f, fecha_inicio: e.target.value || null }))}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fecha de fin</span>
              <input
                type="date"
                className="input"
                value={formM.fecha_fin ?? ''}
                onChange={(e) => setFormM((f) => ({ ...f, fecha_fin: e.target.value || null }))}
              />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formM.activo}
              onChange={(e) => setFormM((f) => ({ ...f, activo: e.target.checked }))}
            />
            <span>Miembro activo</span>
          </label>

          {erroresM.length > 0 && (
            <ul className="alert-error" style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {erroresM.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={guardar} disabled={guardandoM} className="btn-gold" style={{ padding: '0.4rem 1rem', fontSize: '0.88rem' }}>
              {guardandoM ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={cerrar} disabled={guardandoM} className="btn-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.88rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

const VACIO_ORGANO_FORM: OrganoPayload = { ...VACIO_ORGANO }

export default function Organos() {
  const [organos, setOrganos] = useState<OrganoAdmin[]>([])
  const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([])
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form órgano
  const [editId, setEditId] = useState<number | null>(null) // null=cerrado, 0=nuevo, id=editando
  const [form, setForm] = useState<OrganoPayload>({ ...VACIO_ORGANO_FORM })
  const [guardando, setGuardando] = useState(false)
  const [erroresForm, setErroresForm] = useState<string[]>([])

  // Sección de miembros expandida
  const [expandido, setExpandido] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([getOrganosAdmin(), getEmpresasAdmin(), getPersonas()])
      .then(([os, es, ps]) => {
        setOrganos(os)
        setEmpresas(es)
        setPersonas(ps)
      })
      .catch(() => setError('No se pudieron cargar los datos.'))
      .finally(() => setLoading(false))
  }, [])

  function abrirNuevo() {
    const primeraEmpresa = empresas.find((e) => e.activa)
    setForm({ ...VACIO_ORGANO_FORM, empresa: primeraEmpresa?.id ?? 0 })
    setErroresForm([])
    setEditId(0)
    setExpandido(null)
  }

  function abrirEditar(o: OrganoAdmin) {
    setForm({ empresa: o.empresa.id, nombre: o.nombre, tipo: o.tipo, descripcion: o.descripcion, activo: o.activo })
    setErroresForm([])
    setEditId(o.id)
    setExpandido(null)
  }

  function cerrarForm() {
    setEditId(null)
    setErroresForm([])
  }

  async function guardar() {
    if (!form.nombre.trim()) { setErroresForm(['El nombre es obligatorio.']); return }
    if (!form.empresa) { setErroresForm(['Seleccioná una empresa.']); return }
    setGuardando(true)
    setErroresForm([])
    try {
      if (editId === 0) {
        const nuevo = await createOrgano(form)
        setOrganos((prev) => [...prev, nuevo])
      } else if (editId !== null) {
        const actualizado = await updateOrgano(editId, form)
        setOrganos((prev) => prev.map((o) => (o.id === editId ? actualizado : o)))
      }
      cerrarForm()
    } catch (err) {
      setErroresForm(aplanaErrores(err))
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(organo: OrganoAdmin) {
    try {
      const actualizado = await updateOrgano(organo.id, { activo: !organo.activo })
      setOrganos((prev) => prev.map((o) => (o.id === organo.id ? actualizado : o)))
    } catch {
      setError('No se pudo cambiar el estado del órgano.')
    }
  }

  function toggleExpandir(id: number) {
    setExpandido((prev) => (prev === id ? null : id))
    setEditId(null)
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Órganos
        </h1>
        {editId === null && (
          <button onClick={abrirNuevo} className="btn-gold" style={{ padding: '0.55rem 1rem' }}>
            + Nuevo órgano
          </button>
        )}
      </div>

      <p style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Directorios y Comités del grupo corporativo. Los inactivos no aparecen en los selectores del portal.
      </p>

      {/* Formulario alta / edición */}
      {editId !== null && (
        <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--gold)' }}>
            {editId === 0 ? 'Nuevo órgano' : 'Editar órgano'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Empresa *</span>
              <select
                className="select"
                value={form.empresa || ''}
                onChange={(e) => setForm((f) => ({ ...f, empresa: Number(e.target.value) }))}
              >
                <option value="">— Seleccionar —</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tipo *</span>
              <select
                className="select"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                {TIPOS_ORGANO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Nombre *</span>
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej. Directorio GIPRO"
              autoFocus
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Descripción</span>
            <textarea
              className="input"
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              placeholder="Opcional"
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.activo}
              onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
            />
            <span>Órgano activo (visible en el portal)</span>
          </label>

          {erroresForm.length > 0 && (
            <ul className="alert-error" style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {erroresForm.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={guardar} disabled={guardando} className="btn-gold" style={{ padding: '0.5rem 1.2rem' }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={cerrarForm} disabled={guardando} className="btn-ghost" style={{ padding: '0.5rem 1rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Estados carga / error */}
      {loading && <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>}
      {error && <p className="alert-error" style={{ marginTop: '1.5rem' }}>{error}</p>}

      {/* Lista de órganos */}
      {!loading && !error && organos.length === 0 && (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>No hay órganos registrados.</p>
      )}

      {!loading && !error && organos.length > 0 && (
        <table className="tabla" style={{ marginTop: '1.5rem' }}>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th style={{ width: 200 }}>Acciones</th>
            </tr>
          </thead>
          {organos.map((o) => (
            <tbody key={o.id}>
              {/* Fila del órgano */}
              <tr style={{ opacity: o.activo ? 1 : 0.55 }}>
                <td>
                  <span className="chip" style={{ fontSize: '0.8rem' }}>{o.empresa.codigo}</span>
                </td>
                <td style={{ fontWeight: 600 }}>{o.nombre}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{o.tipo_display}</td>
                <td>
                  <span style={{ color: o.activo ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500 }}>
                    {o.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => abrirEditar(o)}
                      className="btn-ghost"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActivo(o)}
                      className="btn-ghost"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
                    >
                      {o.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => toggleExpandir(o.id)}
                      className={expandido === o.id ? 'btn-gold' : 'btn-ghost'}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
                    >
                      {expandido === o.id ? '▲ Miembros' : '▼ Miembros'}
                    </button>
                  </div>
                </td>
              </tr>

              {/* Fila expandida: sección de miembros */}
              {expandido === o.id && (
                <tr>
                  <td colSpan={5} style={{ padding: 0, borderBottom: '2px solid var(--border)' }}>
                    <SeccionMiembros organoId={o.id} personas={personas} />
                  </td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      )}
    </Layout>
  )
}
