import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Tema = 'dark' | 'light'

interface ThemeContextType {
  tema: Tema
  toggleTema: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'tema'

/** Lee la preferencia guardada; si no hay, usa el modo oscuro (la marca). */
function temaInicial(): Tema {
  const guardado = localStorage.getItem(STORAGE_KEY)
  if (guardado === 'light' || guardado === 'dark') return guardado
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  // Refleja el tema en <html data-theme="..."> para que las variables CSS apliquen.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem(STORAGE_KEY, tema)
  }, [tema])

  function toggleTema() {
    setTema((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ tema, toggleTema }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
