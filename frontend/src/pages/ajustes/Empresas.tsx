import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { createEmpresa, getEmpresasAdmin, updateEmpresa } from '../../api/ajustes'
import type { EmpresaAdmin, EmpresaPayload } from '../../api/ajustes'

const VACIO: EmpresaPayload = { nombre: '', codigo: '', activa: true }

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

export default function Empresas() {
  const [empresas, setEmpresas] = useState<EmpresaAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Formulario: null = cerrado, 0 = nueva, >0 = editando id
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<EmpresaPayload>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [erroresForm, setErroresForm] = useState<string[]>([])

  useEffect(() => {
    cargar()
  }, [])

  function cargar() {
    setLoading(true)
    setError(null)
    getEmpresasAdmin()
      .then(setEmpresas)
      .catch(() => setError('No se pudo cargar la lista de empresas.'))
      .finally(() => setLoading(false))
  }

  function abrirNueva() {
    setForm(VACIO)
    setErroresForm([])
    setEditId(0)
  }

  function abrirEditar(e: EmpresaAdmin) {
    setForm({ nombre: e.nombre, codigo: e.codigo, activa: e.activa })
    setErroresForm([])
    setEditId(e.id)
  }

  function cerrarForm() {
    setEditId(null)
    setErroresForm([])
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.codigo.trim()) {
      setErroresForm(['El nombre y el código son obligatorios.'])
      return
    }
    setGuardando(true)
    setErroresForm([])
    try {
      if (editId === 0) {
        // Crear
        const nueva = await createEmpresa(form)
        setEmpresas((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      } else if (editId !== null) {
        // Editar
        const actualizada = await updateEmpresa(editId, form)
        setEmpresas((prev) =>
          prev.map((e) => (e.id === editId ? actualizada : e)).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        )
      }
      cerrarForm()
    } catch (err) {
      setErroresForm(aplanaErrores(err))
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActiva(empresa: EmpresaAdmin) {
    try {
      const actualizada = await updateEmpresa(empresa.id, { activa: !empresa.activa })
      setEmpresas((prev) => prev.map((e) => (e.id === empresa.id ? actualizada : e)))
    } catch {
      setError('No se pudo cambiar el estado de la empresa.')
    }
  }

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          Empresas
        </h1>
        {editId === null && (
          <button onClick={abrirNueva} className="btn-gold" style={{ padding: '0.55rem 1rem' }}>
            + Nueva empresa
          </button>
        )}
      </div>

      <p style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Empresas del grupo corporativo. Las inactivas no aparecen en los selectores del portal.
      </p>

      {/* Formulario alta / edición */}
      {editId !== null && (
        <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--gold)' }}>
            {editId === 0 ? 'Nueva empresa' : 'Editar empresa'}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nombre *</span>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. GIPRO S.R.L."
                autoFocus
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Código *</span>
              <input
                className="input"
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                placeholder="Ej. GIPRO"
                maxLength={20}
              />
            </label>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))}
            />
            <span>Empresa activa (visible en el portal)</span>
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

      {/* Tabla */}
      {!loading && !error && (
        <table className="tabla" style={{ marginTop: '1.5rem' }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Estado</th>
              <th style={{ width: 120 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay empresas registradas.
                </td>
              </tr>
            )}
            {empresas.map((e) => (
              <tr key={e.id} style={{ opacity: e.activa ? 1 : 0.55 }}>
                <td style={{ fontWeight: 600 }}>{e.nombre}</td>
                <td>
                  <span className="chip" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{e.codigo}</span>
                </td>
                <td>
                  <span style={{ color: e.activa ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500 }}>
                    {e.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => abrirEditar(e)}
                      className="btn-ghost"
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActiva(e)}
                      className="btn-ghost"
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.82rem' }}
                      title={e.activa ? 'Desactivar empresa' : 'Activar empresa'}
                    >
                      {e.activa ? 'Desactivar' : 'Activar'}
                    </button>
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
