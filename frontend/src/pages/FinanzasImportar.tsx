import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  type ResultadoImportacion,
  type TipoEstado,
  LABEL_TIPO_ESTADO,
  importarBalance,
} from '../api/finanzas'

const TIPOS: TipoEstado[] = ['BG', 'ER', 'FC']

export default function FinanzasImportar() {
  const navigate  = useNavigate()
  const inputRef  = useRef<HTMLInputElement>(null)

  const [tipoEstado, setTipoEstado] = useState<TipoEstado>('BG')
  const [archivo, setArchivo]       = useState<File | null>(null)
  const [cargando, setCargando]     = useState(false)
  const [resultado, setResultado]   = useState<ResultadoImportacion | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [dragging, setDragging]     = useState(false)

  // ── Selección de archivo ──────────────────────────────────────────────────

  function seleccionar(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Solo se aceptan archivos .xlsx o .xls')
      return
    }
    setArchivo(f)
    setError(null)
    setResultado(null)
  }

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) seleccionar(f)
  }, [])

  // ── Importar ──────────────────────────────────────────────────────────────

  async function handleImportar() {
    if (!archivo) return
    setCargando(true)
    setError(null)
    setResultado(null)
    try {
      const res = await importarBalance(archivo, tipoEstado)
      setResultado(res)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Error al importar el archivo.')
    } finally {
      setCargando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <button className="btn-ghost" style={{ padding: '0.35rem 0.7rem' }} onClick={() => navigate('/finanzas')}>
          ← Volver
        </button>
        <div>
          <h1 className="serif" style={{ fontSize: '1.5rem', margin: 0, color: 'var(--gold-strong)' }}>
            Importar Estado Financiero
          </h1>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Sube el consolidado (.xlsx / .xls) — todas las empresas y meses en un solo archivo
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 620 }}>

        {/* Selector de tipo de estado */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {TIPOS.map(t => (
            <button
              key={t}
              onClick={() => { setTipoEstado(t); setResultado(null); setError(null) }}
              style={{
                flex: 1,
                padding: '0.6rem 0.5rem',
                borderRadius: 8,
                border: `2px solid ${tipoEstado === t ? 'var(--gold)' : 'var(--border)'}`,
                background: tipoEstado === t ? 'rgba(201,168,76,0.10)' : 'var(--surface)',
                color: tipoEstado === t ? 'var(--gold-strong)' : 'var(--text-muted)',
                fontWeight: tipoEstado === t ? 700 : 400,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'center',
              }}
            >
              {LABEL_TIPO_ESTADO[t]}
            </button>
          ))}
        </div>

        {/* Zona drag-and-drop */}
        <div
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--gold)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'rgba(201,168,76,0.06)' : 'var(--surface)',
            transition: 'all 0.15s',
            marginBottom: '1.25rem',
          }}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) seleccionar(f) }} />
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{archivo ? '📊' : '📁'}</div>
          {archivo ? (
            <>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>{archivo.name}</p>
              <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                {(archivo.size / 1024).toFixed(1)} KB · click para cambiar
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)' }}>
                Arrastrá el archivo aquí o hacé click para seleccionar
              </p>
              <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Solo .xlsx o .xls
              </p>
            </>
          )}
        </div>

        {/* Instrucciones de formato */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--gold)' }}>
            Formato del Excel (un archivo puede tener todos los meses y empresas):
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              <tbody style={{ color: 'var(--text-muted)' }}>
                {[
                  ['Fila 1 →', '', 'Enero 2021', '', 'Febrero 2021', ''],
                  ['Fila 2 →', '', 'Incerpaz', 'Emp. B', 'Incerpaz', 'Emp. B'],
                  ['Activo Total', '', '1,500,000', '800,000', '1,600,000', '850,000'],
                  ['Activo Corriente', '', '900,000', '400,000', '950,000', '420,000'],
                  ['…', '', '…', '…', '…', '…'],
                ].map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '0.25rem 0.55rem',
                        border: '1px solid var(--border)',
                        background: ri < 2 ? 'rgba(201,168,76,0.07)' : 'transparent',
                        fontWeight: ri < 2 || ci === 0 ? 600 : 400,
                        color: ri < 2 ? 'var(--gold)' : ci === 0 ? 'var(--text)' : 'var(--text-muted)',
                      }}>
                        {cell || <span style={{ opacity: 0.3 }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.8 }}>
            <li><strong>Fila 1:</strong> períodos en las columnas de datos (pueden estar fusionados)</li>
            <li><strong>Fila 2:</strong> nombre de cada empresa (una por columna)</li>
            <li><strong>Resto:</strong> nombre de cuenta en col A, valores en col B, C, D…</li>
            <li>Los nombres de empresa deben coincidir con los registrados en el sistema</li>
          </ul>
        </div>

        {/* Botón importar */}
        <button
          className="btn-gold"
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', opacity: !archivo || cargando ? 0.6 : 1 }}
          disabled={!archivo || cargando}
          onClick={handleImportar}
        >
          {cargando ? 'Importando…' : '↑ Importar Balance'}
        </button>

        {/* Error */}
        {error && (
          <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 8, color: 'var(--danger)', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {/* Resultado exitoso */}
        {resultado && (
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'rgba(52,211,153,0.08)', border: '1px solid var(--success)', borderRadius: 10 }}>
            <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>
              ✓ Importación exitosa
            </p>

            {/* Períodos procesados */}
            <p style={{ margin: '0 0 0.9rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {resultado.periodos.length === 1
                ? `Período: ${resultado.periodos[0]}`
                : `Períodos: ${resultado.periodos.join(' · ')}`}
            </p>

            {/* Tabla por empresa */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>Empresa</th>
                  <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>Cuentas importadas</th>
                </tr>
              </thead>
              <tbody>
                {resultado.empresas.map((e, i) => (
                  <tr key={i}>
                    <td style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{e.nombre}</td>
                    <td style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 600, color: 'var(--gold)' }}>{e.importados}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700, color: 'var(--text)' }}>
                    Total ({resultado.periodos.length} período{resultado.periodos.length !== 1 ? 's' : ''})
                  </td>
                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--gold-strong)' }}>{resultado.importados}</td>
                </tr>
              </tbody>
            </table>

            {/* Cuentas no reconocidas */}
            {resultado.no_encontrados.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--gold)' }}>
                  Cuentas no reconocidas ({resultado.no_encontrados.length}) — no se importaron:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  {resultado.no_encontrados.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn-gold" style={{ padding: '0.45rem 1rem' }} onClick={() => navigate('/finanzas')}>
                Ver dashboard
              </button>
              <button className="btn-ghost" style={{ padding: '0.45rem 0.9rem' }} onClick={() => { setArchivo(null); setResultado(null) }}>
                Importar otro archivo
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
