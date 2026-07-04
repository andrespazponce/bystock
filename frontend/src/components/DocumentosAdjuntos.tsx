import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import axios from 'axios'
import {
  deleteDocumento,
  getDocumentos,
  uploadDocumento,
  TIPOS_DOCUMENTO,
} from '../api/documentos'
import type { Documento } from '../api/documentos'
import { descargarDocumento } from '../api/reuniones'

/**
 * Lista + formulario de subida de documentos adjuntos a un acta o a un punto.
 * Reutilizable: se le pasa `acta` O `punto` (el id correspondiente) y filtra/
 * vincula los documentos a ese contexto. `puede` controla si se muestran las
 * acciones de escritura (subir / quitar).
 */
export default function DocumentosAdjuntos({
  acta,
  punto,
  puede,
}: {
  acta?: number
  punto?: number
  puede: boolean
}) {
  const [docs, setDocs] = useState<Documento[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [descargando, setDescargando] = useState<number | null>(null)
  const [borrando, setBorrando] = useState<number | null>(null)

  // Formulario de subida.
  const [abierto, setAbierto] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState(TIPOS_DOCUMENTO[0]?.valor ?? 'OTRO')
  const [fecha, setFecha] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [inputKey, setInputKey] = useState(0) // truco para limpiar el <input file>
  const [errores, setErrores] = useState<string[]>([])
  const [subiendo, setSubiendo] = useState(false)

  // Filtro de carga según el contexto (acta o punto).
  const filtro = acta != null ? { acta } : punto != null ? { punto } : {}

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    getDocumentos(filtro)
      .then((data) => {
        if (!cancelado) setDocs(data.results)
      })
      .catch(() => {
        if (!cancelado) setErrorCarga('No se pudieron cargar los documentos.')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acta, punto])

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

  function abrirForm() {
    setTitulo('')
    setDescripcion('')
    setTipo(TIPOS_DOCUMENTO[0]?.valor ?? 'OTRO')
    setFecha('')
    setArchivo(null)
    setInputKey((k) => k + 1)
    setErrores([])
    setAbierto(true)
  }

  async function handleSubir(e: FormEvent) {
    e.preventDefault()
    setErrores([])
    if (!archivo) {
      setErrores(['Elegí un archivo para subir.'])
      return
    }
    setSubiendo(true)
    try {
      const creado = await uploadDocumento({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        tipo,
        fecha: fecha || null,
        archivo,
        acta: acta ?? null,
        punto: punto ?? null,
      })
      setDocs((prev) => [creado, ...prev])
      setAbierto(false)
    } catch (err) {
      setErrores(extraerErrores(err, 'No se pudo subir el documento.'))
    } finally {
      setSubiendo(false)
    }
  }

  async function handleDescargar(d: Documento) {
    setDescargando(d.id)
    try {
      await descargarDocumento(d.url_descarga, d.titulo)
    } catch {
      setErrorCarga('No se pudo descargar el documento.')
    } finally {
      setDescargando(null)
    }
  }

  async function handleQuitar(d: Documento) {
    if (!window.confirm(`¿Quitar el documento «${d.titulo}»?`)) return
    setBorrando(d.id)
    try {
      await deleteDocumento(d.id)
      setDocs((prev) => prev.filter((x) => x.id !== d.id))
    } catch (err) {
      setErrorCarga(extraerErrores(err, 'No se pudo quitar el documento.').join(' '))
    } finally {
      setBorrando(null)
    }
  }

  return (
    <div>
      {errorCarga && (
        <div className="alert-error" style={{ marginBottom: '0.75rem' }}>
          {errorCarga}
        </div>
      )}

      {cargando ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Cargando documentos…</p>
      ) : docs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Todavía no hay documentos adjuntos.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {docs.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{d.titulo}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {d.tipo_display}
                  {d.descripcion ? ` · ${d.descripcion}` : ''}
                </div>
              </div>
              <button
                className="btn-ghost"
                onClick={() => handleDescargar(d)}
                disabled={descargando === d.id}
                style={{ padding: '0.3rem 0.7rem', flexShrink: 0 }}
              >
                {descargando === d.id ? 'Descargando…' : 'Descargar'}
              </button>
              {puede && (
                <button
                  className="btn-ghost"
                  onClick={() => handleQuitar(d)}
                  disabled={borrando === d.id}
                  style={{ padding: '0.3rem 0.7rem', color: 'var(--danger)', flexShrink: 0 }}
                >
                  {borrando === d.id ? 'Quitando…' : 'Quitar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {puede &&
        (abierto ? (
          <form onSubmit={handleSubir} style={{ marginTop: '1rem' }}>
            <div
              className="card"
              style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderColor: 'var(--gold)' }}
            >
              <strong className="serif" style={{ color: 'var(--gold)' }}>
                Subir documento
              </strong>

              <Campo label="Título">
                <input
                  className="input"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                />
              </Campo>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Campo label="Tipo" style={{ flex: 1, minWidth: 180 }}>
                  <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    {TIPOS_DOCUMENTO.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Fecha (opcional)" style={{ flex: 1, minWidth: 160 }}>
                  <input
                    type="date"
                    className="input"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </Campo>
              </div>

              <Campo label="Descripción (opcional)">
                <textarea
                  className="input"
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </Campo>

              <Campo label="Archivo (PDF, Word, Excel o imagen)">
                <input
                  key={inputKey}
                  type="file"
                  className="input"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  required
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

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" disabled={subiendo} className="btn-gold" style={{ padding: '0.55rem 1.1rem' }}>
                  {subiendo ? 'Subiendo…' : 'Subir'}
                </button>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="btn-ghost"
                  style={{ padding: '0.55rem 1.1rem' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button className="btn-gold" onClick={abrirForm} style={{ marginTop: '1rem', padding: '0.55rem 1.1rem' }}>
            + Adjuntar documento
          </button>
        ))}
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
