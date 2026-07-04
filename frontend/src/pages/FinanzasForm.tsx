import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import apiClient from '../api/client'
import {
  type TipoReporte,
  type PeriodoTipo,
  type ReporteFinanciero,
  LABEL_TIPO,
  LABEL_PERIODO,
  TIPOS_REPORTE,
  MESES,
  getReporte,
  subirReporte,
  editarReporte,
} from '../api/finanzas'

interface Empresa { id: number; nombre: string; codigo: string }

function Campo({ label, children, requerido }: { label: string; children: React.ReactNode; requerido?: boolean }) {
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
        {label}{requerido && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
}

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = Array.from({ length: 10 }, (_, i) => ANIO_ACTUAL - i)

export default function FinanzasForm() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const modoEdicion = Boolean(id)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [reporteOriginal, setReporteOriginal] = useState<ReporteFinanciero | null>(null)
  const [cargandoInicial, setCargandoInicial] = useState(true)

  // Campos
  const [empresa, setEmpresa] = useState<number | ''>('')
  const [tipo, setTipo] = useState<TipoReporte | ''>('')
  const [periodTipo, setPeriodTipo] = useState<PeriodoTipo | ''>('')
  const [anio, setAnio] = useState<number>(ANIO_ACTUAL)
  const [mes, setMes] = useState<number | ''>('')
  const [trimestre, setTrimestre] = useState<number | ''>('')
  const [semestre, setSemestre] = useState<number | ''>('')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [publicado, setPublicado] = useState(true)
  const [archivo, setArchivo] = useState<File | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])

  // Cargar empresas
  useEffect(() => {
    apiClient.get('/api/empresas/').then(res => {
      const data = Array.isArray(res.data) ? res.data : (res.data.results ?? [])
      setEmpresas(data)
    }).catch(() => {})
  }, [])

  // Cargar reporte si es edición
  useEffect(() => {
    if (!modoEdicion || !id) {
      setCargandoInicial(false)
      return
    }
    getReporte(parseInt(id)).then(r => {
      setReporteOriginal(r)
      setEmpresa(r.empresa)
      setTipo(r.tipo)
      setPeriodTipo(r.periodo_tipo)
      setAnio(r.anio)
      setMes(r.mes ?? '')
      setTrimestre(r.trimestre ?? '')
      setSemestre(r.semestre ?? '')
      setTitulo(r.titulo)
      setDescripcion(r.descripcion)
      setPublicado(r.publicado)
    }).catch(() => {}).finally(() => setCargandoInicial(false))
  }, [id, modoEdicion])

  // Cuando cambia el tipo de período, limpiar sub-campos
  function handlePeriodTipo(val: PeriodoTipo | '') {
    setPeriodTipo(val)
    setMes('')
    setTrimestre('')
    setSemestre('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrores([])

    const errs: string[] = []
    if (!empresa) errs.push('Seleccioná una empresa.')
    if (!tipo) errs.push('Seleccioná el tipo de reporte.')
    if (!periodTipo) errs.push('Seleccioná el tipo de período.')
    if (periodTipo === 'MENSUAL' && !mes) errs.push('Seleccioná el mes.')
    if (periodTipo === 'TRIMESTRAL' && !trimestre) errs.push('Seleccioná el trimestre.')
    if (periodTipo === 'SEMESTRAL' && !semestre) errs.push('Seleccioná el semestre.')
    if (!modoEdicion && !archivo) errs.push('Adjuntá el archivo del reporte.')
    if (errs.length) { setErrores(errs); return }

    const fd = new FormData()
    fd.append('empresa', String(empresa))
    fd.append('tipo', tipo as string)
    fd.append('periodo_tipo', periodTipo as string)
    fd.append('anio', String(anio))
    if (periodTipo === 'MENSUAL' && mes) fd.append('mes', String(mes))
    if (periodTipo === 'TRIMESTRAL' && trimestre) fd.append('trimestre', String(trimestre))
    if (periodTipo === 'SEMESTRAL' && semestre) fd.append('semestre', String(semestre))
    fd.append('titulo', titulo)
    fd.append('descripcion', descripcion)
    fd.append('publicado', publicado ? 'true' : 'false')
    if (archivo) fd.append('archivo', archivo)

    setGuardando(true)
    try {
      if (modoEdicion && id) {
        await editarReporte(parseInt(id), fd)
        navigate(`/finanzas/${id}`)
      } else {
        const nuevo = await subirReporte(fd)
        navigate(`/finanzas/${nuevo.id}`)
      }
    } catch (err: unknown) {
      // Extraer errores de DRF
      const data = (err as { response?: { data?: unknown } })?.response?.data
      if (data && typeof data === 'object') {
        const msgs: string[] = []
        for (const [campo, val] of Object.entries(data as Record<string, unknown>)) {
          const valStr = Array.isArray(val) ? val.join(' ') : String(val)
          msgs.push(`${campo}: ${valStr}`)
        }
        setErrores(msgs.length ? msgs : ['Error al guardar.'])
      } else {
        setErrores(['Error al guardar el reporte.'])
      }
    } finally {
      setGuardando(false)
    }
  }

  if (cargandoInicial) {
    return <Layout><p style={{ color: 'var(--text-muted)' }}>Cargando…</p></Layout>
  }

  return (
    <Layout>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
        <button onClick={() => navigate(modoEdicion && id ? `/finanzas/${id}` : '/finanzas')} className="btn-ghost">
          ← Volver
        </button>
        <h1 className="serif" style={{ fontSize: '1.5rem', margin: 0, color: 'var(--gold-strong)' }}>
          {modoEdicion ? 'Editar reporte' : 'Subir reporte financiero'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>

        {/* Sección: Identificación */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 1.1rem' }}>
            Identificación
          </h2>

          <Campo label="Empresa" requerido>
            <select value={empresa} onChange={e => setEmpresa(Number(e.target.value))} style={INPUT}>
              <option value="">— Seleccionar empresa —</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nombre}</option>
              ))}
            </select>
          </Campo>

          <Campo label="Tipo de reporte" requerido>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoReporte)} style={INPUT}>
              <option value="">— Seleccionar tipo —</option>
              {TIPOS_REPORTE.map(t => (
                <option key={t} value={t}>{LABEL_TIPO[t]}</option>
              ))}
            </select>
          </Campo>

          <Campo label="Título personalizado (opcional)">
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Auditada por Deloitte"
              style={INPUT}
            />
          </Campo>
        </div>

        {/* Sección: Período */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 1.1rem' }}>
            Período
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Campo label="Tipo de período" requerido>
              <select value={periodTipo} onChange={e => handlePeriodTipo(e.target.value as PeriodoTipo | '')} style={INPUT}>
                <option value="">— Seleccionar —</option>
                {(['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'] as PeriodoTipo[]).map(p => (
                  <option key={p} value={p}>{LABEL_PERIODO[p]}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Año" requerido>
              <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={INPUT}>
                {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Campo>
          </div>

          {periodTipo === 'MENSUAL' && (
            <Campo label="Mes" requerido>
              <select value={mes} onChange={e => setMes(Number(e.target.value))} style={INPUT}>
                <option value="">— Seleccionar mes —</option>
                {MESES.slice(1).map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </Campo>
          )}

          {periodTipo === 'TRIMESTRAL' && (
            <Campo label="Trimestre" requerido>
              <select value={trimestre} onChange={e => setTrimestre(Number(e.target.value))} style={INPUT}>
                <option value="">— Seleccionar —</option>
                {[1, 2, 3, 4].map(t => (
                  <option key={t} value={t}>T{t} — {['Ene–Mar', 'Abr–Jun', 'Jul–Sep', 'Oct–Dic'][t - 1]}</option>
                ))}
              </select>
            </Campo>
          )}

          {periodTipo === 'SEMESTRAL' && (
            <Campo label="Semestre" requerido>
              <select value={semestre} onChange={e => setSemestre(Number(e.target.value))} style={INPUT}>
                <option value="">— Seleccionar —</option>
                <option value={1}>S1 — Ene–Jun</option>
                <option value={2}>S2 — Jul–Dic</option>
              </select>
            </Campo>
          )}
        </div>

        {/* Sección: Archivo y descripción */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 1.1rem' }}>
            Archivo y notas
          </h2>

          <Campo label={modoEdicion ? 'Reemplazar archivo (opcional)' : 'Archivo'} requerido={!modoEdicion}>
            <input
              type="file"
              ref={archivoRef}
              accept=".pdf,.xlsx,.xls,.doc,.docx,.csv,.jpg,.jpeg,.png"
              onChange={e => setArchivo(e.target.files?.[0] ?? null)}
              style={{ ...INPUT, cursor: 'pointer' }}
            />
            {modoEdicion && reporteOriginal && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Archivo actual: <strong>{reporteOriginal.sha256.slice(0, 10)}…</strong> — dejá vacío para no cambiarlo.
              </p>
            )}
            {archivo && (
              <p style={{ fontSize: '0.82rem', color: 'var(--gold)', marginTop: '0.35rem' }}>
                ✓ {archivo.name} ({(archivo.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </Campo>

          <Campo label="Descripción (opcional)">
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Notas adicionales sobre este reporte…"
              style={{ ...INPUT, resize: 'vertical' }}
            />
          </Campo>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={publicado}
              onChange={e => setPublicado(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span>Publicado — visible para todos los socios</span>
          </label>
        </div>

        {/* Errores */}
        {errores.length > 0 && (
          <div className="alert-error" style={{ marginBottom: '1rem' }}>
            {errores.map((e, i) => <p key={i} style={{ margin: i === 0 ? 0 : '0.25rem 0 0' }}>{e}</p>)}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="submit" className="btn-gold" style={{ padding: '0.6rem 1.5rem' }} disabled={guardando}>
            {guardando ? 'Guardando…' : modoEdicion ? 'Guardar cambios' : 'Subir reporte'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => navigate(modoEdicion && id ? `/finanzas/${id}` : '/finanzas')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </Layout>
  )
}
