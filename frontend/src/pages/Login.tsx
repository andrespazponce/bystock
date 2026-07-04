import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { MarcaIncerpaz } from '../components/icons'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError(
          err.response.data?.detail ??
            'Cuenta bloqueada temporalmente por demasiados intentos fallidos. Probá de nuevo más tarde.',
        )
      } else {
        setError('Email o contraseña incorrectos.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: '2rem', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: 'var(--gold-strong)' }}>
          <MarcaIncerpaz size={32} />
          <h1 className="serif" style={{ fontSize: '1.9rem', margin: 0, letterSpacing: '0.06em' }}>INCERPAZ</h1>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
          Portal de Gobierno Corporativo
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Email</span>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              style={{ fontSize: '1rem' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Contraseña</span>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ fontSize: '1rem' }}
            />
          </label>

          {error && <p className="alert-error" style={{ margin: 0 }}>{error}</p>}

          <button type="submit" disabled={submitting} className="btn-gold" style={{ padding: '0.65rem', fontSize: '1rem', marginTop: '0.5rem' }}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
