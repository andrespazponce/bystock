/**
 * Iconos SVG mínimos (sin librería externa). Heredan el color vía `currentColor`
 * y el tamaño por la prop `size`. Trazo fino para un look elegante.
 */
interface IconProps {
  size?: number
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

/**
 * Marca INCERPAZ — 6 huecos de un ladrillo (2 columnas × 3 filas).
 * Usa `fill: currentColor`, así toma el dorado del color que herede.
 */
export function MarcaIncerpaz({ size = 22 }: IconProps) {
  // viewBox 14×19; cuadrados de 5 con separación de 2 (como los huecos del ladrillo).
  const cols = [1, 8]
  const rows = [0, 7, 14]
  return (
    <svg
      width={Math.round((size * 14) / 19)}
      height={size}
      viewBox="0 0 14 19"
      fill="currentColor"
      aria-hidden="true"
    >
      {rows.map((y) =>
        cols.map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" rx="1.1" />),
      )}
    </svg>
  )
}

/** Buscar — lupa */
export function IconBuscar({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

/** Dashboard — cuadrícula */
export function IconDashboard({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

/** Reuniones — calendario */
export function IconReuniones({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  )
}

/** Compromisos — checklist */
export function IconCompromisos({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9 5h9M9 12h9M9 19h9" />
      <path d="M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2" />
    </svg>
  )
}

/** Documentos — archivo */
export function IconDocumentos({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}

/** Mis compromisos — persona */
export function IconMisCompromisos({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  )
}

/** Compactar/expandir menú — chevrons dobles */
export function IconColapsar({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M11 7l-5 5 5 5M18 7l-5 5 5 5" />
    </svg>
  )
}

export function IconExpandir({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M13 7l5 5-5 5M6 7l5 5-5 5" />
    </svg>
  )
}

/** Ajustes — sliders de configuración */
export function IconAjustes({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="6" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}

/** Empresas — edificio */
export function IconEmpresas({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

/** Órganos — árbol jerárquico */
export function IconOrganos({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <rect x="2" y="15" width="6" height="4" rx="1" />
      <rect x="16" y="15" width="6" height="4" rx="1" />
      <path d="M12 6v4M5 15v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

/** Personas — grupo de personas */
export function IconPersonas({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

/** Usuarios — persona con candado */
export function IconUsuarios({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21c0-3.5 3.1-5.5 7-5.5" />
      <rect x="13" y="14" width="9" height="7" rx="1.5" />
      <path d="M16 17h3M17.5 14v-2a2 2 0 0 1 4 0v2" />
    </svg>
  )
}

/** Grupos — personas con escudo */
export function IconGrupos({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21c0-4 3.1-6 7-6s7 2 7 6" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21c0-3.5-2.5-5.5-5-5.5" />
    </svg>
  )
}

/** Ícono genérico de activos: edificio/ladrillo patrimonial */
export function IconActivos({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <path d="M6 11h2M6 15h2M16 11h2M16 15h2" />
    </svg>
  )
}

/** Ícono mapa / ubicación */
export function IconMapa({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  )
}

export function IconFinanzas({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

export function IconReportes({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

/** Flecha de subida (importar / upload) */
export function IconSubir({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}
