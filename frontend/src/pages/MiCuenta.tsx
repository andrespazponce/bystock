import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import Layout from '../components/Layout'
import { cambiarPassword } from '../api/cuenta'
import { useAuth } from '../auth/AuthContext'

export default function MiCuenta() {
  const { user } = useAuth()

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [errores, setErrores] = useState<string[]>([])
  const [exito, setExito] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!user) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrores([])
    setExito(null)

    // Validación en el cliente: la confirmación debe coincidir (esto el backend
    // no lo verifica porque solo recibe password_nueva).
    if (nueva !== confirmar) {
      setErrores(['La nueva contraseña y su confirmación no coinciden.'])
      return
    }

    setEnviando(true)
    try {
      const res = await cambiarPassword(actual, nueva)
      setExito(res.detail)
      setActual('')
      setNueva('')
      setConfirmar('')
    } catch (err) {
      // El backend devuelve 400 con errores por campo o generales.
      // Los aplanamos a una lista de mensajes legibles.
      if (axios.isAxiosError(err) && err.response?.status === 400 && err.response.data) {
        const data = err.response.data as Record<string, unknown>
        const msgs: string[] = []
        for (const valor of Object.values(data)) {
          if (Array.isArray(valor)) msgs.push(...valor.map(String))
          else if (valor) msgs.push(String(valor))
        }
        setErrores(msgs.length ? msgs : ['No se pudo cambiar la contraseña.'])
      } else {
        setErrores(['No se pudo cambiar la contraseña. Intentá de nuevo.'])
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Layout>
      <h1 className="serif" style={{ fontSize: '1.8rem', margin: 0, color: 'var(--gold-strong)' }}>
        Mi cuenta
      </h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
        Tus datos de acceso y la seguridad de tu cuenta.
      </p>

      <div
        style={{
          marginTop: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* Datos del perfil (solo lectura) */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '0.85rem', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>
            PERFIL
          </h2>
          <dl style={{ margin: '1rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <Dato etiqueta="Nombre" valor={user.nombre_completo || '—'} />
            <Dato etiqueta="Email" valor={user.email} />
            <Dato etiqueta="Socio" valor={user.es_socio ? 'Sí' : 'No'} />
            <div>
              <dt style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Perfiles</dt>
              <dd style={{ margin: '0.35rem 0 0' }}>
                {user.grupos.length === 0 && !user.is_superuser ? (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {user.is_superuser && (
                      <span className="chip" style={{ borderColor: 'var(--gold)', color: 'var(--gold-strong)' }}>
                        Administrador
                      </span>
                    )}
                    {user.grupos.map((g) => (
                      <span key={g} className="chip">{g}</span>
                    ))}
                  </div>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Cambio de contraseña */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '0.85rem', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>
            CAMBIAR CONTRASEÑA
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
            <Campo
              label="Contraseña actual"
              value={actual}
              onChange={setActual}
              autoComplete="current-password"
            />
            <Campo
              label="Nueva contraseña"
              value={nueva}
              onChange={setNueva}
              autoComplete="new-password"
            />
            <Campo
              label="Confirmar nueva contraseña"
              value={confirmar}
              onChange={setConfirmar}
              autoComplete="new-password"
            />

            {errores.length > 0 && (
              <div className="alert-error" style={{ margin: 0 }}>
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {errores.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {exito && (
              <p style={{ margin: 0, color: 'var(--success)', fontWeight: 600 }}>{exito}</p>
            )}

            <button
              type="submit"
              disabled={enviando || !actual || !nueva || !confirmar}
              className="btn-gold"
              style={{ padding: '0.65rem', fontSize: '1rem', marginTop: '0.25rem' }}
            >
              {enviando ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{etiqueta}</dt>
      <dd style={{ margin: '0.2rem 0 0', fontWeight: 500 }}>{valor}</dd>
    </div>
  )
}

function Campo({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <input
        type="password"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        style={{ fontSize: '1rem' }}
      />
    </label>
  )
}
