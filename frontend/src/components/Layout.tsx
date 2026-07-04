import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../theme/ThemeContext'
import AsistenteChat from './AsistenteChat'
import {
  IconActivos,
  IconBuscar,
  IconColapsar,
  IconCompromisos,
  IconDashboard,
  IconDocumentos,
  IconEmpresas,
  IconExpandir,
  IconGrupos,
  IconMapa,
  IconMisCompromisos,
  IconOrganos,
  IconPersonas,
  IconReportes,
  IconReuniones,
  IconSubir,
  IconUsuarios,
  MarcaIncerpaz,
} from './icons'

/**
 * MÓDULOS del portal (barra superior).
 * `path`: ruta de entrada del módulo (null = deshabilitado / próximamente).
 * `soloAdmin`: si true, solo se muestra a usuarios is_staff.
 */
const MODULOS_BASE = [
  { clave: 'memoria', label: 'Memoria Corporativa', path: '/' as string | null, soloAdmin: false },
  { clave: 'compliance', label: 'Compliance', path: null, soloAdmin: false },
  { clave: 'paz-holding', label: 'Paz Holding', path: '/activos' as string | null, soloAdmin: false },
  { clave: 'finanzas', label: 'Finanzas Corporativas', path: '/finanzas' as string | null, soloAdmin: false },
  { clave: 'ajustes', label: 'Ajustes', path: '/ajustes' as string | null, soloAdmin: true },
]

/** Navegación del módulo Memoria Corporativa (menú lateral). */
const NAV_MEMORIA = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/reuniones', label: 'Reuniones', Icon: IconReuniones, end: true },
  { to: '/compromisos', label: 'Compromisos', Icon: IconCompromisos, end: false },
  { to: '/mis-compromisos', label: 'Mis compromisos', Icon: IconMisCompromisos, end: false },
  { to: '/documentos', label: 'Documentos', Icon: IconDocumentos, end: false },
  { to: '/buscar', label: 'Buscar', Icon: IconBuscar, end: false },
]

/** Navegación del módulo Paz Holding (menú lateral). */
const NAV_PAZ_HOLDING = [
  { to: '/activos', label: 'Activos', Icon: IconActivos, end: true },
  { to: '/activos/mapa', label: 'Mapa', Icon: IconMapa, end: false },
]

/** Navegación del módulo Finanzas Corporativas (menú lateral). */
const NAV_FINANZAS = [
  { to: '/finanzas', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/finanzas/importar', label: 'Importar Excel', Icon: IconSubir, end: false },
  { to: '/finanzas/subir', label: 'Subir Reporte', Icon: IconReportes, end: false },
]

/** Navegación del módulo Ajustes (menú lateral). */
const NAV_AJUSTES = [
  { to: '/ajustes/empresas', label: 'Empresas', Icon: IconEmpresas, end: false },
  { to: '/ajustes/organos', label: 'Órganos', Icon: IconOrganos, end: false },
  { to: '/ajustes/personas', label: 'Personas', Icon: IconPersonas, end: false },
  { to: '/ajustes/usuarios', label: 'Usuarios', Icon: IconUsuarios, end: false },
  { to: '/ajustes/grupos', label: 'Grupos', Icon: IconGrupos, end: false },
]

const SIDEBAR_KEY = 'sidebar_colapsado'
const ANCHO_EXPANDIDO = 220
const ANCHO_COLAPSADO = 62

/**
 * Cáscara común de las pantallas autenticadas:
 *  - Barra superior: marca + MÓDULOS + tema/usuario/salir.
 *  - Menú lateral izquierdo (navegación del módulo), COMPACTABLE a solo iconos.
 * El contenido de cada página va en `children`.
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { tema, toggleTema } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // Módulo activo según la ruta actual
  const enAjustes  = location.pathname.startsWith('/ajustes')
  const enActivos  = location.pathname.startsWith('/activos')
  const enFinanzas = location.pathname.startsWith('/finanzas')
  const moduloActivo = enAjustes ? 'ajustes' : enActivos ? 'paz-holding' : enFinanzas ? 'finanzas' : 'memoria'

  // Nav y etiqueta del módulo activo en el sidebar
  const navActual = enAjustes
    ? NAV_AJUSTES
    : enActivos
    ? NAV_PAZ_HOLDING
    : enFinanzas
    ? NAV_FINANZAS
    : NAV_MEMORIA
  const labelModulo = enAjustes
    ? 'Ajustes'
    : enActivos
    ? 'Paz Holding'
    : enFinanzas
    ? 'Finanzas Corporativas'
    : 'Memoria Corporativa'

  // Lista de módulos visible para este usuario
  const modulos = MODULOS_BASE.filter((m) => !m.soloAdmin || user?.is_staff)

  // Estado de compactado: se inicializa desde localStorage (persiste entre páginas).
  const [colapsado, setColapsado] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')

  function toggleSidebar() {
    setColapsado((c) => {
      const nuevo = !c
      localStorage.setItem(SIDEBAR_KEY, nuevo ? '1' : '0')
      return nuevo
    })
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const anchoSidebar = colapsado ? ANCHO_COLAPSADO : ANCHO_EXPANDIDO

  return (
    /*
     * Contenedor raíz: ocupa exactamente el viewport y NO hace scroll.
     * El único elemento que scrollea es <main> (el área de contenido).
     */
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ===== SIDEBAR — columna izquierda, altura total ===== */}
      <aside
        style={{
          width: anchoSidebar,
          flexShrink: 0,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          transition: 'width 0.18s ease',
          display: 'flex',
          flexDirection: 'column',
          padding: '0.75rem 0.5rem 1rem',
        }}
      >
        {/* Marca + botón compactar */}
        <div
          style={{
            display: 'flex',
            flexDirection: colapsado ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: colapsado ? 'center' : 'space-between',
            gap: '0.5rem',
            padding: '0.35rem 0.4rem 0.75rem',
          }}
        >
          <NavLink
            to="/"
            className="serif"
            title="INCERPAZ"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gold-strong)', textDecoration: 'none' }}
          >
            <MarcaIncerpaz size={26} />
            {!colapsado && (
              <span style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em' }}>INCERPAZ</span>
            )}
          </NavLink>
          <button
            onClick={toggleSidebar}
            className="btn-ghost"
            title={colapsado ? 'Expandir menú' : 'Compactar menú'}
            style={{ padding: '0.3rem', display: 'flex', alignItems: 'center', border: 'none', flexShrink: 0 }}
          >
            {colapsado ? <IconExpandir size={18} /> : <IconColapsar size={18} />}
          </button>
        </div>

        {/* Separador fino bajo la marca */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 0.4rem 0.75rem' }} />

        {/* Etiqueta del módulo activo (solo expandido) */}
        {!colapsado && (
          <span
            style={{
              fontSize: '0.68rem',
              letterSpacing: '0.09em',
              color: 'var(--text-muted)',
              fontWeight: 700,
              padding: '0 0.65rem 0.5rem',
              textTransform: 'uppercase',
            }}
          >
            {labelModulo}
          </span>
        )}

        {/* Ítems de navegación */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1 }}>
          {navActual.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={colapsado ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.7rem',
                justifyContent: colapsado ? 'center' : 'flex-start',
                padding: '0.6rem 0.65rem',
                borderRadius: 8,
                textDecoration: 'none',
                color: isActive ? 'var(--gold-300)' : 'var(--text-muted)',
                background: isActive ? 'rgba(201,168,76,0.10)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.9rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                borderRight: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                boxShadow: isActive ? 'inset -2px 0 14px rgba(201,168,76,0.10)' : 'none',
                transition: 'all 0.15s ease',
              })}
            >
              <Icon size={20} />
              {!colapsado && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer del sidebar: Ajustes + toggle de tema + mi cuenta */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.15rem',
          }}
        >
          <button
            onClick={toggleTema}
            className="btn-ghost"
            title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              justifyContent: colapsado ? 'center' : 'flex-start',
              padding: '0.6rem 0.65rem',
              borderRadius: 8,
              border: 'none',
              width: '100%',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {!colapsado && <span>{tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
          </button>

          <NavLink
            to="/mi-cuenta"
            title={colapsado ? user?.nombre_completo : undefined}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              justifyContent: colapsado ? 'center' : 'flex-start',
              padding: '0.6rem 0.65rem',
              borderRadius: 8,
              textDecoration: 'none',
              color: isActive ? 'var(--gold)' : 'var(--text-muted)',
              background: isActive ? 'var(--gold-soft)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            })}
          >
            {/* Avatar circular con la inicial */}
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'var(--gold-soft)',
                border: '1px solid var(--gold)',
                color: 'var(--gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {user?.nombre_completo?.[0]?.toUpperCase() ?? '?'}
            </span>
            {!colapsado && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.nombre_completo}
              </span>
            )}
          </NavLink>

          <button
            onClick={handleLogout}
            className="btn-ghost"
            title={colapsado ? 'Salir' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              justifyContent: colapsado ? 'center' : 'flex-start',
              padding: '0.6rem 0.65rem',
              borderRadius: 8,
              border: 'none',
              width: '100%',
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
              background: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {/* Ícono de salida (→) */}
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!colapsado && <span>Salir</span>}
          </button>
        </div>
      </aside>

      {/* ===== COLUMNA DERECHA: topbar + contenido ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Barra superior: módulos navegables */}
        <header
          style={{
            height: 48,
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.25rem',
            gap: '0.25rem',
          }}
        >
          {modulos.map((m) => {
            const esActivo = m.clave === moduloActivo
            const habilitado = m.path !== null

            // Módulo habilitado y activo → resaltado, clicable
            // Módulo habilitado pero inactivo → clicable sin resaltado
            // Módulo deshabilitado → span no clicable con tooltip
            if (!habilitado) {
              return (
                <span
                  key={m.clave}
                  title="Próximamente"
                  style={{
                    padding: '0.35rem 0.8rem',
                    borderRadius: 6,
                    fontSize: '0.88rem',
                    whiteSpace: 'nowrap',
                    cursor: 'not-allowed',
                    color: 'var(--text-muted)',
                    opacity: 0.4,
                  }}
                >
                  {m.label}
                </span>
              )
            }

            return (
              <button
                key={m.clave}
                onClick={() => navigate(m.path!)}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: 6,
                  fontSize: '0.88rem',
                  whiteSpace: 'nowrap',
                  cursor: esActivo ? 'default' : 'pointer',
                  color: esActivo ? 'var(--gold-300)' : 'var(--text-muted)',
                  background: esActivo ? 'rgba(201,168,76,0.10)' : 'transparent',
                  fontWeight: esActivo ? 600 : 400,
                  border: 'none',
                  borderBottom: esActivo ? '2px solid var(--gold)' : '2px solid transparent',
                  boxShadow: esActivo ? '0 2px 12px rgba(201,168,76,0.18)' : 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!esActivo) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
                }}
                onMouseLeave={(e) => {
                  if (!esActivo) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
                }}
              >
                {m.label}
              </button>
            )
          })}
        </header>

        {/* Área de contenido: el ÚNICO elemento que hace scroll */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2rem',
          }}
        >
          <div style={{ maxWidth: 1040, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>

      {/* Asistente IA flotante — visible en todas las páginas autenticadas */}
      <AsistenteChat />
    </div>
  )
}
