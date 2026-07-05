import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Tema = 'original' | 'bento' | 'professional'

interface ThemeContextType {
  tema: Tema
  temas: Tema[]
  toggleTema: () => void
  setTema: (tema: Tema) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'bystock-tema'
const TEMAS: Tema[] = ['original', 'bento', 'professional']

/** Lee la preferencia guardada; si no hay, usa el tema original. */
function temaInicial(): Tema {
  const guardado = localStorage.getItem(STORAGE_KEY)
  if (guardado === 'original' || guardado === 'bento' || guardado === 'professional') return guardado
  return 'original'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(temaInicial)

  // Refleja el tema en <html data-theme="..."> para que las variables CSS apliquen.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem(STORAGE_KEY, tema)
  }, [tema])

  function toggleTema() {
    const currentIndex = TEMAS.indexOf(tema)
    const nextIndex = (currentIndex + 1) % TEMAS.length
    setTemaState(TEMAS[nextIndex])
  }

  function setTema(newTema: Tema) {
    setTemaState(newTema)
  }

  return (
    <ThemeContext.Provider value={{ tema, temas: TEMAS, toggleTema, setTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
