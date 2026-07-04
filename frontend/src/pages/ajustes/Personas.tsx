import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import { createPersona, getPersonasAdmin, updatePersona } from '../../api/ajustes'
import type { PersonaAdmin, PersonaPayload } from '../../api/ajustes'

// ── Constantes ───────────────────────────────────────────────────────────────

const VACIO: PersonaPayload = {
  nombres: '',
  apellidos: '',
  documento_identidad: null,
  telefono: '',
  es_socio: false,
  fecha_ingreso: null,
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

// ── Componente ───────────────────────────────────────────────────────────────

type FiltroSocio = 'todos' | 'socios' | 'no_socios'

export default function Personas() {
  const [personas, setPersonas] = useState<PersonaAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Búsqueda y filtros locales
  const [busqueda, setBusqueda] = useState('')
  const [filtroSocio, setFiltroSocio] = useState<FiltroSocio>('todos')

  // Formulario: null=cerrado, 0=nuevo, id=editando
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<PersonaPayload>({ ...VACIO })
  const [guardando, setGuardando] = useState(false)
  const [erroresForm, setErroresForm] = useState<string[]>([])

  useEffect(() => {
    getPersonasAdmin()
      .then(setPersonas)
      .catch(() => setError('No se pudo cargar la lista de personas.'))
      .finally(() => setLoading(false))
  }, [])

  // Filtrado local instantáneo
  const personasFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return personas.filter((p) => {
      const coincideBusqueda =
        !q ||
        p.nombre_completo.toLowerCase().includes(q) ||
        (p.documento_identidad ?? '').toLowerCase().includes(q) ||
        p.telefono.toLowerCase().includes(q)
      const coincideSocio =
        filtroSocio === 'todos' ||
        (filtroSocio === 'socios' && p.es_socio) ||
        (filtroSocio === 'no_socios' && !p.es_socio)
      return coincideBusqueda && coincideSocio
    })
  }, [personas, busqueda, filtroSocio])

  function abrirNuevo() {
    setForm({ ...VACIO })
    setErroresForm([])
    setEditId(0)
  }

  function abrirEditar(p: PersonaAdmin) {
    setForm({
      nombres: p.nombres,
      apellidos: p.apellidos,
      documento_identidad: p.documento_identidad,
      telefono: p.telefono,
      es_socio: p.es_socio,
      fecha_ingreso: p.fecha_ingreso,
    })
    setErroresForm([])
    setEditId(p.id)
  }

  function cerrar() {
    setEditId(null)
    setErroresForm([])
  }

  async function guardar() {
    if (!form.nombres.trim() || !form.apellidos.trim()) {
      setErroresForm(['Nombres y apellidos son obligatorios.'])
      return
    }
    // Normalizar campos vacíos a null
    const payload: PersonaPayload = {
      ...form,
      documento_identidad: form.documento_identidad?.trim() || null,
      telefono: form.telefono.trim(),
      fecha_ingreso: form.es_socio ? form.fecha_ingreso : null,
    }
    setGuardando(true)
    setErroresForm([])
    try {
      if (editId === 0) {
        const nueva = await createPersona(payload)
        setPersonas((prev) =>
          [...prev, nueva].sort((a, b) => a.apellidos.localeCompare(b.apellidos)),
        )
      } else if (editId !== null) {
        const actualizada = await updatePersona(editId, payload)
        setPersonas((prev) =>
          prev
            .map((p) => (p.id === editId ? actualizada : p))
            .sort((a, b) => a.apellidos.localeCompare(b.apellidos)),
        )
      }
      cerrar()
    } catch (err) {
      setErroresForm(aplanaErrores(err))
    } finally {
      setGuardando(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Personas
        </h1>
        {editId === null && (
          <button onClick={abrirNuevo} className="btn-gold" style={{ padding: '0.55rem 1rem' }}>
            + Nueva persona
          </button>
        )}
      </div>
      <p style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Registro de personas involucradas en el gobierno corporativo. No se pueden eliminar desde aquí.
      </p>

      {/* Formulario alta / edición */}
      {editId !== null && (
        <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--gold)' }}>
            {editId === 0 ? 'Nueva persona' : 'Editar persona'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nombres *</span>
              <input
                className="input"
                value={form.nombres}
                onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
                placeholder="Ej. Juan Carlos"
                autoFocus
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Apellidos *</span>
              <input
                className="input"
                value={form.apellidos}
                onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                placeholder="Ej. Paz García"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Documento de identidad</span>
              <input
                className="input"
                value={form.documento_identidad ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, documento_identidad: e.target.value || null }))}
                placeholder="CI, pasaporte, etc."
                maxLength={30}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Teléfono</span>
              <input
                className="input"
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="+591 7X XXX XXX"
              />
            </label>
          </div>

          {/* Socio */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.es_socio}
              onChange={(e) => setForm((f) => ({ ...f, es_socio: e.target.checked, fecha_ingreso: e.target.checked ? f.fecha_ingreso : null }))}
            />
            <span>Es socio de la empresa</span>
          </label>

          {form.es_socio && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', maxWidth: 260 }}>
              <span style={{ color: 'var(--text-muted)' }}>Fecha de ingreso como socio</span>
              <input
                type="date"
                className="input"
                value={form.fecha_ingreso ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, fecha_ingreso: e.target.value || null }))}
              />
            </label>
          )}

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

      {/* Barra de búsqueda y filtros */}
      {!loading && !error && (
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Buscar por nombre, CI o teléfono…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {(['todos', 'socios', 'no_socios'] as FiltroSocio[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroSocio(f)}
                className={filtroSocio === f ? 'btn-gold' : 'btn-ghost'}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                {f === 'todos' ? 'Todos' : f === 'socios' ? 'Socios' : 'No socios'}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {personasFiltradas.length} {personasFiltradas.length === 1 ? 'persona' : 'personas'}
          </span>
        </div>
      )}

      {/* Estados carga / error */}
      {loading && <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>}
      {error && <p className="alert-error" style={{ marginTop: '1rem' }}>{error}</p>}

      {/* Tabla */}
      {!loading && !error && (
        <table className="tabla" style={{ marginTop: '1rem' }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Doc. identidad</th>
              <th>Teléfono</th>
              <th>Socio</th>
              <th style={{ width: 90 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {personasFiltradas.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {busqueda || filtroSocio !== 'todos' ? 'Sin resultados para ese filtro.' : 'No hay personas registradas.'}
                </td>
              </tr>
            )}
            {personasFiltradas.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.nombre_completo}</div>
                  {p.es_socio && (
                    <span className="chip" style={{ fontSize: '0.72rem', marginTop: '0.15rem', color: 'var(--gold)' }}>
                      Socio{p.fecha_ingreso ? ` desde ${p.fecha_ingreso.split('-')[0]}` : ''}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: '0.9rem', color: p.documento_identidad ? 'var(--text)' : 'var(--text-muted)' }}>
                  {p.documento_identidad ?? '—'}
                </td>
                <td style={{ fontSize: '0.9rem', color: p.telefono ? 'var(--text)' : 'var(--text-muted)' }}>
                  {p.telefono || '—'}
                </td>
                <td style={{ textAlign: 'center', color: p.es_socio ? 'var(--success)' : 'var(--text-muted)' }}>
                  {p.es_socio ? 'Sí' : '—'}
                </td>
                <td>
                  <button
                    onClick={() => abrirEditar(p)}
                    className="btn-ghost"
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  )
}
