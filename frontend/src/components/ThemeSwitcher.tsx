import { useTheme } from '../theme/ThemeContext'

export default function ThemeSwitcher() {
  const { tema, temas, setTema } = useTheme()

  const temaLabels: Record<string, string> = {
    original: '🎨 Original',
    bento: '⬜ Bento',
    professional: '✨ Profesional',
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tema:</label>
      <select
        value={tema}
        onChange={(e) => setTema(e.target.value as any)}
        style={{
          padding: '0.4rem 0.6rem',
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        {temas.map((t) => (
          <option key={t} value={t}>
            {temaLabels[t] || t}
          </option>
        ))}
      </select>
    </div>
  )
}
