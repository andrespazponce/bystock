import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCompromisos, updateCompromisoEstado } from '../api/compromisos'
import type { Compromiso, CompromisoFiltros } from '../api/compromisos'

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// Estados "abiertos" (trabajo por resolver): un compromiso aquí puede estar vencido.
const ABIERTOS = ['PENDIENTE', 'EN_PROCESO']

// Columnas del Kanban: una por estado, en orden de flujo.
const COLUMNAS: { estado: string; label: string; color: string }[] = [
  { estado: 'PENDIENTE', label: 'Por hacer', color: 'var(--warning)' },
  { estado: 'EN_PROCESO', label: 'En proceso', color: 'var(--info)' },
  { estado: 'CUMPLIDO', label: 'Realizado', color: 'var(--success)' },
  { estado: 'CANCELADO', label: 'Cancelado', color: 'var(--text-muted)' },
]

/**
 * Kanban de compromisos con drag & drop, compartido entre el tablero general
 * (Compromisos) y el personal (Mis compromisos). `filtroBase` se mezcla en cada
 * consulta — p. ej. {responsable: personaId} para mostrar solo los míos.
 */
export default function TableroCompromisos({
  puedeGestionar,
  filtroBase,
}: {
  puedeGestionar: boolean
  filtroBase?: CompromisoFiltros
}) {
  const navigate = useNavigate()

  // Una lista de tarjetas por estado.
  const [cols, setCols] = useState<Record<string, Compromiso[]>>({
    PENDIENTE: [],
    EN_PROCESO: [],
    CUMPLIDO: [],
    CANCELADO: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // id de la tarjeta que se está arrastrando y columna sobre la que se está soltando.
  const [arrastrando, setArrastrando] = useState<number | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)

  // Serializamos el filtro para usarlo como dependencia estable del efecto
  // (evita relanzar la carga si llega un objeto nuevo con el mismo contenido).
  const filtroKey = JSON.stringify(filtroBase ?? {})

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(null)
    const base: CompromisoFiltros = JSON.parse(filtroKey)

    // Trae TODAS las páginas de un estado (el volumen es chico).
    async function traerEstado(estado: string): Promise<Compromiso[]> {
      const acc: Compromiso[] = []
      let page = 1
      while (true) {
        const data = await getCompromisos({ ...base, estado, page })
        acc.push(...data.results)
        if (!data.next) break
        page += 1
      }
      return acc
    }

    Promise.all([
      traerEstado('PENDIENTE'),
      traerEstado('EN_PROCESO'),
      traerEstado('CUMPLIDO'),
      traerEstado('CANCELADO'),
    ])
      .then(([p, e, c, x]) => {
        if (!cancelado) setCols({ PENDIENTE: p, EN_PROCESO: e, CUMPLIDO: c, CANCELADO: x })
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el tablero.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [filtroKey])

  // Suelta la tarjeta arrastrada en la columna destino → cambia su estado.
  async function soltarEn(estadoDestino: string) {
    const id = arrastrando
    setArrastrando(null)
    setSobre(null)
    if (id == null) return

    // Localizar la tarjeta y su columna de origen.
    let origen: string | null = null
    let tarjeta: Compromiso | undefined
    for (const est of Object.keys(cols)) {
      const encontrada = cols[est].find((c) => c.id === id)
      if (encontrada) {
        origen = est
        tarjeta = encontrada
        break
      }
    }
    if (!tarjeta || !origen || origen === estadoDestino) return

    // Movimiento optimista: actualizamos la UI antes de que responda el backend.
    const previo = cols
    const movida: Compromiso = {
      ...tarjeta,
      estado: estadoDestino,
      // Si pasa a un estado cerrado (Realizado/Cancelado) deja de estar vencido.
      vencido: ABIERTOS.includes(estadoDestino) ? tarjeta.vencido : false,
    }
    setCols((c) => ({
      ...c,
      [origen!]: c[origen!].filter((t) => t.id !== id),
      [estadoDestino]: [movida, ...c[estadoDestino]],
    }))

    try {
      const actualizado = await updateCompromisoEstado(id, estadoDestino)
      // Sincronizamos la etiqueta legible que devuelve el backend.
      setCols((c) => ({
        ...c,
        [estadoDestino]: c[estadoDestino].map((t) =>
          t.id === id ? { ...t, estado_display: actualizado.estado_display } : t,
        ),
      }))
    } catch {
      setCols(previo) // revertir
      setError('No se pudo mover el compromiso.')
    }
  }

  // Dibuja una tarjeta de compromiso (arrastrable si hay permiso).
  function Tarjeta(c: Compromiso, color: string) {
    return (
      <div
        key={c.id}
        draggable={puedeGestionar}
        onDragStart={() => setArrastrando(c.id)}
        onDragEnd={() => {
          setArrastrando(null)
          setSobre(null)
        }}
        onClick={() => navigate(`/reuniones/${c.reunion_id}`)}
        title={puedeGestionar ? 'Arrastra para cambiar de estado · clic para ver la reunión' : 'Ver la reunión de origen'}
        style={{
          background: 'var(--surface-2)',
          border: `1px solid var(--border)`,
          borderLeft: `3px solid ${c.vencido ? 'var(--danger)' : color}`,
          borderRadius: 8,
          padding: '0.7rem 0.8rem',
          cursor: puedeGestionar ? 'grab' : 'pointer',
          opacity: arrastrando === c.id ? 0.5 : 1,
          minWidth: 0,
        }}
      >
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{c.descripcion}</p>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {c.responsable?.nombre_completo ?? 'Sin responsable'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: c.vencido ? 'var(--danger)' : 'var(--text-muted)', fontWeight: c.vencido ? 600 : 400 }}>
            {c.vencido ? 'Vencido · ' : ''}{formatearFecha(c.fecha_limite)}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.reunion_etiqueta}</span>
        </div>
      </div>
    )
  }

  // Dibuja una columna (zona de arrastre / drop) con sus tarjetas en pila.
  function Columna(col: { estado: string; label: string; color: string }) {
    const tarjetas = cols[col.estado] ?? []
    const resaltada = sobre === col.estado
    return (
      <div
        key={col.estado}
        onDragOver={(e) => {
          if (!puedeGestionar) return
          e.preventDefault()
          if (sobre !== col.estado) setSobre(col.estado)
        }}
        onDragLeave={() => setSobre((s) => (s === col.estado ? null : s))}
        onDrop={() => soltarEn(col.estado)}
        style={{
          background: 'var(--surface)',
          border: `1px solid ${resaltada ? 'var(--gold)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '0.75rem',
          minHeight: 120,
          transition: 'border-color 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{col.label}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({tarjetas.length})</span>
        </div>

        {tarjetas.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '0.5rem 0' }}>—</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {tarjetas.map((c) => Tarjeta(c, col.color))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cargando…</p>
  if (error) return <p className="alert-error" style={{ marginTop: '1.5rem' }}>{error}</p>

  return (
    <>
      <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {puedeGestionar
          ? 'Arrastra una tarjeta entre columnas para cambiar su estado.'
          : 'Solo lectura — no tienes permiso para cambiar el estado de los compromisos.'}
      </p>

      {/* Una columna por estado: Por hacer · En proceso · Realizado · Cancelado.
          En pantallas angostas se desplaza horizontalmente. */}
      <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNAS.length}, minmax(220px, 1fr))`,
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          {COLUMNAS.map((col) => Columna(col))}
        </div>
      </div>
    </>
  )
}
