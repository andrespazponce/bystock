import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../auth/AuthContext'
import apiClient from '../api/client'
import {
  type Activo,
  type ActivoDocumento,
  type ActivoPayload,
  type Categoria,
  type Estado,
  type EstadoInmueble,
  type TipoActivo,
  DEPARTAMENTOS_BOLIVIA,
  LABEL_CATEGORIA,
  LABEL_ESTADO,
  LABEL_ESTADO_INMUEBLE,
  LABEL_TIPO,
  TIPO_A_CATEGORIA,
  TIPOS_POR_CATEGORIA,
  createActivo,
  deleteActivoDocumento,
  getActivo,
  getActivoDocumentos,
  updateActivo,
  uploadActivoDocumento,
} from '../api/activos'
import BuscadorGoogleMaps from '../components/BuscadorGoogleMaps'
import type { DatosUbicacion } from '../components/BuscadorGoogleMaps'

interface Empresa { id: number; nombre: string }

// ── Helpers de formateo numérico ─────────────────────────────────────────────

/** Formatea un número con separador de miles y 2 decimales (locale es-BO). */
function formatearNumero(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const str = String(raw).replace(',', '.')
  const num = parseFloat(str)
  if (isNaN(num)) return String(raw)
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/** Limpia un string formateado para volver al valor numérico crudo. */
function limpiarNumero(display: string): string {
  // es-BO usa "." para miles y "," para decimales → quitamos puntos, reemplazamos coma
  return display.replace(/\./g, '').replace(',', '.')
}

// ── Componente NumericInput ───────────────────────────────────────────────────
/**
 * Input de texto que formatea automáticamente con separadores de miles.
 * - Al enfocar: muestra el valor crudo (ej. "1234567.89")
 * - Al perder foco: muestra el valor formateado (ej. "1.234.567,89")
 * - Mientras escribe: actualiza el valor crudo en tiempo real
 */
function NumericInput({
  value,
  onChange,
  placeholder = '0,00',
  style,
}: {
  value: string | null | undefined
  onChange: (rawValue: string) => void
  placeholder?: string
  style?: CSSProperties
}) {
  const [enfocado, setEnfocado] = useState(false)
  const rawStr = value != null && value !== '' ? String(value) : ''

  return (
    <input
      type="text"
      inputMode="decimal"
      className="input"
      style={style}
      value={enfocado ? rawStr : formatearNumero(rawStr)}
      placeholder={placeholder}
      onFocus={() => setEnfocado(true)}
      onBlur={() => setEnfocado(false)}
      onChange={(e) => {
        // Permitir solo dígitos, punto y coma. Si escribe con coma como decimal → limpiar
        const v = e.target.value.replace(/[^\d.,]/g, '')
        onChange(limpiarNumero(v))
      }}
    />
  )
}

// ── Campo genérico ────────────────────────────────────────────────────────────
function Campo({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', ...style }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

// ── Icono por extensión ───────────────────────────────────────────────────────
function IconoArchivo({ ext }: { ext: string }) {
  const iconos: Record<string, string> = {
    pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', webp: '🖼️',
    doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', zip: '📦',
  }
  return <span>{iconos[ext] ?? '📎'}</span>
}

// ── Estado inicial del formulario ─────────────────────────────────────────────
const VACIO: ActivoPayload = {
  nombre: '',
  empresa: 0,
  tipo: 'LOTE',
  estado: 'ACTIVO',
  valor: '',
  fecha_adquisicion: '',
  notas: '',
  departamento: '',
  ciudad: '',
  direccion: '',
  latitud: '',
  longitud: '',
  estado_inmueble: 'SIN_PROYECTO',
  area_m2: '',
  nro_catastral: '',
  nro_habitaciones: undefined,
  placa: '',
  marca: '',
  modelo_descripcion: '',
  anio: undefined,
  nro_serie: '',
  color: '',
}

// ── Sección de documentos (solo en modo edición) ───────────────────────────────
function SeccionDocumentos({ activoId }: { activoId: number }) {
  const [documentos, setDocumentos] = useState<ActivoDocumento[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [errorDoc, setErrorDoc] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getActivoDocumentos(activoId)
      .then(setDocumentos)
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [activoId])

  async function handleSubir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    setErrorDoc(null)
    try {
      const doc = await uploadActivoDocumento(activoId, archivo, titulo || undefined)
      setDocumentos(prev => [doc, ...prev])
      setTitulo('')
      if (inputRef.current) inputRef.current.value = ''
    } catch {
      setErrorDoc('No se pudo subir el archivo. Verificá el tamaño (máx. 30 MB).')
    } finally {
      setSubiendo(false)
    }
  }

  async function handleEliminar(id: number) {
    if (!confirm('¿Eliminar este documento?')) return
    try {
      await deleteActivoDocumento(id)
      setDocumentos(prev => prev.filter(d => d.id !== id))
    } catch {
      setErrorDoc('No se pudo eliminar el documento.')
    }
  }

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
      <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 0.25rem' }}>
        Documentos adjuntos
      </h2>

      {/* Formulario de subida */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Campo label="Descripción del documento (opcional)">
          <input
            className="input"
            placeholder="Ej: Escritura pública, Plano catastral, Póliza de seguro…"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            style={{ maxWidth: 400 }}
          />
        </Campo>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: '1px dashed var(--gold)',
              color: 'var(--gold)',
              cursor: subiendo ? 'not-allowed' : 'pointer',
              fontSize: '0.88rem',
              fontWeight: 600,
              opacity: subiendo ? 0.6 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--gold-soft)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            📎 {subiendo ? 'Subiendo…' : 'Seleccionar archivo'}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.zip,.rar"
              style={{ display: 'none' }}
              disabled={subiendo}
              onChange={handleSubir}
            />
          </label>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            PDF, imagen, Word, Excel, ZIP · Máx. 30 MB
          </span>
        </div>
        {errorDoc && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{errorDoc}</p>}
      </div>

      {/* Lista de documentos */}
      {cargando && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando…</p>}
      {!cargando && documentos.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
          Sin documentos adjuntos todavía.
        </p>
      )}
      {documentos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {documentos.map(doc => (
            <div
              key={doc.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.55rem 0.75rem',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
              }}
            >
              <IconoArchivo ext={doc.extension} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.titulo || doc.nombre_archivo}
                </div>
                {doc.titulo && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.nombre_archivo}
                  </div>
                )}
              </div>
              <a
                href={doc.url_archivo}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', border: 'none', color: 'var(--gold)' }}
              >
                ↓ Ver
              </a>
              <button
                type="button"
                onClick={() => handleEliminar(doc.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '1rem', padding: '0.2rem 0.4rem',
                  borderRadius: 4, lineHeight: 1,
                }}
                title="Eliminar documento"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ActivoForm() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const esEdicion = Boolean(id)
  const { user } = useAuth()
  const puede = !!user?.is_staff

  const [form, setForm] = useState<ActivoPayload>({ ...VACIO })
  const [categoria, setCategoria] = useState<Categoria>('INMUEBLE')
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errores, setErrores] = useState<string[]>([])

  useEffect(() => {
    let cancelado = false
    setCargando(true)

    Promise.all([
      apiClient.get('/api/empresas/').then(r => r.data.results ?? r.data),
      esEdicion && id ? getActivo(parseInt(id)) : Promise.resolve(null),
    ])
      .then(([emps, activo]: [Empresa[], Activo | null]) => {
        if (cancelado) return
        setEmpresas(emps)
        if (activo) {
          setCategoria(activo.categoria)
          setForm({
            nombre: activo.nombre,
            empresa: activo.empresa,
            tipo: activo.tipo,
            estado: activo.estado,
            valor: activo.valor ?? '',
            fecha_adquisicion: activo.fecha_adquisicion ?? '',
            notas: activo.notas,
            departamento: activo.departamento,
            ciudad: activo.ciudad,
            direccion: activo.direccion,
            latitud: activo.latitud ?? '',
            longitud: activo.longitud ?? '',
            estado_inmueble: activo.estado_inmueble ?? 'SIN_PROYECTO',
            area_m2: activo.area_m2 ?? '',
            nro_catastral: activo.nro_catastral,
            nro_habitaciones: activo.nro_habitaciones ?? undefined,
            placa: activo.placa,
            marca: activo.marca,
            modelo_descripcion: activo.modelo_descripcion,
            anio: activo.anio ?? undefined,
            nro_serie: activo.nro_serie,
            color: activo.color,
          })
        }
      })
      .catch(() => {
        if (!cancelado) setErrores(['No se pudieron cargar los datos del formulario.'])
      })
      .finally(() => { if (!cancelado) setCargando(false) })

    return () => { cancelado = true }
  }, [id, esEdicion])

  function set(campo: keyof ActivoPayload, valor: unknown) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function onTipoChange(tipo: TipoActivo) {
    set('tipo', tipo)
    setCategoria(TIPO_A_CATEGORIA[tipo])
  }

  function onUbicacionSeleccionada(datos: DatosUbicacion) {
    setForm(prev => ({
      ...prev,
      direccion: datos.direccion,
      ciudad: datos.ciudad,
      departamento: datos.departamento || prev.departamento,
      latitud: datos.latitud,
      longitud: datos.longitud,
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.empresa) { setErrores(['Seleccioná la empresa.']); return }
    setErrores([])

    const payload: ActivoPayload = {
      ...form,
      valor: form.valor === '' ? null : form.valor,
      fecha_adquisicion: form.fecha_adquisicion === '' ? null : form.fecha_adquisicion,
      latitud: form.latitud === '' ? null : form.latitud,
      longitud: form.longitud === '' ? null : form.longitud,
      area_m2: form.area_m2 === '' ? null : form.area_m2,
    }

    setGuardando(true)
    try {
      const guardado = esEdicion && id
        ? await updateActivo(parseInt(id), payload)
        : await createActivo(payload)
      navigate(`/activos/${guardado.id}`)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400 && err.response.data) {
        const data = err.response.data as Record<string, unknown>
        const msgs: string[] = []
        for (const v of Object.values(data)) {
          if (Array.isArray(v)) msgs.push(...v.map(String))
          else if (v) msgs.push(String(v))
        }
        setErrores(msgs.length ? msgs : ['No se pudo guardar el activo.'])
      } else {
        setErrores(['No se pudo guardar el activo. Intentá de nuevo.'])
      }
    } finally {
      setGuardando(false)
    }
  }

  if (!puede) {
    return (
      <Layout>
        <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
          {esEdicion ? 'Editar activo' : 'Registrar activo'}
        </h1>
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            No tenés permiso para registrar activos.
          </p>
        </div>
      </Layout>
    )
  }

  const categorias: Categoria[] = ['INMUEBLE', 'VEHICULO', 'MAQUINARIA']
  const estados: Estado[] = ['ACTIVO', 'EN_MANTENIMIENTO', 'VENDIDO', 'BAJA']
  const estadosInmueble: EstadoInmueble[] = [
    'SIN_PROYECTO', 'POR_REGULARIZAR', 'EN_PROYECTO', 'PROYECTO_TERMINADO',
  ]

  return (
    <Layout>
      <button
        onClick={() => navigate(esEdicion && id ? `/activos/${id}` : '/activos')}
        className="btn-ghost"
        style={{ border: 'none', padding: 0, color: 'var(--gold)', marginBottom: '0.75rem' }}
      >
        ← Volver
      </button>

      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        {esEdicion ? 'Editar activo' : 'Registrar activo'}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
        Datos del bien patrimonial.
      </p>

      {cargando ? (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', maxWidth: 640 }}>

          {/* ── Datos generales ── */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 0.25rem' }}>
              Datos generales
            </h2>

            <Campo label="Nombre / descripción *">
              <input
                className="input"
                required
                value={form.nombre as string}
                onChange={e => set('nombre', e.target.value)}
                placeholder="Ej: Casa Miraflores, Toyota Hilux 2022"
              />
            </Campo>

            <Campo label="Empresa *">
              <select
                className="select"
                required
                value={form.empresa || ''}
                onChange={e => set('empresa', parseInt(e.target.value))}
              >
                <option value="" disabled>Elegí una empresa…</option>
                {empresas.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </Campo>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Campo label="Categoría" style={{ flex: 1, minWidth: 160 }}>
                <select
                  className="select"
                  value={categoria}
                  onChange={e => {
                    const cat = e.target.value as Categoria
                    setCategoria(cat)
                    set('tipo', TIPOS_POR_CATEGORIA[cat][0])
                  }}
                >
                  {categorias.map(c => (
                    <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Tipo *" style={{ flex: 1, minWidth: 160 }}>
                <select
                  className="select"
                  required
                  value={form.tipo as string}
                  onChange={e => onTipoChange(e.target.value as TipoActivo)}
                >
                  {TIPOS_POR_CATEGORIA[categoria].map(t => (
                    <option key={t} value={t}>{LABEL_TIPO[t]}</option>
                  ))}
                </select>
              </Campo>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Campo label="Estado" style={{ flex: 1, minWidth: 160 }}>
                <select
                  className="select"
                  value={form.estado as string}
                  onChange={e => set('estado', e.target.value as Estado)}
                >
                  {estados.map(e => (
                    <option key={e} value={e}>{LABEL_ESTADO[e]}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Fecha de adquisición" style={{ flex: 1, minWidth: 160 }}>
                <input
                  type="date"
                  className="input"
                  value={form.fecha_adquisicion as string}
                  onChange={e => set('fecha_adquisicion', e.target.value)}
                />
              </Campo>
            </div>

            <Campo label="Valor (USD)" style={{ maxWidth: 220 }}>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', fontSize: '0.85rem', pointerEvents: 'none',
                }}>
                  $
                </span>
                <NumericInput
                  value={form.valor as string}
                  onChange={v => set('valor', v)}
                  placeholder="0,00"
                  style={{ paddingLeft: '1.5rem' }}
                />
              </div>
            </Campo>
          </div>

          {/* ── Campos INMUEBLE ── */}
          {categoria === 'INMUEBLE' && (
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 0.25rem' }}>
                Datos del inmueble
              </h2>

              <Campo label="Estado del inmueble">
                <select
                  className="select"
                  value={form.estado_inmueble as string}
                  onChange={e => set('estado_inmueble', e.target.value as EstadoInmueble)}
                >
                  {estadosInmueble.map(s => (
                    <option key={s} value={s}>{LABEL_ESTADO_INMUEBLE[s]}</option>
                  ))}
                </select>
              </Campo>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Campo label="Área (m²)" style={{ flex: 1, minWidth: 140 }}>
                  <NumericInput
                    value={form.area_m2 as string}
                    onChange={v => set('area_m2', v)}
                    placeholder="0,00"
                  />
                </Campo>
                <Campo label="N° catastral" style={{ flex: 1, minWidth: 140 }}>
                  <input
                    className="input"
                    value={form.nro_catastral as string}
                    onChange={e => set('nro_catastral', e.target.value)}
                    placeholder="04-12-345"
                  />
                </Campo>
              </div>

              <Campo label="N° habitaciones" style={{ maxWidth: 160 }}>
                <input
                  type="number" min="0"
                  className="input"
                  value={form.nro_habitaciones ?? ''}
                  onChange={e => set('nro_habitaciones', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </Campo>
            </div>
          )}

          {/* ── Campos VEHÍCULO / MAQUINARIA ── */}
          {(categoria === 'VEHICULO' || categoria === 'MAQUINARIA') && (
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 0.25rem' }}>
                {categoria === 'VEHICULO' ? 'Datos del vehículo' : 'Datos de la maquinaria'}
              </h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Campo label="Placa / matrícula" style={{ flex: 1, minWidth: 140 }}>
                  <input
                    className="input"
                    value={form.placa as string}
                    onChange={e => set('placa', e.target.value.toUpperCase())}
                    placeholder="4532-LPZ"
                  />
                </Campo>
                <Campo label="Color" style={{ flex: 1, minWidth: 140 }}>
                  <input
                    className="input"
                    value={form.color as string}
                    onChange={e => set('color', e.target.value)}
                    placeholder="Blanco"
                  />
                </Campo>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Campo label="Marca" style={{ flex: 1, minWidth: 140 }}>
                  <input
                    className="input"
                    value={form.marca as string}
                    onChange={e => set('marca', e.target.value)}
                    placeholder="Toyota"
                  />
                </Campo>
                <Campo label="Modelo" style={{ flex: 1, minWidth: 140 }}>
                  <input
                    className="input"
                    value={form.modelo_descripcion as string}
                    onChange={e => set('modelo_descripcion', e.target.value)}
                    placeholder="Hilux"
                  />
                </Campo>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Campo label="Año" style={{ flex: 1, minWidth: 120 }}>
                  <input
                    type="number" min="1900" max="2100"
                    className="input"
                    value={form.anio ?? ''}
                    onChange={e => set('anio', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="2022"
                  />
                </Campo>
                <Campo label="N° de serie / chasis" style={{ flex: 2, minWidth: 180 }}>
                  <input
                    className="input"
                    value={form.nro_serie as string}
                    onChange={e => set('nro_serie', e.target.value)}
                    placeholder="JTEBU5JR2K5…"
                  />
                </Campo>
              </div>
            </div>
          )}

          {/* ── Ubicación ── */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 0.25rem' }}>
              Ubicación
            </h2>

            {/* Buscador de Google Maps */}
            <Campo label="🗺️ Buscar ubicación">
              <BuscadorGoogleMaps onSeleccionar={onUbicacionSeleccionada} />
            </Campo>

            {/* Separador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                o completar manualmente
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Campo label="Departamento" style={{ flex: 1, minWidth: 160 }}>
                <select
                  className="select"
                  value={form.departamento as string}
                  onChange={e => set('departamento', e.target.value)}
                >
                  <option value="">— Sin especificar —</option>
                  {DEPARTAMENTOS_BOLIVIA.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Ciudad / Municipio" style={{ flex: 1, minWidth: 160 }}>
                <input
                  className="input"
                  value={form.ciudad as string}
                  onChange={e => set('ciudad', e.target.value)}
                  placeholder="Ej: La Paz, El Alto, Cochabamba…"
                />
              </Campo>
            </div>

            <Campo label="Dirección (texto legible)">
              <input
                className="input"
                value={form.direccion as string}
                onChange={e => set('direccion', e.target.value)}
                placeholder="Av. 6 de Agosto N° 2345, La Paz"
              />
            </Campo>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Campo label="Latitud" style={{ flex: 1, minWidth: 140 }}>
                <input
                  type="number" step="any"
                  className="input"
                  value={form.latitud as string}
                  onChange={e => set('latitud', e.target.value)}
                  placeholder="-16.500000"
                />
              </Campo>
              <Campo label="Longitud" style={{ flex: 1, minWidth: 140 }}>
                <input
                  type="number" step="any"
                  className="input"
                  value={form.longitud as string}
                  onChange={e => set('longitud', e.target.value)}
                  placeholder="-68.150000"
                />
              </Campo>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Coordenadas: clic derecho en Google Maps sobre el punto → "¿Qué hay aquí?" → copiar lat/lng.
            </p>
          </div>

          {/* ── Notas ── */}
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            <h2 className="serif" style={{ fontSize: '1.1rem', color: 'var(--gold)', margin: '0 0 0.25rem' }}>
              Notas
            </h2>
            <textarea
              className="input"
              rows={3}
              value={form.notas as string}
              onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones adicionales…"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* ── Documentos (solo en edición) ── */}
          {esEdicion && id && (
            <SeccionDocumentos activoId={parseInt(id)} />
          )}
          {!esEdicion && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 8,
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              📎 Podrás subir documentos (escrituras, planos, fotos…) después de guardar el activo.
            </div>
          )}

          {/* Errores */}
          {errores.length > 0 && (
            <div className="alert-error" style={{ marginBottom: '1rem' }}>
              {errores.map((msg, i) => <p key={i} style={{ margin: i === 0 ? 0 : '0.25rem 0 0' }}>{msg}</p>)}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate(esEdicion && id ? `/activos/${id}` : '/activos')}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-gold" disabled={guardando} style={{ padding: '0.55rem 1.25rem' }}>
              {guardando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Registrar activo'}
            </button>
          </div>
        </form>
      )}
    </Layout>
  )
}
