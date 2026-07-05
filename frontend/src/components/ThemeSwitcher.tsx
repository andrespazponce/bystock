import { useTheme } from '../theme/ThemeContext'

export default function ThemeSwitcher() {
  const { tema, temas, setTema } = useTheme()

  const temaEmojis: Record<string, string> = {
    original: '🎨',
    bento: '⬜',
    professional: '✨',
  }

  function cycleTheme() {
    const currentIndex = temas.indexOf(tema)
    const nextIndex = (currentIndex + 1) % temas.length
    setTema(temas[nextIndex])
  }

  return (
    <button
      onClick={cycleTheme}
      title={`Tema actual: ${tema}. Click para cambiar.`}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--gold)'
        e.currentTarget.style.background = 'var(--gold-soft)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--surface)'
      }}
    >
      {temaEmojis[tema] || '🎨'}
    </button>
  )
}
