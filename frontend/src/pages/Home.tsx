import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 600, margin: '4rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Portal de Gobierno Corporativo</h1>
        <button onClick={handleLogout} style={{ padding: '0.4rem 0.8rem', cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>

      <p style={{ marginTop: '1.5rem' }}>
        Bienvenido, <strong>{user?.nombre_completo}</strong>
        {user?.es_socio && ' (socio)'}.
      </p>
      <p style={{ color: '#666' }}>Sesión iniciada como {user?.email}.</p>
    </div>
  )
}
